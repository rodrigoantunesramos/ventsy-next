import { NextRequest } from 'next/server'
import { MercadoPagoConfig, Payment } from 'mercadopago'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getAuthUser, unauthorized, forbidden } from '@/lib/apiAuth'
import { calcularTaxas } from '@/lib/fees'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const admin = supabaseAdmin as any

// POST /api/pagamentos/checkout
// Body: { reserva_id, formData }  (formData vem do Payment Brick do Mercado Pago)
// O hóspede autenticado paga sua reserva APROVADA. Valor é recalculado no servidor.
export async function POST(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return unauthorized()

  const { reserva_id, formData } = await req.json()
  if (!reserva_id || !formData) {
    return Response.json({ error: 'reserva_id e formData são obrigatórios' }, { status: 400 })
  }

  const { data: reserva } = await admin.from('reservas').select('*').eq('id', reserva_id).maybeSingle()
  if (!reserva) return Response.json({ error: 'Reserva não encontrada' }, { status: 404 })
  if (reserva.usuario_id !== user.id) return forbidden()
  if (reserva.status === 'paga') return Response.json({ error: 'Reserva já está paga.' }, { status: 409 })
  if (reserva.status !== 'aprovada') {
    return Response.json({ error: 'A reserva precisa estar aprovada pelo anfitrião antes do pagamento.' }, { status: 409 })
  }

  const fees = calcularTaxas(Number(reserva.valor_estimado) || 0)
  if (fees.totalHospede <= 0) return Response.json({ error: 'Valor inválido para cobrança.' }, { status: 400 })

  const token = process.env.MERCADOPAGO_ACCESS_TOKEN
  if (!token) return Response.json({ error: 'Pagamento indisponível (credencial ausente).' }, { status: 503 })

  const mp = new MercadoPagoConfig({ accessToken: token })
  const payment = new Payment(mp)

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fd = formData as any
    const result = await payment.create({
      body: {
        transaction_amount: fees.totalHospede,
        description: `Reserva Ventsy ${reserva_id}`,
        payment_method_id: fd.payment_method_id,
        token: fd.token,
        installments: fd.installments,
        issuer_id: fd.issuer_id,
        payer: fd.payer,
        external_reference: reserva_id,
        metadata: { reserva_id, modelo_taxa: fees.modelo },
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = result as any
    const status: string = res.status
    if (status === 'approved') {
      await admin.from('reservas').update({ status: 'paga' }).eq('id', reserva_id)
    }

    // registro em pagamentos (best-effort — não derruba a resposta se falhar)
    try {
      await admin.from('pagamentos').insert({
        usuario_id: user.id,
        reserva_id,
        modelo_taxa: fees.modelo,
        valor_base: fees.valorBase,
        taxa_hospede: fees.taxaHospede,
        taxa_anfitriao: fees.taxaAnfitriao,
        repasse_anfitriao: fees.repasseAnfitriao,
        comissao_ventsy: fees.comissaoVentsy,
        valor: fees.totalHospede,
        metodo: fd.payment_method_id,
        status,
        mp_payment_id: String(res.id),
        mp_status: status,
        mp_status_detail: res.status_detail,
        external_ref: reserva_id,
      })
    } catch (_) { /* ignora erro de gravação do recibo */ }

    const pix = res.point_of_interaction?.transaction_data
    return Response.json({
      status,
      payment_id: res.id,
      pix: pix ? { qr_code: pix.qr_code, qr_code_base64: pix.qr_code_base64, ticket_url: pix.ticket_url } : null,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Falha ao processar o pagamento.'
    return Response.json({ error: msg }, { status: 500 })
  }
}
