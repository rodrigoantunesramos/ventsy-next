import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getAuthUser, unauthorized, forbidden } from '@/lib/apiAuth'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const admin = supabaseAdmin as any

const BUCKET = 'fotos-dashboard'

// Limite de fotos do ESPAÇO (galeria) por plano. null = ilimitado.
const LIMITES: Record<string, number | null> = { basico: 5, pro: null, ultra: null }

async function planoDoUsuario(userId: string): Promise<string> {
  try {
    const { data } = await admin
      .from('assinaturas').select('plano_ativo,status')
      .eq('usuario_id', userId).in('status', ['ativa', 'trial']).maybeSingle()
    const p = (data?.plano_ativo || 'basico').toString().toLowerCase()
    return ['basico', 'pro', 'ultra'].includes(p) ? p : 'basico'
  } catch { return 'basico' }
}

// Confirma que a propriedade pertence ao usuário autenticado.
async function donoDaPropriedade(propriedadeId: number, userId: string) {
  const { data: prop } = await admin
    .from('propriedades')
    .select('id, usuario_id, imagem_url')
    .eq('id', propriedadeId)
    .maybeSingle()
  if (!prop || prop.usuario_id !== userId) return null
  return prop
}

// POST /api/fotos — upload multipart { propriedadeId, files[], tipo?, secao? }.
// tipo: 'espaco' (galeria) | 'evento' (cards de destaque). secao: categoria/ambiente.
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

  const tipo = ((form.get('tipo') as string) || 'espaco').trim()
  const secao = ((form.get('secao') as string) || (tipo === 'evento' ? 'Eventos' : 'Geral')).trim()

  // próxima ordem = fim da lista atual
  const { data: existentes } = await admin
    .from('fotos_imovel').select('id, ordem, url, tipo').eq('propriedade_id', propriedadeId).order('ordem', { ascending: true })

  // Limite por plano — só conta a galeria do espaço
  if (tipo === 'espaco') {
    const plano = await planoDoUsuario(prop.usuario_id)
    const limite = LIMITES[plano]
    if (limite != null) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const atuais = (existentes || []).filter((f: any) => !f.tipo || f.tipo === 'espaco').length
      if (atuais + files.length > limite) {
        return Response.json(
          { error: `Seu plano ${plano} permite até ${limite} fotos do espaço. Faça upgrade para adicionar mais.`, code: 'LIMITE_PLANO', limite, atuais },
          { status: 403 },
        )
      }
    }
  }

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
        .insert({ propriedade_id: propriedadeId, url, ordem: nextOrdem, tipo, secao })
        .select('*')
        .single()
      if (insErr) { erros.push(insErr.message); continue }

      inseridas.push(row)
      nextOrdem++
    } catch (e) {
      erros.push(e instanceof Error ? e.message : 'Falha no upload.')
    }
  }

  // garante uma capa (só fotos do espaço): se a propriedade não tinha imagem_url
  if (tipo === 'espaco' && !prop.imagem_url) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const primeiraEspaco = (existentes || []).find((f: any) => !f.tipo || f.tipo === 'espaco')?.url
    const cover = primeiraEspaco || (inseridas[0] as { url?: string } | undefined)?.url
    if (cover) await admin.from('propriedades').update({ imagem_url: cover }).eq('id', propriedadeId)
  }

  if (inseridas.length === 0) return Response.json({ error: erros[0] || 'Falha ao enviar as fotos.' }, { status: 500 })
  return Response.json({ fotos: inseridas, erros })
}

// PATCH /api/fotos —
//  • Reordenar:        { propriedadeId, ordem: string[] }  (capa = primeira)
//  • Atualizar seção:  { fotoId, secao }
export async function PATCH(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return unauthorized()

  const body = await req.json()

  // ── Atualizar a seção de uma foto ──
  if (body.fotoId && typeof body.secao === 'string') {
    const { data: foto } = await admin.from('fotos_imovel').select('id, propriedade_id').eq('id', body.fotoId).maybeSingle()
    if (!foto) return Response.json({ error: 'Foto não encontrada.' }, { status: 404 })
    const prop = await donoDaPropriedade(Number(foto.propriedade_id), user.id)
    if (!prop) return forbidden()
    const { error } = await admin.from('fotos_imovel').update({ secao: body.secao }).eq('id', body.fotoId)
    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ ok: true })
  }

  // ── Reordenar ──
  const { propriedadeId, ordem } = body
  const pid = Number(propriedadeId)
  if (!pid || !Array.isArray(ordem) || ordem.length === 0) {
    return Response.json({ error: 'propriedadeId e ordem[] são obrigatórios.' }, { status: 400 })
  }

  const prop = await donoDaPropriedade(pid, user.id)
  if (!prop) return forbidden()

  const { data: fotos } = await admin.from('fotos_imovel').select('id, url, tipo').eq('propriedade_id', pid)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const validos = new Set((fotos || []).map((f: any) => String(f.id)))
  if (!ordem.every((id: string) => validos.has(String(id)))) {
    return Response.json({ error: 'Lista de ordem inválida.' }, { status: 400 })
  }

  for (let i = 0; i < ordem.length; i++) {
    await admin.from('fotos_imovel').update({ ordem: i }).eq('id', ordem[i])
  }

  // capa = primeira foto do ESPAÇO na nova ordem
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const byId = new Map((fotos || []).map((f: any) => [String(f.id), f]))
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const capaId = (ordem as string[]).find((id) => { const f = byId.get(String(id)) as any; return f && (!f.tipo || f.tipo === 'espaco') })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const capaUrl = capaId ? (byId.get(String(capaId)) as any)?.url : undefined
  if (capaUrl) await admin.from('propriedades').update({ imagem_url: capaUrl }).eq('id', pid)

  return Response.json({ ok: true, capa: capaUrl || null })
}
