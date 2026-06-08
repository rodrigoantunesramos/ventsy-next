import { describe, it, expect } from 'vitest'
import {
  money, precoUnitario, descontoCupom, validarCupom, cotarPedido, validarItens,
  disponivel, esgotado, statusCategoria, bilheteriaAVenda,
  resumoVendas, vendasPorCategoria, vendasPorCanal, curvaVendas, lotacaoEvento, conciliacaoMP,
  gerarQrPayload, normalizarLeitura,
  type Categoria, type Cupom, type Pedido, type Ingresso, type BilheteriaEvento,
} from '@/lib/bilheteria'

const T0 = Date.UTC(2026, 5, 10, 18, 0, 0)
const iso = (ms: number) => new Date(ms).toISOString()

function mkCat(p: Partial<Categoria>): Categoria {
  return {
    id: p.id || 'cat1', bilheteria_id: p.bilheteria_id ?? 'b1', nome: p.nome ?? 'Pista',
    descricao: p.descricao ?? null, preco_num: p.preco_num ?? 100, quantidade: p.quantidade ?? 0,
    vendido: p.vendido ?? 0, lote: p.lote ?? 1, lote_nome: p.lote_nome ?? null, ordem: p.ordem ?? 0,
    max_por_pedido: p.max_por_pedido ?? 0, meia: p.meia ?? false, meia_percent: p.meia_percent ?? 0.5,
    por_pessoa: p.por_pessoa ?? false, kit: p.kit ?? null, venda_inicio: p.venda_inicio ?? null,
    venda_fim: p.venda_fim ?? null, ativo: p.ativo ?? true, ...p,
  }
}
function mkCupom(p: Partial<Cupom>): Cupom {
  return {
    id: p.id || 'cup1', bilheteria_id: p.bilheteria_id ?? 'b1', codigo: p.codigo ?? 'PROMO',
    tipo: p.tipo ?? 'percentual', valor_num: p.valor_num ?? 10, limite: p.limite ?? 0, usados: p.usados ?? 0,
    validade: p.validade ?? null, ativo: p.ativo ?? true, ...p,
  }
}
function mkPedido(p: Partial<Pedido>): Pedido {
  return {
    id: p.id || 'p1', bilheteria_id: p.bilheteria_id ?? 'b1', comprador_nome: p.comprador_nome ?? 'João',
    comprador_email: p.comprador_email ?? null, comprador_doc: p.comprador_doc ?? null, telefone: p.telefone ?? null,
    subtotal_num: p.subtotal_num ?? 0, desconto_num: p.desconto_num ?? 0, taxa_num: p.taxa_num ?? 0,
    total_num: p.total_num ?? 0, moeda: p.moeda ?? 'BRL', cupom_id: p.cupom_id ?? null, cupom_codigo: p.cupom_codigo ?? null,
    status: p.status ?? 'pendente', canal: p.canal ?? 'online', mp_payment_id: p.mp_payment_id ?? null,
    mp_preference_id: p.mp_preference_id ?? null, mp_status: p.mp_status ?? null, pago_em: p.pago_em ?? null,
    criado_em: p.criado_em ?? iso(T0), ...p,
  }
}
function mkIng(p: Partial<Ingresso>): Ingresso {
  return {
    id: p.id || Math.random().toString(36), bilheteria_id: p.bilheteria_id ?? 'b1', pedido_id: p.pedido_id ?? 'p1',
    categoria_id: p.categoria_id ?? 'cat1', comprador_nome: p.comprador_nome ?? null, comprador_doc: p.comprador_doc ?? null,
    email: p.email ?? null, qr_token: p.qr_token ?? 'tok', valor_num: p.valor_num ?? 100, meia: p.meia ?? false,
    extras: p.extras ?? null, status: p.status ?? 'pago', credencial_id: p.credencial_id ?? null, checkin_em: p.checkin_em ?? null, ...p,
  }
}

describe('money — arredondamento estável', () => {
  it('soma de frações sem erro de ponto flutuante', () => {
    expect(money(0.1 + 0.2)).toBe(0.3)
    expect(money(100 / 3)).toBe(33.33)
  })
})

describe('QR — reuso do payload das credenciais', () => {
  it('round-trip do payload VTS:', () => {
    expect(normalizarLeitura(gerarQrPayload('ing-abc'))).toBe('ing-abc')
  })
})

describe('preço unitário (meia-entrada)', () => {
  it('inteira quando não pede meia', () => {
    expect(precoUnitario(mkCat({ preco_num: 80 }))).toBe(80)
  })
  it('meia só aplica se a categoria permite', () => {
    expect(precoUnitario(mkCat({ preco_num: 80, meia: false }), { meia: true })).toBe(80)
    expect(precoUnitario(mkCat({ preco_num: 80, meia: true }), { meia: true })).toBe(40)
  })
  it('respeita meia_percent custom', () => {
    expect(precoUnitario(mkCat({ preco_num: 100, meia: true, meia_percent: 0.6 }), { meia: true })).toBe(60)
  })
  it('meia_percent inválido cai para 50%', () => {
    expect(precoUnitario(mkCat({ preco_num: 100, meia: true, meia_percent: 0 }), { meia: true })).toBe(50)
  })
})

describe('desconto de cupom', () => {
  it('percentual', () => {
    expect(descontoCupom(200, { tipo: 'percentual', valor_num: 10 })).toBe(20)
  })
  it('fixo nunca passa do subtotal', () => {
    expect(descontoCupom(50, { tipo: 'fixo', valor_num: 80 })).toBe(50)
    expect(descontoCupom(200, { tipo: 'fixo', valor_num: 80 })).toBe(80)
  })
  it('percentual clampa em 0..100', () => {
    expect(descontoCupom(100, { tipo: 'percentual', valor_num: 150 })).toBe(100)
    expect(descontoCupom(100, { tipo: 'percentual', valor_num: -5 })).toBe(0)
  })
  it('sem cupom = 0', () => {
    expect(descontoCupom(100, null)).toBe(0)
  })
})

describe('validarCupom', () => {
  it('aceita cupom ativo sem limite/validade', () => {
    expect(validarCupom(mkCupom({}), T0)).toEqual({ ok: true, motivo: null })
  })
  it('rejeita inativo', () => {
    expect(validarCupom(mkCupom({ ativo: false }), T0).motivo).toBe('inativo')
  })
  it('rejeita expirado (validade inclusiva no dia)', () => {
    expect(validarCupom(mkCupom({ validade: '2026-06-09' }), T0).motivo).toBe('expirado')
    expect(validarCupom(mkCupom({ validade: '2026-06-10' }), T0).ok).toBe(true) // mesmo dia ainda vale
  })
  it('rejeita esgotado por limite', () => {
    expect(validarCupom(mkCupom({ limite: 5, usados: 5 }), T0).motivo).toBe('esgotado')
    expect(validarCupom(mkCupom({ limite: 5, usados: 4 }), T0).ok).toBe(true)
  })
  it('inexistente', () => {
    expect(validarCupom(null, T0).motivo).toBe('inexistente')
  })
})

describe('cotarPedido — ordem subtotal → desconto → taxa → total', () => {
  it('soma itens e ignora qtd 0', () => {
    const c = cotarPedido([
      { categoria: mkCat({ id: 'a', preco_num: 100 }), qtd: 2 },
      { categoria: mkCat({ id: 'b', preco_num: 50 }), qtd: 0 },
    ], null, 0)
    expect(c.subtotal).toBe(200)
    expect(c.itens).toBe(2)
    expect(c.total).toBe(200)
    expect(c.linhas).toHaveLength(1)
  })
  it('aplica cupom percentual antes da taxa de serviço', () => {
    // subtotal 200, cupom 10% → desconto 20, líquido 180, taxa 10% → 18, total 198
    const c = cotarPedido([{ categoria: mkCat({ preco_num: 100 }), qtd: 2 }], { tipo: 'percentual', valor_num: 10 }, 0.1)
    expect(c.subtotal).toBe(200)
    expect(c.desconto).toBe(20)
    expect(c.taxa).toBe(18)
    expect(c.total).toBe(198)
  })
  it('meia-entrada por item', () => {
    const c = cotarPedido([{ categoria: mkCat({ preco_num: 100, meia: true }), qtd: 1, meia: true }], null, 0)
    expect(c.subtotal).toBe(50)
    expect(c.linhas[0].meia).toBe(true)
  })
  it('taxa de serviço fora de 0..1 é clampada', () => {
    const c = cotarPedido([{ categoria: mkCat({ preco_num: 100 }), qtd: 1 }], null, 2)
    expect(c.taxa).toBe(100) // clamp em 1.0
  })
})

describe('disponibilidade e lotes', () => {
  it('quantidade 0 = ilimitado', () => {
    expect(disponivel(mkCat({ quantidade: 0 }), 999)).toBe(Infinity)
    expect(esgotado(mkCat({ quantidade: 0 }), 999)).toBe(false)
  })
  it('desconta ocupados', () => {
    expect(disponivel(mkCat({ quantidade: 10 }), 7)).toBe(3)
    expect(esgotado(mkCat({ quantidade: 10 }), 10)).toBe(true)
  })
  it('statusCategoria: inativa / fora da janela / esgotado / à venda', () => {
    expect(statusCategoria(mkCat({ ativo: false }), 0, T0).motivo).toBe('inativa')
    expect(statusCategoria(mkCat({ venda_inicio: iso(T0 + 3600_000) }), 0, T0).motivo).toBe('fora_janela')
    expect(statusCategoria(mkCat({ venda_fim: iso(T0 - 3600_000) }), 0, T0).motivo).toBe('fora_janela')
    expect(statusCategoria(mkCat({ quantidade: 5 }), 5, T0).motivo).toBe('esgotado')
    expect(statusCategoria(mkCat({ quantidade: 5 }), 1, T0)).toEqual({ aVenda: true, motivo: null })
  })
  it('bilheteriaAVenda respeita status e janela global', () => {
    expect(bilheteriaAVenda({ status: 'rascunho', venda_inicio: null, venda_fim: null }, T0).motivo).toBe('rascunho')
    expect(bilheteriaAVenda({ status: 'publicado', venda_inicio: iso(T0 + 1000), venda_fim: null }, T0).motivo).toBe('nao_iniciada')
    expect(bilheteriaAVenda({ status: 'publicado', venda_inicio: null, venda_fim: iso(T0 - 1000) }, T0).motivo).toBe('encerrada_data')
    expect(bilheteriaAVenda({ status: 'publicado', venda_inicio: null, venda_fim: null }, T0).aVenda).toBe(true)
  })
})

describe('validarItens — guarda contra oversell', () => {
  it('acusa excesso de disponível e limite por pedido', () => {
    const cat = mkCat({ id: 'x', quantidade: 10, max_por_pedido: 4 })
    const probsExcede = validarItens([{ categoria: cat, qtd: 5 }], { x: 8 }, T0) // só 2 livres
    expect(probsExcede[0].motivo).toBe('excede_disponivel')
    expect(probsExcede[0].disponivel).toBe(2)
    const probsMax = validarItens([{ categoria: cat, qtd: 5 }], { x: 0 }, T0) // 10 livres, mas max 4
    expect(probsMax[0].motivo).toBe('excede_max_pedido')
  })
  it('sem problemas quando cabe', () => {
    expect(validarItens([{ categoria: mkCat({ id: 'x', quantidade: 10 }), qtd: 3 }], { x: 2 }, T0)).toEqual([])
  })
  it('categoria esgotada bloqueia', () => {
    const probs = validarItens([{ categoria: mkCat({ id: 'x', quantidade: 5 }), qtd: 1 }], { x: 5 }, T0)
    expect(probs[0].motivo).toBe('esgotado')
  })
})

describe('agregações de venda', () => {
  const pedidos = [
    mkPedido({ id: 'p1', status: 'pago', total_num: 198, taxa_num: 18, desconto_num: 20, canal: 'online', pago_em: iso(T0) }),
    mkPedido({ id: 'p2', status: 'pago', total_num: 100, taxa_num: 0, canal: 'cortesia', pago_em: iso(T0 + 1000) }),
    mkPedido({ id: 'p3', status: 'pendente', total_num: 50 }),
    mkPedido({ id: 'p4', status: 'cancelado', total_num: 50 }),
  ]
  const ingressos = [
    mkIng({ id: 'i1', pedido_id: 'p1', categoria_id: 'a', status: 'pago', valor_num: 100 }),
    mkIng({ id: 'i2', pedido_id: 'p1', categoria_id: 'a', status: 'checkin', valor_num: 100 }),
    mkIng({ id: 'i3', pedido_id: 'p2', categoria_id: 'b', status: 'pago', valor_num: 100 }),
    mkIng({ id: 'i4', pedido_id: 'p3', categoria_id: 'a', status: 'reservado', valor_num: 100 }),
  ]
  it('resumoVendas: receita, ticket médio, conversão, check-in', () => {
    const r = resumoVendas(pedidos, ingressos)
    expect(r.receita).toBe(298)
    expect(r.receitaTaxa).toBe(18)
    expect(r.receitaLiquida).toBe(280)
    expect(r.pedidosPagos).toBe(2)
    expect(r.pedidosPendentes).toBe(1)
    expect(r.ingressosVendidos).toBe(3) // pago + checkin
    expect(r.ingressosCheckin).toBe(1)
    expect(r.ticketMedio).toBe(149)
    expect(r.conversao).toBeCloseTo(2 / 4)
  })
  it('vendasPorCategoria conta só pago/checkin e ordena por receita', () => {
    const cats = [mkCat({ id: 'a', nome: 'Pista' }), mkCat({ id: 'b', nome: 'Camarote' })]
    const v = vendasPorCategoria(cats, ingressos)
    const a = v.find((x) => x.categoria_id === 'a')!
    expect(a.vendidos).toBe(2)
    expect(a.receita).toBe(200)
  })
  it('vendasPorCanal só soma pagos', () => {
    const v = vendasPorCanal(pedidos)
    expect(v.find((x) => x.canal === 'online')!.receita).toBe(198)
    expect(v.find((x) => x.canal === 'cortesia')!.receita).toBe(100)
  })
  it('curvaVendas acumula em ordem cronológica', () => {
    const c = curvaVendas(pedidos)
    expect(c).toHaveLength(2)
    expect(c[0].receita).toBe(198)
    expect(c[1].receita).toBe(298)
    expect(c[1].ingressos).toBe(2)
  })
})

describe('lotação do evento', () => {
  const b: Pick<BilheteriaEvento, 'capacidade'> = { capacidade: 0 }
  it('usa soma das categorias quando não há teto global', () => {
    const cats = [mkCat({ id: 'a', quantidade: 100 }), mkCat({ id: 'b', quantidade: 50 })]
    const ings = [mkIng({ status: 'pago' }), mkIng({ status: 'checkin' }), mkIng({ status: 'reservado' })]
    const l = lotacaoEvento(b, cats, ings)
    expect(l.vendidos).toBe(2)
    expect(l.capacidade).toBe(150)
    expect(l.restante).toBe(148)
  })
  it('teto global da bilheteria tem prioridade', () => {
    const cats = [mkCat({ id: 'a', quantidade: 100 })]
    const l = lotacaoEvento({ capacidade: 10 }, cats, [mkIng({ status: 'pago' })])
    expect(l.capacidadeEvento).toBe(10)
    expect(l.ratio).toBeCloseTo(0.1)
  })
  it('categoria ilimitada → sem teto efetivo', () => {
    const cats = [mkCat({ id: 'a', quantidade: 0 })]
    const l = lotacaoEvento(b, cats, [mkIng({ status: 'pago' })])
    expect(l.restante).toBe(Infinity)
  })
})

describe('conciliação Mercado Pago', () => {
  it('separa conciliado (com mp), manual e pendente-mp', () => {
    const pedidos = [
      mkPedido({ status: 'pago', mp_payment_id: '123', total_num: 100 }),
      mkPedido({ status: 'pago', mp_payment_id: null, total_num: 50, canal: 'cortesia' }),
      mkPedido({ status: 'pendente', mp_preference_id: 'pref1', total_num: 30 }),
    ]
    const c = conciliacaoMP(pedidos)
    expect(c.conciliados).toBe(1)
    expect(c.manuais).toBe(1)
    expect(c.pendentesMp).toBe(1)
    expect(c.valorConciliado).toBe(100)
  })
})
