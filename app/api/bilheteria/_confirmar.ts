// Confirmação AUTORITATIVA de um pedido de ingresso (pago).
// ─────────────────────────────────────────────────────────────────────────────
// Reusado por:
//   • /api/bilheteria/checkout — pedidos gratuitos (total 0: cortesia/cupom 100%)
//     são confirmados na hora, sem passar pelo Mercado Pago.
//   • /api/bilheteria/webhook  — quando o MP aprova o pagamento.
//
// É IDEMPOTENTE (o MP reenvia notificações): se o pedido já está pago, não
// duplica ingressos, credenciais, lançamento nem e-mail. Ao confirmar:
//   1) pedido  → 'pago' (+ pago_em, mp_*),
//   2) ingressos do pedido → 'pago' (revive até 'cancelado' por expiração tardia),
//   3) emite uma CREDENCIAL por ingresso (QR = o mesmo do ingresso) para o
//      check-in da Portaria em /painel/acesso — best-effort,
//   4) lança a RECEITA no Financeiro (lancamentos, categoria 'Bilheteria') —
//      idempotente por pedido_ingresso_id,
//   5) incrementa `usados` do cupom (se houver),
//   6) envia o e-mail com os ingressos + QR (best-effort; no-op sem SMTP).

import { sendEmail } from '@/lib/email'
import { qrSvgString } from '@/lib/qrcode'
import { gerarQrPayload } from '@/lib/bilheteria'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin = any

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Mapeia a categoria do ingresso para um tipo de credencial do /painel/acesso.
function tipoCredencial(_categoriaNome: string): string {
  return 'convidado'
}

type IngRow = {
  id: string; categoria_id: string; comprador_nome: string | null; comprador_doc: string | null
  email: string | null; qr_token: string; credencial_id: string | null; status: string
}

export type ConfirmacaoResultado = {
  ok: boolean
  jaPago?: boolean
  pedido_id: string
  ingressos?: number
  error?: string
}

export async function confirmarPedido(
  admin: Admin,
  args: { pedidoId: string; mpPaymentId?: string | null; mpStatus?: string | null; metodo?: string | null },
): Promise<ConfirmacaoResultado> {
  const { pedidoId } = args
  const { data: pedido } = await admin.from('pedidos_ingresso').select('*').eq('id', pedidoId).maybeSingle()
  if (!pedido) return { ok: false, pedido_id: pedidoId, error: 'pedido_nao_encontrado' }

  // Idempotência: já confirmado → não repete os efeitos colaterais.
  if (pedido.status === 'pago') {
    if (args.mpPaymentId && !pedido.mp_payment_id) {
      await admin.from('pedidos_ingresso').update({ mp_payment_id: args.mpPaymentId, mp_status: args.mpStatus || 'approved' }).eq('id', pedidoId)
    }
    return { ok: true, jaPago: true, pedido_id: pedidoId }
  }

  const agoraIso = new Date().toISOString()
  const { data: bilh } = await admin.from('bilheteria_eventos').select('evento_id, titulo, pagina_token, local_texto').eq('id', pedido.bilheteria_id).maybeSingle()

  // 1) pedido → pago
  await admin.from('pedidos_ingresso').update({
    status: 'pago',
    pago_em: agoraIso,
    mp_payment_id: args.mpPaymentId ?? pedido.mp_payment_id ?? null,
    mp_status: args.mpStatus ?? (args.mpPaymentId ? 'approved' : pedido.mp_status) ?? null,
  }).eq('id', pedidoId)

  // 2) ingressos → pagos (revive 'cancelado' por expiração tardia: o comprador
  //    realmente pagou — melhor entregar do que cobrar sem ingresso). O trigger
  //    recalcula `vendido`.
  const { data: ingressos } = await admin
    .from('ingressos')
    .select('id, categoria_id, comprador_nome, comprador_doc, email, qr_token, credencial_id, status')
    .eq('pedido_id', pedidoId)
  const lista = (ingressos || []) as IngRow[]
  const aPagar = lista.filter((i) => i.status !== 'pago' && i.status !== 'checkin')
  if (aPagar.length) {
    await admin.from('ingressos').update({ status: 'pago' }).in('id', aPagar.map((i) => i.id))
  }

  // 3) Credenciais para o check-in na Portaria (/painel/acesso) — best-effort.
  const catNome = new Map<string, string>()
  try {
    const eventoId = bilh?.evento_id || null
    const semCredencial = lista.filter((i) => !i.credencial_id)
    const catIds = Array.from(new Set(semCredencial.map((i) => i.categoria_id)))
    if (catIds.length) {
      const { data: cats } = await admin.from('ingressos_categorias').select('id, nome').in('id', catIds)
      for (const c of (cats || []) as { id: string; nome: string }[]) catNome.set(c.id, c.nome)
    }
    for (const ing of semCredencial) {
      const { data: cred, error } = await admin.from('credenciais').insert({
        usuario_id: pedido.usuario_id, evento_id: eventoId, tipo: tipoCredencial(catNome.get(ing.categoria_id) || ''),
        nome: ing.comprador_nome || pedido.comprador_nome || 'Portador', doc: ing.comprador_doc || null,
        categoria_ingresso_id: ing.categoria_id, qr_token: ing.qr_token, zonas: [], status: 'emitida',
      }).select('id').maybeSingle()
      if (!error && cred?.id) await admin.from('ingressos').update({ credencial_id: cred.id }).eq('id', ing.id)
    }
  } catch {
    /* módulo de acesso ausente — segue sem credencial */
  }

  // 4) Receita no Financeiro (idempotente por pedido_ingresso_id).
  try {
    const valor = Number(pedido.total_num) || 0
    if (valor > 0) {
      const { data: jaLancado } = await admin.from('lancamentos').select('id').eq('pedido_ingresso_id', pedidoId).maybeSingle()
      if (!jaLancado) {
        let tipoEvento: string | null = null
        if (bilh?.evento_id) {
          const { data: ev } = await admin.from('clientes_eventos').select('tipo_evento').eq('id', bilh.evento_id).maybeSingle()
          tipoEvento = ev?.tipo_evento || null
        }
        await admin.from('lancamentos').insert({
          usuario_id: pedido.usuario_id, tipo: 'receita', categoria: 'Bilheteria',
          descricao: `Ingressos — ${bilh?.titulo || 'evento'} · pedido ${String(pedidoId).slice(0, 8)}`,
          tipo_evento: tipoEvento, valor, status: 'pago', data: ymd(new Date()),
          metodo_pagamento: args.metodo || 'Mercado Pago', pedido_ingresso_id: pedidoId,
        })
      }
    }
  } catch {
    /* schema de lancamentos divergente — não bloqueia a confirmação */
  }

  // 5) Cupom: incrementa usados.
  if (pedido.cupom_id) {
    try {
      const { data: cup } = await admin.from('bilheteria_cupons').select('usados').eq('id', pedido.cupom_id).maybeSingle()
      await admin.from('bilheteria_cupons').update({ usados: (Number(cup?.usados) || 0) + 1 }).eq('id', pedido.cupom_id)
    } catch { /* cupom removido — ignora */ }
  }

  // 6) E-mail com os ingressos + QR (best-effort; no-op sem SMTP).
  if (pedido.comprador_email) {
    try {
      if (!catNome.size) {
        const catIds = Array.from(new Set(lista.map((i) => i.categoria_id)))
        if (catIds.length) {
          const { data: cats } = await admin.from('ingressos_categorias').select('id, nome').in('id', catIds)
          for (const c of (cats || []) as { id: string; nome: string }[]) catNome.set(c.id, c.nome)
        }
      }
      await sendEmail({
        to: pedido.comprador_email,
        subject: `Seus ingressos — ${bilh?.titulo || 'evento'}`,
        html: emailIngressosHtml(pedido, bilh, lista, catNome),
      })
    } catch {
      /* falha de e-mail não derruba a confirmação */
    }
  }

  return { ok: true, pedido_id: pedidoId, ingressos: aPagar.length }
}

// ── E-mail dos ingressos (HTML simples, com QR inline + link) ────────────────
function emailIngressosHtml(
  pedido: { comprador_nome: string; pagina_token?: string; id: string },
  bilh: { titulo?: string; pagina_token?: string; local_texto?: string | null } | null,
  ingressos: IngRow[],
  catNome: Map<string, string>,
): string {
  const origin = (process.env.NEXT_PUBLIC_SITE_URL || 'https://ventsy.com.br').replace(/\/$/, '')
  const link = bilh?.pagina_token ? `${origin}/ingressos/${bilh.pagina_token}?pedido=${pedido.id}` : `${origin}`
  const cards = ingressos.map((i) => {
    const svg = qrSvgString(gerarQrPayload(i.qr_token), { size: 150 })
    const dataUri = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`
    return `<tr><td style="padding:12px 0;border-bottom:1px solid #eee;">
      <table role="presentation" width="100%"><tr>
        <td style="vertical-align:middle;"><div style="font-size:16px;font-weight:700;color:#18181b;">${esc(catNome.get(i.categoria_id) || 'Ingresso')}</div>
          ${i.comprador_nome ? `<div style="font-size:13px;color:#52525b;margin-top:2px;">${esc(i.comprador_nome)}</div>` : ''}</td>
        <td style="width:120px;text-align:right;"><img src="${dataUri}" width="110" height="110" alt="QR" style="border:1px solid #eee;border-radius:8px;"/></td>
      </tr></table></td></tr>`
  }).join('')
  return `<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;padding:24px;">
    <div style="font-size:22px;font-weight:800;color:#ff385c;font-style:italic;">VENTSY</div>
    <h1 style="font-size:20px;color:#18181b;margin:16px 0 4px;">Seus ingressos estão confirmados! 🎉</h1>
    <p style="color:#52525b;font-size:14px;">${esc(bilh?.titulo || 'Evento')}${bilh?.local_texto ? ` · ${esc(bilh.local_texto)}` : ''}</p>
    <p style="color:#52525b;font-size:14px;">Olá, ${esc(pedido.comprador_nome)}! Apresente o QR de cada ingresso na entrada.</p>
    <table role="presentation" width="100%" style="margin-top:12px;">${cards}</table>
    <a href="${link}" style="display:inline-block;margin-top:18px;background:#ff385c;color:#fff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:700;">Ver meus ingressos</a>
    <p style="color:#a1a1aa;font-size:12px;margin-top:20px;">Pedido ${pedido.id.slice(0, 8).toUpperCase()} · Ventsy</p>
  </div>`
}

function esc(s: string): string {
  return (s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))
}
