// SERVER-ONLY. Entrega de WEBHOOKS de saída: assina (HMAC-SHA256), entrega, loga
// e agenda retentativa em falha. A matemática (corpo canônico, backoff, "deve
// retentar?") vem de lib/integracoes (pura, testada); aqui mora o efeito colateral
// (crypto + fetch + Supabase service-role).
// ─────────────────────────────────────────────────────────────────────────────
// Outras páginas disparam eventos chamando dispararEvento(usuarioId, evento, dados).
// O cron /api/cron/webhooks-retry chama reprocessarPendentes().
//
// ⚠️ Importa supabaseAdmin + node:crypto — JAMAIS importar em 'use client'.

import { createHmac, randomBytes, randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import {
  corpoWebhook, formatarAssinatura, deveRetentar, entregaOk,
  proximaTentativaSegundos, HEADER_ASSINATURA, urlWebhookSegura,
} from '@/lib/integracoes'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const admin = supabaseAdmin as any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Dict = Record<string, any>

const TIMEOUT_MS = 8000

/** Segredo de assinatura de um novo webhook (mostrado uma única vez). */
export const gerarSegredoWebhook = (): string => `whsec_${randomBytes(24).toString('hex')}`

/** Assinatura HMAC-SHA256 do corpo (hex). O receptor recomputa e compara. */
export function assinarCorpo(segredo: string, corpoRaw: string): string {
  return createHmac('sha256', segredo).update(corpoRaw, 'utf8').digest('hex')
}

type Subscricao = { id: string; usuario_id: string; url: string; segredo: string; ativo?: boolean }

/** Entrega uma vez: assina, faz POST, registra no log e agenda retentativa. */
async function entregarWebhook(sub: Subscricao, evento: string, dados: unknown, tentativa: number): Promise<{ ok: boolean; status: number }> {
  const deliveryId = randomUUID()
  const corpo = corpoWebhook(deliveryId, evento, new Date().toISOString(), dados)
  const raw = JSON.stringify(corpo)
  const assinatura = formatarAssinatura(assinarCorpo(sub.segredo, raw))

  // Anti-SSRF: nunca entrega para host interno/privado (defesa em profundidade,
  // mesmo que a URL tenha sido cadastrada antes da validação de entrada).
  if (!urlWebhookSegura(sub.url)) {
    await admin.from('integracoes_webhooks_log').insert({
      usuario_id: sub.usuario_id, webhook_id: sub.id, evento, tentativa,
      http_status: 0, ok: false, erro: 'URL bloqueada (host interno/privado)',
      payload: corpo, proxima_tentativa_em: null,
    })
    return { ok: false, status: 0 }
  }

  let status = 0
  let erro: string | null = null
  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
    const resp = await fetch(sub.url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'user-agent': 'Ventsy-Webhooks/1',
        'x-ventsy-event': evento,
        'x-ventsy-delivery': deliveryId,
        [HEADER_ASSINATURA]: assinatura,
      },
      body: raw,
      signal: ctrl.signal,
    })
    clearTimeout(timer)
    status = resp.status
    if (!entregaOk(status)) erro = `HTTP ${status}`
  } catch (e) {
    status = 0
    erro = (e as Error)?.name === 'AbortError' ? 'timeout' : (e as Error)?.message || 'erro de rede'
  }

  const ok = entregaOk(status)
  const proxima = !ok && deveRetentar(status, tentativa)
    ? new Date(Date.now() + (proximaTentativaSegundos(tentativa) || 0) * 1000).toISOString()
    : null

  await admin.from('integracoes_webhooks_log').insert({
    usuario_id: sub.usuario_id, webhook_id: sub.id, evento, tentativa,
    http_status: status, ok, erro, payload: corpo, proxima_tentativa_em: proxima,
  })
  await admin.from('integracoes_webhooks').update({ ultimo_status: status, ultimo_em: new Date().toISOString() }).eq('id', sub.id)
  return { ok, status }
}

/** Dispara um evento para todas as assinaturas ativas do dono. Best-effort. */
export async function dispararEvento(usuarioId: string, evento: string, dados: unknown): Promise<{ total: number; entregues: number }> {
  const { data: subs } = await admin
    .from('integracoes_webhooks')
    .select('id, usuario_id, url, segredo')
    .eq('usuario_id', usuarioId).eq('evento', evento).eq('ativo', true)
  let entregues = 0
  for (const s of (subs || []) as Subscricao[]) {
    const r = await entregarWebhook(s, evento, dados, 1)
    if (r.ok) entregues++
  }
  return { total: subs?.length || 0, entregues }
}

/** Entrega de teste (botão "testar" na UI). Loga como qualquer entrega. */
export async function entregarTeste(sub: Subscricao, evento: string): Promise<{ ok: boolean; status: number }> {
  return entregarWebhook(sub, evento, { teste: true, mensagem: 'Entrega de teste da Central de Integrações Ventsy.' }, 1)
}

/** Cron: reprocessa entregas que falharam e já estão na hora de retentar. */
export async function reprocessarPendentes(limite = 50): Promise<{ pendentes: number; reentregues: number }> {
  const { data: pend } = await admin
    .from('integracoes_webhooks_log')
    .select('id, webhook_id, evento, tentativa, payload')
    .eq('ok', false).not('proxima_tentativa_em', 'is', null)
    .lte('proxima_tentativa_em', new Date().toISOString())
    .order('proxima_tentativa_em', { ascending: true })
    .limit(limite)

  let reentregues = 0
  for (const log of (pend || []) as Dict[]) {
    // A tentativa anterior não deve mais ser elegível (evita reprocesso duplo).
    await admin.from('integracoes_webhooks_log').update({ proxima_tentativa_em: null }).eq('id', log.id)
    const { data: sub } = await admin
      .from('integracoes_webhooks').select('id, usuario_id, url, segredo, ativo').eq('id', log.webhook_id).maybeSingle()
    if (!sub || !sub.ativo) continue
    const dados = (log.payload as Dict)?.dados ?? {}
    const r = await entregarWebhook(sub as Subscricao, log.evento, dados, (log.tentativa || 1) + 1)
    if (r.ok) reentregues++
  }
  return { pendentes: pend?.length || 0, reentregues }
}
