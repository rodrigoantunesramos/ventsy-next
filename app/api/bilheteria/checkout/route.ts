import { NextRequest } from 'next/server'
import { MercadoPagoConfig, Preference } from 'mercadopago'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { gerarToken, ocupadosPorCategoria } from '../_shared'
import { confirmarPedido } from '../_confirmar'
import {
  cotarPedido, validarItens, validarCupom, bilheteriaAVenda,
  type Categoria, type Cupom, type ItemPedido,
} from '@/lib/bilheteria'

// Checkout PÚBLICO da bilheteria (comprador SEM login). Cria o pedido + os
// ingressos (reservados) e gera o pagamento no Mercado Pago (Checkout Pro:
// Pix/cartão/boleto). É a camada AUTORITATIVA: recalcula preço no servidor e
// GUARDA contra oversell (não vende além da quantidade do lote). Conta do dono
// via split (host_mp) quando conectada; senão, conta-plataforma. Sem credencial
// de pagamento, o pedido fica 'pendente' e o dono confirma manualmente (degrade).
//
// Pedido grátis (cortesia/cupom 100%): confirma na hora, sem MP.

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const admin = supabaseAdmin as any

const MOEDA_MP: Record<string, string> = { BRL: 'BRL', USD: 'USD', EUR: 'EUR' }

type ItemBody = {
  categoria_id: string
  qtd: number
  meia?: boolean
  titulares?: { nome?: string; doc?: string; extras?: Record<string, string> }[]
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const token = String(body.token || '')
  if (!token) return Response.json({ error: 'token obrigatório' }, { status: 400 })

  const comprador = (body.comprador || {}) as { nome?: string; email?: string; doc?: string; telefone?: string }
  const nome = String(comprador.nome || '').trim()
  if (!nome) return Response.json({ error: 'Informe o nome do comprador.' }, { status: 400 })

  const itensBody = (Array.isArray(body.itens) ? body.itens : []) as ItemBody[]
  const limpos = itensBody.filter((i) => i?.categoria_id && Number(i.qtd) > 0)
  if (!limpos.length) return Response.json({ error: 'Selecione ao menos um ingresso.' }, { status: 400 })

  // 1) Bilheteria + janela de venda.
  const { data: bilh } = await admin.from('bilheteria_eventos').select('*').eq('pagina_token', token).maybeSingle()
  if (!bilh) return Response.json({ error: 'Bilheteria não encontrada.' }, { status: 404 })
  const nowMs = Date.now()
  const venda = bilheteriaAVenda(bilh, nowMs)
  if (!venda.aVenda) return Response.json({ error: 'venda_indisponivel', motivo: venda.motivo }, { status: 409 })

  // 2) Carrega as categorias pedidas (e confere que são desta bilheteria).
  const catIds = Array.from(new Set(limpos.map((i) => String(i.categoria_id))))
  const { data: catsRaw } = await admin.from('ingressos_categorias').select('*').eq('bilheteria_id', bilh.id).in('id', catIds)
  const categorias = (catsRaw || []) as Categoria[]
  const catById = new Map(categorias.map((c) => [c.id, c]))
  if (categorias.length !== catIds.length) return Response.json({ error: 'Categoria inválida.' }, { status: 400 })

  // 3) Guarda anti-oversell (com ocupação ao vivo: pagos + reservas ativas).
  const itens: ItemPedido[] = limpos.map((i) => ({ categoria: catById.get(String(i.categoria_id))!, qtd: Math.floor(Number(i.qtd)), meia: !!i.meia }))
  const ocupados = await ocupadosPorCategoria(admin, catIds)
  const problemas = validarItens(itens, ocupados, nowMs)
  if (problemas.length) {
    return Response.json({ error: 'indisponivel', problemas }, { status: 409 })
  }

  // 4) Cupom (opcional) — validado no servidor.
  let cupom: Cupom | null = null
  const codigo = String(body.cupom_codigo || '').trim()
  if (codigo) {
    const { data: c } = await admin.from('bilheteria_cupons').select('*').eq('bilheteria_id', bilh.id).ilike('codigo', codigo).maybeSingle()
    const v = validarCupom(c, nowMs)
    if (!v.ok) return Response.json({ error: 'cupom_invalido', motivo: v.motivo }, { status: 409 })
    cupom = c as Cupom
  }

  // 5) Cotação autoritativa (preço recalculado no servidor).
  const moeda = bilh.moeda || 'BRL'
  const cot = cotarPedido(itens, cupom, Number(bilh.taxa_servico) || 0, moeda)

  // 6) Cria o pedido (pendente) + ingressos (reservados).
  const { data: pedido, error: pedErr } = await admin.from('pedidos_ingresso').insert({
    usuario_id: bilh.usuario_id,
    bilheteria_id: bilh.id,
    comprador_nome: nome,
    comprador_email: String(comprador.email || '').trim() || null,
    comprador_doc: String(comprador.doc || '').trim() || null,
    telefone: String(comprador.telefone || '').trim() || null,
    subtotal_num: cot.subtotal,
    desconto_num: cot.desconto,
    taxa_num: cot.taxa,
    total_num: cot.total,
    moeda,
    cupom_id: cupom?.id || null,
    cupom_codigo: cupom?.codigo || null,
    status: 'pendente',
    canal: 'online',
  }).select('*').single()
  if (pedErr || !pedido) return Response.json({ error: 'Não foi possível criar o pedido.' }, { status: 500 })

  // Monta um ingresso por unidade, distribuindo titulares quando enviados.
  const linhasIngresso: Record<string, unknown>[] = []
  for (const i of limpos) {
    const cat = catById.get(String(i.categoria_id))!
    const meia = !!i.meia && cat.meia
    const unit = meia ? Math.round((Number(cat.preco_num) * (cat.meia_percent > 0 && cat.meia_percent <= 1 ? cat.meia_percent : 0.5)) * 100) / 100 : Number(cat.preco_num) || 0
    const qtd = Math.floor(Number(i.qtd))
    for (let k = 0; k < qtd; k++) {
      const titular = i.titulares?.[k] || {}
      linhasIngresso.push({
        usuario_id: bilh.usuario_id,
        bilheteria_id: bilh.id,
        pedido_id: pedido.id,
        categoria_id: cat.id,
        comprador_nome: String(titular.nome || '').trim() || nome,
        comprador_doc: String(titular.doc || '').trim() || null,
        email: String(comprador.email || '').trim() || null,
        qr_token: gerarToken(),
        valor_num: unit,
        meia,
        extras: titular.extras && Object.keys(titular.extras).length ? titular.extras : null,
        status: 'reservado',
      })
    }
  }
  const { error: ingErr } = await admin.from('ingressos').insert(linhasIngresso)
  if (ingErr) {
    await admin.from('pedidos_ingresso').delete().eq('id', pedido.id)   // rollback
    return Response.json({ error: 'Não foi possível reservar os ingressos.' }, { status: 500 })
  }

  // 7) Pedido grátis → confirma na hora (sem MP).
  if (cot.total <= 0) {
    await confirmarPedido(admin, { pedidoId: pedido.id, metodo: 'Cortesia' })
    return Response.json({ pedido_id: pedido.id, status: 'pago', free: true })
  }

  // 8) Pagamento Mercado Pago (Checkout Pro). Token do dono (split) ou plataforma.
  const { data: hostMp } = await admin.from('host_mp').select('mp_access_token, conectado').eq('usuario_id', bilh.usuario_id).maybeSingle()
  const mpToken = hostMp?.conectado && hostMp?.mp_access_token ? hostMp.mp_access_token : process.env.MERCADOPAGO_ACCESS_TOKEN
  if (!mpToken) {
    // Degrade: o pedido fica reservado/pendente; o dono confirma manualmente.
    return Response.json({ pedido_id: pedido.id, status: 'pendente', link: null, warning: 'Pagamento online indisponível. O organizador confirmará seu pedido.' })
  }

  const origin = (process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin).replace(/\/$/, '')
  const currency = MOEDA_MP[String(moeda).toUpperCase()] || 'BRL'
  try {
    const mp = new MercadoPagoConfig({ accessToken: mpToken })
    const pref = new Preference(mp)
    const items = cot.linhas.map((l) => ({
      id: l.categoria_id,
      title: `${l.nome}${l.meia ? ' (meia)' : ''}`.slice(0, 250),
      quantity: l.qtd,
      unit_price: l.unitario,
      currency_id: currency,
    }))
    // A taxa de serviço (e o desconto) entram como itens de ajuste para o total
    // do Checkout Pro bater exatamente com a cotação.
    if (cot.desconto > 0) items.push({ id: 'desconto', title: 'Desconto (cupom)', quantity: 1, unit_price: -cot.desconto, currency_id: currency })
    if (cot.taxa > 0) items.push({ id: 'taxa', title: 'Taxa de serviço', quantity: 1, unit_price: cot.taxa, currency_id: currency })

    const result = await pref.create({
      body: {
        items,
        external_reference: String(pedido.id),
        metadata: { pedido_id: pedido.id, bilheteria_id: bilh.id, usuario_id: bilh.usuario_id },
        payer: { name: nome, email: String(comprador.email || '').trim() || undefined },
        back_urls: {
          success: `${origin}/ingressos/${token}?pedido=${pedido.id}`,
          failure: `${origin}/ingressos/${token}?pedido=${pedido.id}`,
          pending: `${origin}/ingressos/${token}?pedido=${pedido.id}`,
        },
        auto_return: 'approved',
        notification_url: `${origin}/api/bilheteria/webhook?u=${bilh.usuario_id}`,
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = result as any
    const link = res.init_point || res.sandbox_init_point || null
    await admin.from('pedidos_ingresso').update({ mp_preference_id: String(res.id || '') || null }).eq('id', pedido.id)

    return Response.json({ pedido_id: pedido.id, status: 'pendente', link })
  } catch (e) {
    // O pedido continua reservado; o comprador pode tentar de novo ou o dono confirma.
    const msg = e instanceof Error ? e.message : 'Falha ao gerar o pagamento.'
    return Response.json({ pedido_id: pedido.id, status: 'pendente', link: null, error: msg }, { status: 502 })
  }
}
