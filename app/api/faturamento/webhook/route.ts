import { NextRequest } from 'next/server'
import { MercadoPagoConfig, Payment } from 'mercadopago'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { baixarFatura } from '../_baixa'
import { verificarWebhookMP } from '@/lib/mpWebhook'

// Webhook do Mercado Pago para cobranças (faturas). Ao aprovar um pagamento,
// CONSULTA o pagamento na API do MP (isso valida que ele é real e aprovado),
// resolve a fatura por `external_reference` e dá baixa — quitando a parcela e
// lançando a receita. A baixa é idempotente (se já paga, não duplica).
//
// O `?u=` na notification_url diz qual dono criou a cobrança (para escolher a
// credencial certa: conta do dono via split ou a conta-plataforma).

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const admin = supabaseAdmin as any

export async function POST(req: NextRequest) {
  // V-05: rejeita notificações forjadas via HMAC do MP (x-signature). Degrada se
  // MP_WEBHOOK_SECRET ausente — a reconsulta à API do MP segue como validação efetiva.
  const assinatura = verificarWebhookMP(req)
  if (assinatura === 'invalida') return Response.json({ error: 'assinatura inválida' }, { status: 401 })
  if (assinatura === 'sem_chave') console.warn('[MP webhook faturamento] MP_WEBHOOK_SECRET ausente — assinatura não verificada')

  try {
    const { searchParams } = new URL(req.url)
    const uid = searchParams.get('u') || ''
    const body = await req.json().catch(() => ({} as Record<string, unknown>))

    // O id do pagamento pode vir no corpo (data.id) ou na query (id).
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
    const faturaId: string = pay?.external_reference || pay?.metadata?.fatura_id
    if (status !== 'approved' || !faturaId) return Response.json({ ok: true, status: status || 'desconhecido' })

    const metodo = pay?.payment_type_id === 'bank_transfer' ? 'Pix' : pay?.payment_method_id || 'Mercado Pago'
    const result = await baixarFatura(admin, { faturaId, userId: uid || undefined, metodo })
    return Response.json({ ok: true, baixa: result })
  } catch (e) {
    // Responde 200 mesmo em erro lógico para evitar storm de reenvio do MP; o
    // dono ainda pode dar baixa manual. Erros reais aparecem nos logs.
    return Response.json({ ok: false, error: e instanceof Error ? e.message : 'erro' })
  }
}
