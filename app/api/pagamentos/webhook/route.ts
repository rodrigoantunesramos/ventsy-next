import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { ativarAssinatura } from '@/lib/assinatura'
import { baixarParcela, resolverTokenMpDono } from '@/lib/portalServer'
import { registrarAuditoria } from '@/lib/auditServer'
import { verificarWebhookMP } from '@/lib/mpWebhook'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const admin = supabaseAdmin as any

// Webhook do Mercado Pago (notificação de pagamento).
// Não confia no corpo: busca o status real na API do MP e atualiza
// reservas + pagamentos. Cobre split (token do anfitrião) e plataforma.
// Configure a URL no painel MP: https://www.ventsy.com.br/api/pagamentos/webhook
export async function POST(req: NextRequest) {
  // V-05: rejeita notificações forjadas via HMAC do MP (x-signature). Degrada se
  // MP_WEBHOOK_SECRET ausente — a reconsulta à API do MP segue como validação efetiva.
  const assinatura = verificarWebhookMP(req)
  if (assinatura === 'invalida') return Response.json({ error: 'assinatura inválida' }, { status: 401 })
  if (assinatura === 'sem_chave') console.warn('[MP webhook pagamentos] MP_WEBHOOK_SECRET ausente — assinatura não verificada')

  let paymentId: string | null = null
  try {
    const body = await req.json()
    paymentId = body?.data?.id != null ? String(body.data.id) : null
    // ignora notificações que não são de pagamento
    if (body?.type && body.type !== 'payment' && body?.topic !== 'payment') {
      return Response.json({ ok: true })
    }
  } catch {
    /* corpo vazio — tenta query string abaixo */
  }
  if (!paymentId) {
    const u = new URL(req.url)
    paymentId = u.searchParams.get('data.id') || u.searchParams.get('id')
  }
  if (!paymentId) return Response.json({ ok: true })

  try {
    // localiza nosso registro p/ achar a reserva e o anfitrião (define o token)
    const { data: pag } = await admin
      .from('pagamentos')
      .select('reserva_id, plano_id, usuario_id, meses, valor, parcela_id')
      .eq('mp_payment_id', paymentId)
      .maybeSingle()

    let token = process.env.MERCADOPAGO_ACCESS_TOKEN
    if (pag?.reserva_id) {
      const { data: reserva } = await admin.from('reservas').select('host_id').eq('id', pag.reserva_id).maybeSingle()
      if (reserva?.host_id) {
        const { data: hm } = await admin.from('host_mp').select('mp_access_token, conectado').eq('usuario_id', reserva.host_id).maybeSingle()
        if (hm?.conectado && hm?.mp_access_token) token = hm.mp_access_token
      }
    } else if (pag?.parcela_id && pag?.usuario_id) {
      // Pagamento de parcela via Portal do Cliente — usa o MP do dono se conectado.
      const r = await resolverTokenMpDono(pag.usuario_id)
      if (r.token) token = r.token
    }
    if (!token) return Response.json({ ok: true })

    const resp = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const pay = await resp.json()
    const status: string | undefined = pay?.status
    if (!status) return Response.json({ ok: true })

    // atualiza o recibo
    await admin
      .from('pagamentos')
      .update({ status, mp_status: status, mp_status_detail: pay?.status_detail, atualizado_em: new Date().toISOString() })
      .eq('mp_payment_id', paymentId)

    // confirma quando aprovado: parcela (portal) → baixa; assinatura → ativa; reserva → paga
    if (status === 'approved') {
      const ext = pay?.external_reference ? String(pay.external_reference) : ''
      if (pag?.parcela_id || ext.startsWith('parcela:')) {
        const parcelaId = pag?.parcela_id ?? ext.slice('parcela:'.length)
        if (parcelaId) await baixarParcela(parcelaId, { metodo: 'Pix (Portal)' })
      } else if (pag?.plano_id && pag?.usuario_id) {
        await ativarAssinatura({
          usuario_id: pag.usuario_id,
          plano: pag.plano_id,
          meses: pag.meses || 1,
          valor: Number(pag.valor) || 0,
          mp_payment_id: paymentId,
        })
      } else {
        const reservaId = pag?.reserva_id || (ext && !ext.startsWith('plano:') ? ext : null)
        if (reservaId) await admin.from('reservas').update({ status: 'paga' }).eq('id', reservaId)
      }
    }

    // Trilha de auditoria do pagamento (entidade sensível) — registra qualquer status.
    await registrarAuditoria({
      req, contaId: pag?.usuario_id ?? null,
      acao: 'pagamento', entidade: 'pagamento', entidadeId: paymentId, sensivel: true,
      descricao: `Pagamento Mercado Pago: ${status}`,
      meta: {
        external_reference: pay?.external_reference ?? null,
        reserva_id: pag?.reserva_id ?? null, parcela_id: pag?.parcela_id ?? null, plano_id: pag?.plano_id ?? null,
      },
    })
  } catch {
    /* responde ok mesmo assim — o MP reenvia se precisar */
  }

  return Response.json({ ok: true })
}

// O MP às vezes faz um GET de validação da URL.
export async function GET() {
  return Response.json({ ok: true })
}
