import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getAuthUser, unauthorized, forbidden } from '@/lib/apiAuth'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const admin = supabaseAdmin as any

const BUCKET = 'fotos-dashboard'

// POST /api/propriedade/avatar — upload da foto do anfitrião.
// multipart { propriedadeId, file }. Grava a URL em propriedades.foto_responsavel.
export async function POST(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return unauthorized()

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return Response.json({ error: 'Formato inválido.' }, { status: 400 })
  }

  const propriedadeId = Number(form.get('propriedadeId'))
  if (!propriedadeId) return Response.json({ error: 'propriedadeId é obrigatório.' }, { status: 400 })

  const { data: prop } = await admin.from('propriedades').select('id, usuario_id').eq('id', propriedadeId).maybeSingle()
  if (!prop || prop.usuario_id !== user.id) return forbidden()

  const file = form.get('file')
  if (!(file instanceof File) || file.size === 0) return Response.json({ error: 'Nenhum arquivo enviado.' }, { status: 400 })

  try {
    const buf = Buffer.from(await file.arrayBuffer())
    const ext = (file.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg')
    const path = `${user.id}/${propriedadeId}/anfitriao-${Date.now()}.${ext}`

    const { error: upErr } = await admin.storage.from(BUCKET).upload(path, buf, {
      contentType: file.type || 'image/jpeg',
      cacheControl: '3600',
      upsert: true,
    })
    if (upErr) return Response.json({ error: upErr.message }, { status: 500 })

    const url = admin.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
    const { error: updErr } = await admin.from('propriedades').update({ foto_responsavel: url }).eq('id', propriedadeId)
    if (updErr) return Response.json({ error: updErr.message }, { status: 500 })

    return Response.json({ url })
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : 'Falha no upload.' }, { status: 500 })
  }
}
