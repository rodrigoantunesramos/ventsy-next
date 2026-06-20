import { NextRequest } from 'next/server'
import { getAuthUser, unauthorized } from '@/lib/apiAuth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { gerarSegredoWebhook } from '@/lib/webhooksServer'
import { EVENTOS_WEBHOOK_SET, mascararTail, urlWebhookSegura } from '@/lib/integracoes'

// Webhooks de saída: assina eventos do sistema e entrega numa URL do dono. Toda
// leitura é MASCARADA (o segredo de assinatura só aparece UMA vez, ao criar).
// A entrega assinada (HMAC) + retentativa vivem em lib/webhooksServer.ts.

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const admin = supabaseAdmin as any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Dict = Record<string, any>

// Aceita https público (e http://localhost só em dev); bloqueia hosts internos/privados (anti-SSRF).
const urlValida = (u: unknown): boolean => urlWebhookSegura(u, process.env.NODE_ENV !== 'production')

function mascarar(w: Dict) {
  return {
    id: w.id, evento: w.evento, url: w.url, ativo: w.ativo, descricao: w.descricao,
    segredo_last4: mascararTail(w.segredo), ultimo_status: w.ultimo_status, ultimo_em: w.ultimo_em, criado_em: w.criado_em,
  }
}

// GET — assinaturas (mascaradas) + log recente de entregas/retentativas.
export async function GET(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return unauthorized()
  const [whs, logs] = await Promise.all([
    admin.from('integracoes_webhooks').select('*').eq('usuario_id', user.id).order('criado_em', { ascending: false }),
    admin.from('integracoes_webhooks_log')
      .select('id, webhook_id, evento, tentativa, http_status, ok, erro, proxima_tentativa_em, criado_em')
      .eq('usuario_id', user.id).order('criado_em', { ascending: false }).limit(40),
  ])
  return Response.json({ webhooks: ((whs.data as Dict[]) || []).map(mascarar), log: logs.data || [] })
}

// POST — cria assinatura. body { evento, url, descricao }. Retorna o segredo 1x.
export async function POST(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return unauthorized()
  const b = await req.json().catch(() => ({}))
  const evento = String(b?.evento || '')
  const url = String(b?.url || '').trim()
  if (!EVENTOS_WEBHOOK_SET.has(evento)) return Response.json({ error: 'Evento inválido.' }, { status: 400 })
  if (!urlValida(url)) return Response.json({ error: 'Informe uma URL https válida.' }, { status: 400 })

  const segredo = gerarSegredoWebhook()
  const { data, error } = await admin.from('integracoes_webhooks').insert({
    usuario_id: user.id, evento, url, segredo, descricao: (b?.descricao || '').toString().trim() || null, ativo: true,
  }).select('*').single()
  if (error) return Response.json({ error: error.message }, { status: 500 })
  // segredo em texto puro APENAS aqui (para o dono validar a assinatura no destino).
  return Response.json({ ok: true, webhook: mascarar(data), segredo })
}

// PATCH — atualiza (ativo/url/evento/descricao). body { id, ...campos }.
export async function PATCH(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return unauthorized()
  const b = await req.json().catch(() => ({}))
  const id = String(b?.id || '')
  if (!id) return Response.json({ error: 'id obrigatório.' }, { status: 400 })
  const patch: Dict = {}
  if (typeof b.ativo === 'boolean') patch.ativo = b.ativo
  if (b.url !== undefined) { if (!urlValida(b.url)) return Response.json({ error: 'URL inválida.' }, { status: 400 }); patch.url = String(b.url).trim() }
  if (b.evento !== undefined) { if (!EVENTOS_WEBHOOK_SET.has(String(b.evento))) return Response.json({ error: 'Evento inválido.' }, { status: 400 }); patch.evento = String(b.evento) }
  if (b.descricao !== undefined) patch.descricao = (b.descricao || '').toString().trim() || null
  if (Object.keys(patch).length === 0) return Response.json({ error: 'Nada para atualizar.' }, { status: 400 })

  const { data, error } = await admin.from('integracoes_webhooks').update(patch).eq('id', id).eq('usuario_id', user.id).select('*').single()
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true, webhook: mascarar(data) })
}

// DELETE — remove a assinatura (cascata no log). ?id= ou body { id }.
export async function DELETE(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return unauthorized()
  let id = new URL(req.url).searchParams.get('id') || ''
  if (!id) { const b = await req.json().catch(() => ({})); id = String(b?.id || '') }
  if (!id) return Response.json({ error: 'id obrigatório.' }, { status: 400 })
  await admin.from('integracoes_webhooks').delete().eq('id', id).eq('usuario_id', user.id)
  return Response.json({ ok: true })
}
