import { NextRequest } from 'next/server'
import { MercadoPagoConfig, Payment } from 'mercadopago'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getAuthUser, unauthorized } from '@/lib/apiAuth'
import { ativarAssinatura } from '@/lib/assinatura'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const admin = supabaseAdmin as any

// POST /api/pagamentos/plano — anfitrião autenticado assina um plano (pro/ultra).
// Valor recalculado no servidor a partir de planos_config. Vai p/ a plataforma
// (assinatura não tem split). Body: { plano, periodo, formData (Payment Brick) }.
export async function POST(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return unauthorized()

  const { plano, periodo, formData } = await req.json()
  if (!plano || !formData) return Response.json({ error: 'plano e formData são obrigatórios' }, { status: 400 })
  if (!['pro', 'ultra'].includes(plano)) return Response.json({ error: 'Plano inválido.' }, { status: 400 })

  const { data: cfg } = await admin.from('planos_config').select('preco').eq('id', plano).maybeSingle()
  const precoMensal = Number(cfg?.preco) || 0
  if (precoMensal <= 0) return Response.json({ error: 'Preço do plano indisponível.' }, { status: 400 })

  const anual = periodo === 'anual'
  const meses = anual ? 12 : 1
  const valor = anual ? Math.round(precoMensal * 0.8) * 12 : precoMensal

  const token = process.env.MERCADOPAGO_ACCESS_TOKEN
  if (!token) return Response.json({ error: 'Pagamento indisponível (credencial ausente).' }, { status: 503 })

  const mp = new MercadoPagoConfig({ accessToken: token })
  const payment = new Payment(mp)

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fd = formData as any
    const result = await payment.create({
      body: {
        transaction_amount: valor,
        description: `Assinatura Ventsy ${plano.toUpperCase()} (${anual ? 'anual' : 'mensal'})`,
        payment_method_id: fd.payment_method_id,
        token: fd.token,
        installments: fd.installments,
        issuer_id: fd.issuer_id,
        payer: fd.payer,
        external_reference: `plano:${user.id}:${plano}`,
        metadata: { tipo: 'assinatura', usuario_id: user.id, plano, meses },
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = result as any
    const status: string = res.status

    try {
      await admin.from('pagamentos').insert({
        usuario_id: user.id,
        plano_id: plano,
        meses,
        valor,
        metodo: fd.payment_method_id,
        status,
        mp_payment_id: String(res.id),
        mp_status: status,
        mp_status_detail: res.status_detail,
      })
    } catch (_) { /* ignora erro do recibo */ }

    if (status === 'approved') {
      await ativarAssinatura({ usuario_id: user.id, plano, meses, valor, metodo: fd.payment_method_id, mp_payment_id: String(res.id) })
    }

    const pix = res.point_of_interaction?.transaction_data
    return Response.json({
      status,
      payment_id: res.id,
      pix: pix ? { qr_code: pix.qr_code, qr_code_base64: pix.qr_code_base64 } : null,
    })
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : 'Falha ao processar o pagamento.' }, { status: 500 })
  }
}
