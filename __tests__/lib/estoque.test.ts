import { describe, it, expect } from 'vitest'
import {
  efeitoSaldo, aplicarUma, recalcular, ordenarCronologico, kardex,
  statusMinimo, diasParaVencer, statusValidade,
  valorProduto, valorEstoque, sugerirReposicao, precisaRepor, consumoPorEvento,
  round2, type MovCalc, type EstadoEstoque,
} from '@/lib/estoque'

// "Agora" determinístico ancorado ao meio-dia LOCAL — assim casa com as datas
// só-data (validade), que o motor também ancora a T12:00:00 local. Independe do
// fuso da máquina de teste.
const NOW = Date.parse('2026-06-15T12:00:00')

const ZERO: EstadoEstoque = { saldo: 0, custo_medio_num: 0 }
const mk = (tipo: MovCalc['tipo'], quantidade: number, custo_unit_num?: number): MovCalc => ({ tipo, quantidade, custo_unit_num })

// ── efeitoSaldo (sinal por tipo) ─────────────────────────────────────────────
describe('efeitoSaldo', () => {
  it('entrada soma, saída/perda subtraem, ajuste é o delta, transferência é neutra', () => {
    expect(efeitoSaldo('entrada', 10)).toBe(10)
    expect(efeitoSaldo('saida', 4)).toBe(-4)
    expect(efeitoSaldo('perda', 3)).toBe(-3)
    expect(efeitoSaldo('ajuste', -2)).toBe(-2)
    expect(efeitoSaldo('ajuste', 5)).toBe(5)
    expect(efeitoSaldo('transferencia', 9)).toBe(0)
  })
})

// ── Custo médio móvel ────────────────────────────────────────────────────────
describe('aplicarUma — custo médio móvel', () => {
  it('primeira entrada define o custo', () => {
    const r = aplicarUma(ZERO, mk('entrada', 10, 2))
    expect(r.estado).toEqual({ saldo: 10, custo_medio_num: 2 })
    expect(r.custo_unit_efetivo).toBe(2)
    expect(r.custo_total).toBe(20)
  })
  it('segunda entrada faz a média ponderada', () => {
    const e1 = aplicarUma(ZERO, mk('entrada', 10, 2)).estado
    const r = aplicarUma(e1, mk('entrada', 10, 4))
    // (10*2 + 10*4) / 20 = 3.00
    expect(r.estado).toEqual({ saldo: 20, custo_medio_num: 3 })
  })
  it('saída reduz o saldo e valora pelo custo médio vigente (não altera a média)', () => {
    const estado: EstadoEstoque = { saldo: 20, custo_medio_num: 3 }
    const r = aplicarUma(estado, mk('saida', 5))
    expect(r.estado).toEqual({ saldo: 15, custo_medio_num: 3 })
    expect(r.custo_unit_efetivo).toBe(3)
    expect(r.custo_total).toBe(-15) // valor que saiu (sinal negativo = saída)
  })
  it('ajuste aplica o delta assinado sem mexer na média', () => {
    const estado: EstadoEstoque = { saldo: 15, custo_medio_num: 3 }
    expect(aplicarUma(estado, mk('ajuste', -3)).estado).toEqual({ saldo: 12, custo_medio_num: 3 })
    expect(aplicarUma(estado, mk('ajuste', 4)).estado).toEqual({ saldo: 19, custo_medio_num: 3 })
  })
  it('transferência não altera saldo nem média', () => {
    const estado: EstadoEstoque = { saldo: 12, custo_medio_num: 3 }
    expect(aplicarUma(estado, mk('transferencia', 5)).estado).toEqual(estado)
  })
  it('entrada com saldo anterior negativo assume o custo da entrada', () => {
    const estado: EstadoEstoque = { saldo: -2, custo_medio_num: 9 }
    const r = aplicarUma(estado, mk('entrada', 4, 5))
    expect(r.estado.saldo).toBe(2)
    expect(r.estado.custo_medio_num).toBe(5) // ignora custo "fantasma" do saldo negativo
  })
})

// ── recalcular / ordenarCronologico ──────────────────────────────────────────
describe('recalcular', () => {
  it('reduz a sequência completa ao estado final', () => {
    const movs: MovCalc[] = [
      mk('entrada', 10, 2),
      mk('entrada', 10, 4),
      mk('saida', 5),
      mk('ajuste', -3),
      mk('perda', 2),
      mk('transferencia', 5),
    ]
    expect(recalcular(movs)).toEqual({ saldo: 10, custo_medio_num: 3 })
  })
  it('lista vazia → estado zero', () => {
    expect(recalcular([])).toEqual({ saldo: 0, custo_medio_num: 0 })
  })
})

describe('ordenarCronologico', () => {
  it('ordena por criado_em ascendente, estável', () => {
    const a = { criado_em: '2026-06-02T10:00:00Z', t: 'a' }
    const b = { criado_em: '2026-06-01T10:00:00Z', t: 'b' }
    const c = { criado_em: '2026-06-03T10:00:00Z', t: 'c' }
    expect(ordenarCronologico([a, b, c]).map((x) => x.t)).toEqual(['b', 'a', 'c'])
  })
})

// ── Kardex (saldo acumulado) ─────────────────────────────────────────────────
describe('kardex', () => {
  it('anota saldo e custo médio após cada linha', () => {
    const linhas = kardex([mk('entrada', 10, 2), mk('entrada', 10, 4), mk('saida', 5)])
    expect(linhas.map((l) => l.saldo_apos)).toEqual([10, 20, 15])
    expect(linhas.map((l) => l.custo_medio_apos)).toEqual([2, 3, 3])
    expect(linhas[2].custo_total).toBe(-15)
  })
})

// ── Semáforo de mínimo ───────────────────────────────────────────────────────
describe('statusMinimo', () => {
  it('zerado quando não há saldo', () => {
    expect(statusMinimo({ estoque_atual: 0, estoque_minimo: 10 })).toBe('zerado')
    expect(statusMinimo({ estoque_atual: -1, estoque_minimo: 0 })).toBe('zerado')
  })
  it('baixo quando saldo ≤ mínimo (ponto de reposição)', () => {
    expect(statusMinimo({ estoque_atual: 5, estoque_minimo: 10 })).toBe('baixo')
    expect(statusMinimo({ estoque_atual: 10, estoque_minimo: 10 })).toBe('baixo')
  })
  it('ok acima do mínimo ou sem mínimo definido', () => {
    expect(statusMinimo({ estoque_atual: 20, estoque_minimo: 10 })).toBe('ok')
    expect(statusMinimo({ estoque_atual: 3, estoque_minimo: 0 })).toBe('ok')
  })
})

// ── Validade / FEFO ──────────────────────────────────────────────────────────
describe('diasParaVencer / statusValidade', () => {
  it('conta dias inteiros (negativo = vencido)', () => {
    expect(diasParaVencer('2026-06-15', NOW)).toBe(0)
    expect(diasParaVencer('2026-06-20', NOW)).toBe(5)
    expect(diasParaVencer('2026-06-10', NOW)).toBe(-5)
    expect(diasParaVencer(null, NOW)).toBe(Infinity)
  })
  it('classifica vencido/crítico/atenção/ok', () => {
    expect(statusValidade('2026-06-10', NOW)).toBe('vencido')
    expect(statusValidade('2026-06-15', NOW)).toBe('critico')
    expect(statusValidade('2026-06-20', NOW)).toBe('critico')
    expect(statusValidade('2026-06-25', NOW)).toBe('atencao')
    expect(statusValidade('2026-08-01', NOW)).toBe('ok')
    expect(statusValidade(null, NOW)).toBe('ok')
  })
})

// ── Valoração ────────────────────────────────────────────────────────────────
describe('valorProduto / valorEstoque', () => {
  it('multiplica saldo × custo médio e soma', () => {
    expect(valorProduto({ estoque_atual: 10, custo_medio_num: 3 })).toBe(30)
    expect(valorEstoque([
      { estoque_atual: 10, custo_medio_num: 3 },
      { estoque_atual: 4, custo_medio_num: 2.5 },
    ])).toBe(40)
  })
})

// ── Reposição ────────────────────────────────────────────────────────────────
describe('sugerirReposicao / precisaRepor', () => {
  it('sugere repor até 2× o mínimo, nunca menos que o faltante', () => {
    expect(sugerirReposicao({ estoque_atual: 2, estoque_minimo: 10, custo_medio_num: 3 })).toEqual({
      faltante: 8, sugerido: 18, custo_estimado: 54,
    })
  })
  it('sem mínimo definido não sugere nada', () => {
    expect(sugerirReposicao({ estoque_atual: 0, estoque_minimo: 0, custo_medio_num: 5 })).toEqual({
      faltante: 0, sugerido: 0, custo_estimado: 0,
    })
  })
  it('precisaRepor respeita mínimo, saldo e ativo', () => {
    expect(precisaRepor({ estoque_atual: 10, estoque_minimo: 10 })).toBe(true)
    expect(precisaRepor({ estoque_atual: 11, estoque_minimo: 10 })).toBe(false)
    expect(precisaRepor({ estoque_atual: 1, estoque_minimo: 10, ativo: false })).toBe(false)
    expect(precisaRepor({ estoque_atual: 0, estoque_minimo: 0 })).toBe(false)
  })
})

// ── Consumo por evento ───────────────────────────────────────────────────────
describe('consumoPorEvento', () => {
  it('soma apenas saídas vinculadas a evento, por evento, ordenado por custo', () => {
    const movs = [
      { tipo: 'saida' as const, evento_id: 'ev1', quantidade: 5, custo_total_num: -15 },
      { tipo: 'saida' as const, evento_id: 'ev1', quantidade: 2, custo_total_num: -10 },
      { tipo: 'saida' as const, evento_id: 'ev2', quantidade: 1, custo_total_num: -50 },
      { tipo: 'entrada' as const, evento_id: 'ev1', quantidade: 9, custo_total_num: 99 }, // ignorada
      { tipo: 'saida' as const, evento_id: null, quantidade: 3, custo_total_num: -7 },    // ignorada
      { tipo: 'perda' as const, evento_id: 'ev1', quantidade: 1, custo_total_num: -3 },    // ignorada (perda ≠ consumo)
    ]
    expect(consumoPorEvento(movs)).toEqual([
      { evento_id: 'ev2', custo_total: 50, quantidade: 1, n: 1 },
      { evento_id: 'ev1', custo_total: 25, quantidade: 7, n: 2 },
    ])
  })
})

// ── round2 ───────────────────────────────────────────────────────────────────
describe('round2', () => {
  it('arredonda a centavos e trata não-número como 0', () => {
    expect(round2(3.005)).toBe(3.01)
    expect(round2(2.999)).toBe(3)
    expect(round2(NaN)).toBe(0)
  })
})
