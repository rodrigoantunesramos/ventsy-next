import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getAuthUser, unauthorized, forbidden } from '@/lib/apiAuth'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const admin = supabaseAdmin as any

// Extrai o caminho dentro do bucket a partir da URL pública do Storage.
// Ex.: https://x.supabase.co/storage/v1/object/public/fotos-dashboard/uid/1/abc.jpg
//      → { bucket: 'fotos-dashboard', path: 'uid/1/abc.jpg' }
function pathDaUrl(url: string): { bucket: string; path: string } | null {
  const m = url.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/)
  if (!m) return null
  return { bucket: m[1], path: decodeURIComponent(m[2]) }
}

// DELETE /api/fotos/[id] — remove uma foto do espaço (linha + objeto no Storage).
// Recalcula a capa (propriedades.imagem_url) se a foto removida era a capa.
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getAuthUser(req)
  if (!user) return unauthorized()

  const id = params.id
  if (!id) return Response.json({ error: 'id é obrigatório.' }, { status: 400 })

  const { data: foto } = await admin
    .from('fotos_imovel').select('id, url, propriedade_id').eq('id', id).maybeSingle()
  if (!foto) return Response.json({ error: 'Foto não encontrada.' }, { status: 404 })

  const { data: prop } = await admin
    .from('propriedades').select('id, usuario_id, imagem_url').eq('id', foto.propriedade_id).maybeSingle()
  if (!prop || prop.usuario_id !== user.id) return forbidden()

  // remove o objeto do Storage (best-effort)
  if (foto.url) {
    const loc = pathDaUrl(foto.url)
    if (loc) { try { await admin.storage.from(loc.bucket).remove([loc.path]) } catch { /* noop */ } }
  }

  const { error: delErr } = await admin.from('fotos_imovel').delete().eq('id', id)
  if (delErr) return Response.json({ error: delErr.message }, { status: 500 })

  // se era a capa, recalcula para a próxima foto (menor ordem) ou limpa
  let novaCapa: string | null = prop.imagem_url ?? null
  if (prop.imagem_url && prop.imagem_url === foto.url) {
    const { data: restantes } = await admin
      .from('fotos_imovel').select('url').eq('propriedade_id', foto.propriedade_id).order('ordem', { ascending: true }).limit(1)
    novaCapa = restantes?.[0]?.url ?? null
    await admin.from('propriedades').update({ imagem_url: novaCapa }).eq('id', foto.propriedade_id)
  }

  return Response.json({ ok: true, capa: novaCapa })
}
