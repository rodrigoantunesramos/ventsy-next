import { NextRequest } from 'next/server'
import { MercadoPagoConfig, Preference } from 'mercadopago'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getAuthUser, unauthorized, forbidden } from '@/lib/apiAuth'

// Cobrança integrada — cria/recupera uma FATURA e gera um LINK de pagamento
// (Checkout Pro do Mercado Pago: Pix, boleto ou cartão). Usa a conta do dono
// (host_mp, split) quando conectada; senão, a conta-plataforma. Sem credencial,
// a fatura é salva mesmo assim (o dono cobra por outro meio) — degrade limpo.

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const admin = supabaseAdmin as any

const MOEDA_MP: Record<string, string> = { BRL: 'BRL', USD: 'USD', EUR: 'EUR' }

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return unauthorized()

  const body = await req.json().catch(() => ({}))
  const meio = ['pix', 'boleto', 'cartao', 'link'].includes(body.meio) ? body.meio : 'link'

  // 1) Recupera ou cria a fatura.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let fatura: any = null
  if (body.fatura_id) {
    const { data } = await admin.from('faturas').select('*').eq('id', body.fatura_id).maybeSingle()
    if (!data) return Response.json({ error: 'Fatura não encontrada' }, { status: 404 })
    if (data.usuario_id !== user.id) return forbidden()
    fatura = data
  } else {
    const valor = Number(body.valor)
    if (!(valor > 0)) return Response.json({ error: 'valor deve ser maior que zero' }, { status: 400 })
    const { data, error } = await admin
      .from('faturas')
      .insert({
        usuario_id: user.id,
        cliente_id: body.cliente_id || null,
        evento_id: body.evento_id || null,
        parcela_id: body.parcela_id != null && body.parcela_id !== '' ? Number(body.parcela_id) : null,
        nota_id: body.nota_id || null,
        descricao: (body.descricao || '').toString().trim() || 'Cobrança',
        valor_num: valor,
        vencimento: body.vencimento || null,
        meio,
        status: 'aberta',
      })
      .select('*')
      .single()
    if (error) return Response.json({ error: error.message }, { status: 500 })
    fatura = data
  }

  if (fatura.status === 'paga') return Response.json({ error: 'Fatura já está paga.' }, { status: 409 })

  // 2) Resolve a credencial do Mercado Pago (split do dono ou plataforma).
  const { data: hostMp } = await admin
    .from('host_mp')
    .select('mp_access_token, conectado')
    .eq('usuario_id', user.id)
    .maybeSingle()
  const token = hostMp?.conectado && hostMp?.mp_access_token ? hostMp.mp_access_token : process.env.MERCADOPAGO_ACCESS_TOKEN
  if (!token) {
    // Sem credencial: a fatura existe, mas não há link. Degrade informado.
    return Response.json({ data: fatura, link: null, warning: 'Conecte o Mercado Pago para gerar o link de pagamento.' })
  }

  // 3) Cria a preferência de pagamento.
  const { data: cfg } = await admin.from('empresa_config').select('moeda').eq('usuario_id', user.id).maybeSingle()
  const currency = MOEDA_MP[(cfg?.moeda || 'BRL').toString().toUpperCase()] || 'BRL'
  const origin = (process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin).replace(/\/$/, '')

  try {
    const mp = new MercadoPagoConfig({ accessToken: token })
    const pref = new Preference(mp)
    const result = await pref.create({
      body: {
        items: [
          {
            id: String(fatura.id),
            title: (fatura.descricao || 'Cobrança').toString().slice(0, 250),
            quantity: 1,
            unit_price: Number(fatura.valor_num) || 0,
            currency_id: currency,
          },
        ],
        external_reference: String(fatura.id),
        metadata: { fatura_id: fatura.id, usuario_id: user.id },
        back_urls: {
          success: `${origin}/painel/faturamento`,
          failure: `${origin}/painel/faturamento`,
          pending: `${origin}/painel/faturamento`,
        },
        auto_return: 'approved',
        notification_url: `${origin}/api/faturamento/webhook?u=${user.id}`,
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = result as any
    const link = res.init_point || res.sandbox_init_point || null

    const { data: upd } = await admin
      .from('faturas')
      .update({ meio, link_pagamento: link, provedor_pgto: 'mercadopago', provedor_pgto_id: String(res.id || '') || null })
      .eq('id', fatura.id)
      .select('*')
      .single()

    return Response.json({ data: upd || fatura, link })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Falha ao gerar o link de pagamento.'
    return Response.json({ data: fatura, link: null, error: msg }, { status: 502 })
  }
}
