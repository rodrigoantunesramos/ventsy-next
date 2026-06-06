import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getAuthUser, unauthorized, forbidden } from '@/lib/apiAuth'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const admin = supabaseAdmin as any

const BUCKET = 'fotos-dashboard'

// Confirma que a propriedade pertence ao usuário autenticado.
// Retorna a propriedade (id, usuario_id, imagem_url) ou null.
async function donoDaPropriedade(propriedadeId: number, userId: string) {
  const { data: prop } = await admin
    .from('propriedades')
    .select('id, usuario_id, imagem_url')
    .eq('id', propriedadeId)
    .maybeSingle()
  if (!prop || prop.usuario_id !== userId) return null
  return prop
}

// POST /api/fotos — upload de uma ou mais fotos (já comprimidas no browser) de
// um espaço do anfitrião. multipart/form-data: { propriedadeId, files[] }.
// Sobe pro Storage e grava as linhas em fotos_imovel (ordem ao final da lista).
export async function POST(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return unauthorized()

  let form: FormData
  try { form = await req.formData() } catch { return Response.json({ error: 'Formato inválido.' }, { status: 400 }) }

  const propriedadeId = Number(form.get('propriedadeId'))
  if (!propriedadeId) return Response.json({ error: 'propriedadeId é obrigatório.' }, { status: 400 })

  const prop = await donoDaPropriedade(propriedadeId, user.id)
  if (!prop) return forbidden()

  const files = form.getAll('files').filter((f): f is File => f instanceof File && f.size > 0)
  if (files.length === 0) return Response.json({ error: 'Nenhum arquivo enviado.' }, { status: 400 })

  // próxima ordem = fim da lista atual
  const { data: existentes } = await admin
    .from('fotos_imovel').select('id, ordem, url').eq('propriedade_id', propriedadeId).order('ordem', { ascending: true })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let nextOrdem = existentes?.length ? Math.max(...existentes.map((f: any) => f.ordem ?? 0)) + 1 : 0

  const inseridas: unknown[] = []
  const erros: string[] = []

  for (const file of files) {
    try {
      const buf = Buffer.from(await file.arrayBuffer())
      const ext = (file.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg')
      const path = `${user.id}/${propriedadeId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`

      const { error: upErr } = await admin.storage.from(BUCKET).upload(path, buf, {
        contentType: file.type || 'image/jpeg',
        cacheControl: '3600',
        upsert: false,
      })
      if (upErr) { erros.push(upErr.message); continue }

      const url = admin.storage.from(BUCKET).getPublicUrl(path).data.publicUrl

      const { data: row, error: insErr } = await admin
        .from('fotos_imovel')
        .insert({ propriedade_id: propriedadeId, url, ordem: nextOrdem, tipo: 'espaco', secao: 'galeria' })
        .select('*')
        .single()
      if (insErr) { erros.push(insErr.message); continue }

      inseridas.push(row)
      nextOrdem++
    } catch (e) {
      erros.push(e instanceof Error ? e.message : 'Falha no upload.')
    }
  }

  // garante uma capa: se a propriedade não tinha imagem_url, usa a foto de menor ordem
  if (!prop.imagem_url) {
    const cover = existentes?.[0]?.url || (inseridas[0] as { url?: string } | undefined)?.url
    if (cover) await admin.from('propriedades').update({ imagem_url: cover }).eq('id', propriedadeId)
  }

  if (inseridas.length === 0) return Response.json({ error: erros[0] || 'Falha ao enviar as fotos.' }, { status: 500 })
  return Response.json({ fotos: inseridas, erros })
}

// PATCH /api/fotos — reordena as fotos do espaço (e define a capa = primeira).
// JSON: { propriedadeId, ordem: string[] (ids de fotos_imovel na ordem desejada) }.
export async function PATCH(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return unauthorized()

  const { propriedadeId, ordem } = await req.json()
  const pid = Number(propriedadeId)
  if (!pid || !Array.isArray(ordem) || ordem.length === 0) {
    return Response.json({ error: 'propriedadeId e ordem[] são obrigatórios.' }, { status: 400 })
  }

  const prop = await donoDaPropriedade(pid, user.id)
  if (!prop) return forbidden()

  // valida que todos os ids pertencem à propriedade
  const { data: fotos } = await admin.from('fotos_imovel').select('id, url').eq('propriedade_id', pid)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const validos = new Set((fotos || []).map((f: any) => String(f.id)))
  if (!ordem.every((id: string) => validos.has(String(id)))) {
    return Response.json({ error: 'Lista de ordem inválida.' }, { status: 400 })
  }

  for (let i = 0; i < ordem.length; i++) {
    await admin.from('fotos_imovel').update({ ordem: i }).eq('id', ordem[i])
  }

  // capa = primeira da lista → sincroniza propriedades.imagem_url
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const capaUrl = (fotos || []).find((f: any) => String(f.id) === String(ordem[0]))?.url
  if (capaUrl) await admin.from('propriedades').update({ imagem_url: capaUrl }).eq('id', pid)

  return Response.json({ ok: true, capa: capaUrl || null })
}
