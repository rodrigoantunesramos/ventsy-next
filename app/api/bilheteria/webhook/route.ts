import { NextRequest } from 'next/server'
import { MercadoPagoConfig, Payment } from 'mercadopago'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { confirmarPedido } from '../_confirmar'

// Webhook do Mercado Pago para a BILHETERIA. Ao aprovar um pagamento, CONSULTA
// o pagamento na API do MP (valida que é real e aprovado), resolve o pedido por
// `external_reference` e confirma (emite ingressos + credenciais + lança a
// receita). É idempotente — o MP reenvia notificações.
//
// O `?u=` na notification_url diz qual dono criou a venda (para escolher a
// credencial: conta do dono via split ou a conta-plataforma).

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const admin = supabaseAdmin as any

export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const uid = searchParams.get('u') || ''
    const body = await req.json().catch(() => ({} as Record<string, unknown>))

    const tipo = (body as { type?: string; topic?: string }).type || (body as { topic?: string }).topic || searchParams.get('type') || searchParams.get('topic')
    const paymentId =
      (body as { data?: { id?: string } }).data?.id ||
      (body as { id?: string }).id ||
      searchParams.get('id') ||
      searchParams.get('data.id')

    if (tipo && tipo !== 'payment') return Response.json({ ok: true, ignored: tipo })
    if (!paymentId) return Response.json({ ok: true, ignored: 'sem id' })

    // Credencial: a do dono (split) quando conectada; senão, plataforma.
    let token = process.env.MERCADOPAGO_ACCESS_TOKEN
    if (uid) {
      const { data: hostMp } = await admin.from('host_mp').select('mp_access_token, conectado').eq('usuario_id', uid).maybeSingle()
      if (hostMp?.conectado && hostMp?.mp_access_token) token = hostMp.mp_access_token
    }
    if (!token) return Response.json({ ok: true, ignored: 'sem credencial' })

    const mp = new MercadoPagoConfig({ accessToken: token })
    const payment = new Payment(mp)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pay = (await payment.get({ id: String(paymentId) })) as any

    const status: string = pay?.status
    const pedidoId: string = pay?.external_reference || pay?.metadata?.pedido_id
    if (!pedidoId) return Response.json({ ok: true, ignored: 'sem pedido' })

    // Grava o id do pagamento mesmo se ainda não aprovado (rastreio/conciliação).
    if (status && status !== 'approved') {
      await admin.from('pedidos_ingresso').update({ mp_payment_id: String(paymentId), mp_status: status }).eq('id', pedidoId).neq('status', 'pago')
      return Response.json({ ok: true, status })
    }
    if (status !== 'approved') return Response.json({ ok: true, status: status || 'desconhecido' })

    const metodo = pay?.payment_type_id === 'bank_transfer' ? 'Pix' : pay?.payment_method_id || 'Mercado Pago'
    const result = await confirmarPedido(admin, { pedidoId, mpPaymentId: String(paymentId), mpStatus: status, metodo })
    return Response.json({ ok: true, confirmacao: result })
  } catch (e) {
    // Responde 200 mesmo em erro lógico para evitar storm de reenvio do MP.
    return Response.json({ ok: false, error: e instanceof Error ? e.message : 'erro' })
  }
}

// O MP às vezes faz um GET de validação da URL.
export async function GET() {
  return Response.json({ ok: true })
}
