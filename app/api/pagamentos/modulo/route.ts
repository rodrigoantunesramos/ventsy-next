import { NextRequest } from 'next/server'
import { MercadoPagoConfig, Payment } from 'mercadopago'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getAuthUser, unauthorized } from '@/lib/apiAuth'
import { ativarModulo } from '@/lib/moduloAvulso'
import { MODULOS_PAINEL, moduloLabel } from '@/lib/modulos'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const admin = supabaseAdmin as any

const MODULO_KEYS = new Set(MODULOS_PAINEL.map((m) => m.key))

// POST /api/pagamentos/modulo — compra avulsa (add-on) de um módulo pelo próprio
// dono. Valor recalculado no servidor a partir de modulos_config.preco_avulso
// (módulo precisa estar ativo + vendável). Body: { modulo, periodo, formData }.
export async function POST(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return unauthorized()

  const { modulo, periodo, formData } = await req.json()
  if (!modulo || !formData) return Response.json({ error: 'modulo e formData são obrigatórios' }, { status: 400 })
  if (!MODULO_KEYS.has(modulo)) return Response.json({ error: 'Módulo inválido.' }, { status: 400 })

  const { data: cfg } = await admin
    .from('modulos_config')
    .select('preco_avulso, vendavel, ativo')
    .eq('key', modulo)
    .maybeSingle()

  if (!cfg?.vendavel || cfg?.ativo === false) {
    return Response.json({ error: 'Este módulo não está disponível para compra avulsa.' }, { status: 400 })
  }
  const precoMensal = Number(cfg?.preco_avulso) || 0
  if (precoMensal <= 0) return Response.json({ error: 'Preço do módulo indisponível.' }, { status: 400 })

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
        description: `Módulo Ventsy: ${moduloLabel(modulo)} (${anual ? 'anual' : 'mensal'})`,
        payment_method_id: fd.payment_method_id,
        token: fd.token,
        installments: fd.installments,
        issuer_id: fd.issuer_id,
        payer: fd.payer,
        external_reference: `modulo:${user.id}:${modulo}`,
        metadata: { tipo: 'modulo', usuario_id: user.id, modulo, meses },
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = result as any
    const status: string = res.status

    try {
      await admin.from('pagamentos').insert({
        usuario_id: user.id,
        modulo_key: modulo,
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
      await ativarModulo({ usuario_id: user.id, modulo_key: modulo, meses, valor, metodo: fd.payment_method_id, mp_payment_id: String(res.id) })
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
