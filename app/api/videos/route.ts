import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getAuthUser, unauthorized, forbidden } from '@/lib/apiAuth'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const admin = supabaseAdmin as any

async function planoDoUsuario(userId: string): Promise<string> {
  try {
    const { data } = await admin
      .from('assinaturas').select('plano_ativo,status')
      .eq('usuario_id', userId).in('status', ['ativa', 'trial']).maybeSingle()
    const p = (data?.plano_ativo || 'basico').toString().toLowerCase()
    return ['basico', 'pro', 'ultra'].includes(p) ? p : 'basico'
  } catch { return 'basico' }
}

async function donoDaPropriedade(propriedadeId: number, userId: string) {
  const { data: prop } = await admin.from('propriedades').select('id, usuario_id').eq('id', propriedadeId).maybeSingle()
  if (!prop || prop.usuario_id !== userId) return null
  return prop
}

// POST /api/videos — adiciona vídeo/Tour 360° (exclusivo Ultra). { propriedadeId, url, titulo? }
export async function POST(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return unauthorized()

  const { propriedadeId, url, titulo } = await req.json()
  const pid = Number(propriedadeId)
  if (!pid || !url || typeof url !== 'string') return Response.json({ error: 'propriedadeId e url são obrigatórios.' }, { status: 400 })

  const prop = await donoDaPropriedade(pid, user.id)
  if (!prop) return forbidden()

  const plano = await planoDoUsuario(prop.usuario_id)
  if (plano !== 'ultra') {
    return Response.json({ error: 'Vídeos e Tour 360° são exclusivos do plano Ultra.', code: 'PLANO_ULTRA' }, { status: 403 })
  }

  const { data, error } = await admin
    .from('videos_propriedade')
    .insert({ propriedade_id: pid, url: url.trim(), titulo: (titulo || '').trim() || null })
    .select('*')
    .single()
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ video: data })
}

// DELETE /api/videos?id=...
export async function DELETE(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return unauthorized()

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return Response.json({ error: 'id é obrigatório.' }, { status: 400 })

  const { data: v } = await admin.from('videos_propriedade').select('id, propriedade_id').eq('id', id).maybeSingle()
  if (!v) return Response.json({ error: 'Vídeo não encontrado.' }, { status: 404 })
  const prop = await donoDaPropriedade(Number(v.propriedade_id), user.id)
  if (!prop) return forbidden()

  const { error } = await admin.from('videos_propriedade').delete().eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
