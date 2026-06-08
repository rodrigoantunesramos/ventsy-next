import { describe, it, expect } from 'vitest'
import {
  precisaAlcada, valorEstimado, montarComparativo, calcularEconomia,
  leadTimeDias, mediaLeadTime, statusPedidoPorItens, saldoAReceber,
  type ReqItemRef, type CotacaoRef,
} from '@/lib/compras'

// ── Alçada ───────────────────────────────────────────────────────────────────
describe('precisaAlcada', () => {
  it('bloqueia acima do limite e libera no/abaixo do limite', () => {
    expect(precisaAlcada(6000, 5000)).toBe(true)
    expect(precisaAlcada(5000, 5000)).toBe(false)
    expect(precisaAlcada(4999.99, 5000)).toBe(false)
  })
  it('limite nulo/zero/negativo = sem alçada (nada bloqueado)', () => {
    expect(precisaAlcada(999999, 0)).toBe(false)
    expect(precisaAlcada(999999, null)).toBe(false)
    expect(precisaAlcada(999999, undefined)).toBe(false)
    expect(precisaAlcada(999999, -1)).toBe(false)
  })
})

// ── Valor estimado da requisição ─────────────────────────────────────────────
describe('valorEstimado', () => {
  it('soma quantidade × valor_estimado_num', () => {
    expect(valorEstimado([
      { quantidade: 10, valor_estimado_num: 5 },
      { quantidade: 2, valor_estimado_num: 100 },
    ])).toBe(250)
  })
  it('trata itens sem estimativa como zero', () => {
    expect(valorEstimado([{ quantidade: 3 }, { quantidade: 1, valor_estimado_num: null }])).toBe(0)
  })
})

// ── Mapa comparativo ─────────────────────────────────────────────────────────
const ITENS: ReqItemRef[] = [
  { id: 'i1', descricao: 'Cadeiras', quantidade: 100 },
  { id: 'i2', descricao: 'Mesas', quantidade: 20 },
]
const COTACOES: CotacaoRef[] = [
  {
    id: 'A', rotulo: 'Forn A', prazo_dias: 10, itens: [
      { requisicao_item_id: 'i1', valor_unit_num: 5 },   // 500
      { requisicao_item_id: 'i2', valor_unit_num: 50 },  // 1000 → total 1500
    ],
  },
  {
    id: 'B', rotulo: 'Forn B', prazo_dias: 5, itens: [
      { requisicao_item_id: 'i1', valor_unit_num: 4 },   // 400 (melhor no item 1)
      { requisicao_item_id: 'i2', valor_unit_num: 60 },  // 1200 → total 1600
    ],
  },
]

describe('montarComparativo', () => {
  it('destaca o melhor preço por item', () => {
    const c = montarComparativo(ITENS, COTACOES)
    const l1 = c.linhas.find((l) => l.item.id === 'i1')!
    const l2 = c.linhas.find((l) => l.item.id === 'i2')!
    expect(l1.melhorCotacaoId).toBe('B') // 4 < 5
    expect(l2.melhorCotacaoId).toBe('A') // 50 < 60
    expect(l1.celulas.find((x) => x.cotacaoId === 'B')!.melhor).toBe(true)
    expect(l1.celulas.find((x) => x.cotacaoId === 'A')!.melhor).toBe(false)
  })
  it('calcula totais por cotação e recomenda o menor total completo', () => {
    const c = montarComparativo(ITENS, COTACOES)
    const tA = c.totais.find((t) => t.cotacaoId === 'A')!
    const tB = c.totais.find((t) => t.cotacaoId === 'B')!
    expect(tA.total).toBe(1500)
    expect(tB.total).toBe(1600)
    expect(tA.completa).toBe(true)
    expect(c.recomendadaId).toBe('A') // 1500 < 1600
  })
  it('marca cotação incompleta (item sem preço) como não-completa', () => {
    const parcial: CotacaoRef[] = [{ id: 'C', rotulo: 'Forn C', itens: [{ requisicao_item_id: 'i1', valor_unit_num: 3 }] }]
    const c = montarComparativo(ITENS, parcial)
    const tC = c.totais.find((t) => t.cotacaoId === 'C')!
    expect(tC.itensCotados).toBe(1)
    expect(tC.completa).toBe(false)
    expect(c.recomendadaId).toBeNull() // nenhuma completa
  })
  it('item indisponível não entra como melhor preço', () => {
    const cots: CotacaoRef[] = [
      { id: 'A', rotulo: 'A', itens: [{ requisicao_item_id: 'i1', valor_unit_num: 5 }, { requisicao_item_id: 'i2', valor_unit_num: 50 }] },
      { id: 'B', rotulo: 'B', itens: [{ requisicao_item_id: 'i1', valor_unit_num: 1, disponivel: false }, { requisicao_item_id: 'i2', valor_unit_num: 40 }] },
    ]
    const c = montarComparativo(ITENS, cots)
    const l1 = c.linhas.find((l) => l.item.id === 'i1')!
    expect(l1.melhorCotacaoId).toBe('A') // B indisponível no item 1
    expect(l1.celulas.find((x) => x.cotacaoId === 'B')!.valorUnit).toBeNull()
  })
  it('desempata pela menor prazo quando os totais empatam', () => {
    const itens: ReqItemRef[] = [{ id: 'x', descricao: 'X', quantidade: 1 }]
    const cots: CotacaoRef[] = [
      { id: 'A', rotulo: 'A', prazo_dias: 10, itens: [{ requisicao_item_id: 'x', valor_unit_num: 100 }] },
      { id: 'B', rotulo: 'B', prazo_dias: 3, itens: [{ requisicao_item_id: 'x', valor_unit_num: 100 }] },
    ]
    expect(montarComparativo(itens, cots).recomendadaId).toBe('B')
  })
  it('suporta cotação com total cheio (sem detalhamento por item)', () => {
    const cots: CotacaoRef[] = [{ id: 'L', rotulo: 'Lump', valor_total_num: 1400, prazo_dias: 7, itens: [] }]
    const c = montarComparativo(ITENS, cots)
    const tL = c.totais.find((t) => t.cotacaoId === 'L')!
    expect(tL.total).toBe(1400)
    expect(tL.detalhada).toBe(false)
    expect(tL.completa).toBe(true)
    expect(c.recomendadaId).toBe('L')
  })
})

// ── Economia ─────────────────────────────────────────────────────────────────
describe('calcularEconomia', () => {
  it('economia positiva quando compra abaixo do estimado', () => {
    expect(calcularEconomia(1000, 800)).toEqual({ valor: 200, pct: 0.2 })
  })
  it('valor negativo quando estoura o orçamento', () => {
    const e = calcularEconomia(1000, 1200)
    expect(e.valor).toBe(-200)
    expect(e.pct).toBeCloseTo(-0.2, 6)
  })
  it('pct = 0 quando não há estimativa', () => {
    expect(calcularEconomia(0, 500)).toEqual({ valor: -500, pct: 0 })
  })
})

// ── Lead time ────────────────────────────────────────────────────────────────
describe('leadTimeDias / mediaLeadTime', () => {
  it('conta dias entre pedido e recebimento', () => {
    expect(leadTimeDias('2026-06-01', '2026-06-11')).toBe(10)
  })
  it('null para datas faltando/ inválidas', () => {
    expect(leadTimeDias(null, '2026-06-11')).toBeNull()
    expect(leadTimeDias('2026-06-01', 'xx')).toBeNull()
  })
  it('média ignora pares inválidos e negativos', () => {
    expect(mediaLeadTime([
      { inicio: '2026-06-01', fim: '2026-06-11' }, // 10
      { inicio: '2026-06-01', fim: '2026-06-05' }, // 4
      { inicio: null, fim: '2026-06-05' },          // ignorado
      { inicio: '2026-06-10', fim: '2026-06-01' },  // negativo, ignorado
    ])).toBe(7)
    expect(mediaLeadTime([])).toBeNull()
  })
})

// ── Status do pedido por recebimento ─────────────────────────────────────────
describe('statusPedidoPorItens / saldoAReceber', () => {
  it('emitido quando nada recebido', () => {
    expect(statusPedidoPorItens([{ quantidade: 10 }, { quantidade: 5 }])).toBe('emitido')
  })
  it('parcial quando recebido em parte', () => {
    expect(statusPedidoPorItens([{ quantidade: 10, quantidade_recebida: 4 }, { quantidade: 5 }])).toBe('parcial')
  })
  it('recebido quando tudo chegou (com tolerância)', () => {
    expect(statusPedidoPorItens([{ quantidade: 10, quantidade_recebida: 10 }, { quantidade: 5, quantidade_recebida: 5 }])).toBe('recebido')
  })
  it('saldoAReceber nunca negativo', () => {
    expect(saldoAReceber(10, 3)).toBe(7)
    expect(saldoAReceber(10, 12)).toBe(0)
    expect(saldoAReceber(10, null)).toBe(10)
  })
})
