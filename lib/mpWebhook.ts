// ⚠️ SERVER-ONLY. Validação da assinatura (x-signature) dos webhooks do Mercado Pago.
// O MP assina cada notificação com HMAC-SHA256 sobre um "manifest", usando a chave
// secreta da aplicação (painel MP → suas integrações → Webhooks → assinatura secreta).
// Sem isso, qualquer um poderia POSTar no endpoint forjando notificações.
//
// Defesa em profundidade: as rotas SEMPRE reconsultam o status real na API do MP — esta
// verificação rejeita o forjado ANTES disso (corta forja/replay/DoS e chamadas inúteis à
// API do MP). NUNCA importar em 'use client'.

import crypto from 'node:crypto'

export type ResultadoAssinatura = 'valida' | 'invalida' | 'sem_chave'

// Chave secreta de webhook (env, fora do banco). Definir na Vercel + .env.local.
function segredo(): string | null {
  return process.env.MP_WEBHOOK_SECRET || null
}

// Header x-signature = "ts=<ts>,v1=<hmac_hex>" (ordem/pares podem variar).
function parseAssinatura(header: string | null): { ts: string; v1: string } | null {
  if (!header) return null
  let ts = '', v1 = ''
  for (const parte of header.split(',')) {
    const i = parte.indexOf('=')
    if (i < 0) continue
    const k = parte.slice(0, i).trim()
    const v = parte.slice(i + 1).trim()
    if (k === 'ts') ts = v
    else if (k === 'v1') v1 = v
  }
  return ts && v1 ? { ts, v1 } : null
}

// Manifest exatamente como o MP especifica: "id:<data.id>;request-id:<x-request-id>;ts:<ts>;".
// Segmentos sem valor são omitidos; o `data.id` é o da QUERY da notification_url.
function montarManifest(dataId: string | null, requestId: string | null, ts: string): string {
  let m = ''
  if (dataId) m += `id:${dataId};`
  if (requestId) m += `request-id:${requestId};`
  m += `ts:${ts};`
  return m
}

/**
 * Verifica a assinatura HMAC de um webhook do Mercado Pago.
 * - 'sem_chave': MP_WEBHOOK_SECRET não configurada → caller degrada (segue só com a
 *   reconsulta à API do MP). A proteção liga sozinha quando a chave é definida.
 * - 'valida' | 'invalida': resultado da checagem HMAC.
 *
 * `dataId` deve ser o `data.id` da QUERY da URL (não do corpo). NÃO rejeitamos por idade
 * do `ts`: o MP reenvia notificações por horas/dias (rejeitar quebraria o retry legítimo),
 * o `ts` já está dentro do conteúdo assinado (não dá pra adulterar sem quebrar o HMAC), e
 * replay é contido pela idempotência dos handlers + reconsulta à API do MP.
 */
export function verificarAssinaturaMP(opts: {
  xSignature: string | null
  xRequestId: string | null
  dataId: string | null
}): ResultadoAssinatura {
  const chave = segredo()
  if (!chave) return 'sem_chave'

  const sig = parseAssinatura(opts.xSignature)
  if (!sig) return 'invalida'

  // Regra do MP: data.id alfanumérico entra em minúsculo no manifest.
  const dataId = opts.dataId && /[a-zA-Z]/.test(opts.dataId) ? opts.dataId.toLowerCase() : opts.dataId
  const manifest = montarManifest(dataId, opts.xRequestId, sig.ts)
  const esperado = crypto.createHmac('sha256', chave).update(manifest).digest('hex')

  // Comparação em tempo constante; tamanhos diferentes (ex.: v1 não-hex) → inválido.
  const a = Buffer.from(esperado, 'hex')
  const b = Buffer.from(sig.v1, 'hex')
  if (a.length === 0 || a.length !== b.length) return 'invalida'
  return crypto.timingSafeEqual(a, b) ? 'valida' : 'invalida'
}

/** Açúcar p/ as rotas: lê x-signature/x-request-id dos headers e data.id da query. */
export function verificarWebhookMP(req: Request): ResultadoAssinatura {
  const url = new URL(req.url)
  return verificarAssinaturaMP({
    xSignature: req.headers.get('x-signature'),
    xRequestId: req.headers.get('x-request-id'),
    dataId: url.searchParams.get('data.id') || url.searchParams.get('id'),
  })
}
