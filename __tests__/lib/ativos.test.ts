import { describe, it, expect } from 'vitest'
import {
  num, round2, clamp, parseYmdUTC, ymdUTC, addMesesYmd, mesesCompletos, diasAte,
  depreciacaoMensal, depreciar, cronogramaAnual, resumoPatrimonio, statusVencimento,
  custoManutencao, manutencaoAbertas, indiceManutencao, sugereSubstituir,
  type AtivoDeprec,
} from '@/lib/ativos'

// ── Builder mínimo (defaults inócuos) ─────────────────────────────────────────
// Usa `in` para respeitar valores explícitos — inclusive `null` (ex.: testar
// vida_util_meses: null sem que o default o engula).
function mk(p: Partial<AtivoDeprec>): AtivoDeprec {
  const has = <K extends keyof AtivoDeprec>(k: K) => k in p
  return {
    data_aquisicao: has('data_aquisicao') ? p.data_aquisicao! : '2025-06-15',
    valor_aquisicao_num: has('valor_aquisicao_num') ? p.valor_aquisicao_num! : 12000,
    valor_residual_num: has('valor_residual_num') ? p.valor_residual_num! : 0,
    vida_util_meses: has('vida_util_meses') ? p.vida_util_meses! : 12,
    metodo_deprec: has('metodo_deprec') ? p.metodo_deprec! : 'linear',
    baixado_em: has('baixado_em') ? p.baixado_em! : null,
  }
}

const NOW = Date.UTC(2026, 5, 15, 12, 0, 0) // 2026-06-15 (determinístico)

// ── Utilidades ────────────────────────────────────────────────────────────────
describe('utilidades numéricas/data', () => {
  it('num e round2 tratam lixo', () => {
    expect(num('abc')).toBe(0)
    expect(num(null)).toBe(0)
    expect(num('12.5')).toBe(12.5)
    expect(round2(1000 / 3)).toBe(333.33)
  })
  it('clamp limita', () => {
    expect(clamp(15, 0, 12)).toBe(12)
    expect(clamp(-3, 0, 12)).toBe(0)
    expect(clamp(5, 0, 12)).toBe(5)
  })
  it('parseYmdUTC / ymdUTC fazem roundtrip', () => {
    const d = parseYmdUTC('2026-02-09')!
    expect(d.getUTCFullYear()).toBe(2026)
    expect(d.getUTCMonth()).toBe(1)
    expect(d.getUTCDate()).toBe(9)
    expect(ymdUTC(d)).toBe('2026-02-09')
    expect(parseYmdUTC('')).toBeNull()
    expect(parseYmdUTC('lixo')).toBeNull()
  })
  it('addMesesYmd soma meses', () => {
    expect(addMesesYmd('2024-01-15', 12)).toBe('2025-01-15')
    expect(addMesesYmd('2024-01-15', 60)).toBe('2029-01-15')
    expect(addMesesYmd(null, 12)).toBeNull()
  })
  it('mesesCompletos conta meses fechados', () => {
    expect(mesesCompletos('2025-06-15', NOW)).toBe(12)
    expect(mesesCompletos('2025-12-15', NOW)).toBe(6)
    expect(mesesCompletos('2026-06-14', NOW)).toBe(0)  // 1 dia → ainda não fechou 1 mês
    expect(mesesCompletos('2026-06-16', NOW)).toBe(-1) // aquisição no futuro
  })
  it('diasAte calcula a diferença em dias', () => {
    expect(diasAte('2026-06-25', NOW)).toBe(10)
    expect(diasAte('2026-06-10', NOW)).toBe(-5)
    expect(diasAte('2026-06-15', NOW)).toBe(0)
    expect(diasAte(null, NOW)).toBeNull()
  })
})

// ── Depreciação ───────────────────────────────────────────────────────────────
describe('depreciacaoMensal', () => {
  it('linear = base / vida', () => {
    expect(depreciacaoMensal(mk({ valor_aquisicao_num: 12000, vida_util_meses: 12 }))).toBe(1000)
    expect(depreciacaoMensal(mk({ valor_aquisicao_num: 60000, valor_residual_num: 12000, vida_util_meses: 60 }))).toBe(800)
  })
  it('zero quando não há vida útil, base ou método nenhum', () => {
    expect(depreciacaoMensal(mk({ vida_util_meses: 0 }))).toBe(0)
    expect(depreciacaoMensal(mk({ vida_util_meses: null }))).toBe(0)
    expect(depreciacaoMensal(mk({ valor_residual_num: 99999 }))).toBe(0)
    expect(depreciacaoMensal(mk({ metodo_deprec: 'nenhum' }))).toBe(0)
  })
})

describe('depreciar', () => {
  it('meio da vida útil → metade depreciada', () => {
    const d = depreciar(mk({ valor_aquisicao_num: 12000, vida_util_meses: 12, data_aquisicao: '2025-12-15' }), NOW)
    expect(d.mesesDecorridos).toBe(6)
    expect(d.acumulada).toBe(6000)
    expect(d.valorContabil).toBe(6000)
    expect(d.percentual).toBeCloseTo(0.5, 5)
    expect(d.totalmenteDepreciado).toBe(false)
    expect(d.deprecia).toBe(true)
  })
  it('fim da vida útil → valor contábil cai ao residual', () => {
    const d = depreciar(mk({ valor_aquisicao_num: 60000, valor_residual_num: 12000, vida_util_meses: 12, data_aquisicao: '2025-01-15' }), NOW)
    expect(d.mesesDecorridos).toBe(12)
    expect(d.acumulada).toBe(48000)
    expect(d.valorContabil).toBe(12000) // = residual
    expect(d.totalmenteDepreciado).toBe(true)
  })
  it('nunca passa da vida útil (clamp)', () => {
    const d = depreciar(mk({ valor_aquisicao_num: 1200, vida_util_meses: 10, data_aquisicao: '2020-01-15' }), NOW)
    expect(d.mesesDecorridos).toBe(10)
    expect(d.acumulada).toBe(1200)
    expect(d.valorContabil).toBe(0)
  })
  it('aquisição no futuro → nada depreciado', () => {
    const d = depreciar(mk({ data_aquisicao: '2027-01-01', valor_aquisicao_num: 5000 }), NOW)
    expect(d.mesesDecorridos).toBe(0)
    expect(d.acumulada).toBe(0)
    expect(d.valorContabil).toBe(5000)
  })
  it('método nenhum / sem vida (terreno) → valor contábil = aquisição', () => {
    const d = depreciar(mk({ metodo_deprec: 'nenhum', valor_aquisicao_num: 800000, vida_util_meses: 0, data_aquisicao: '2010-01-01' }), NOW)
    expect(d.deprecia).toBe(false)
    expect(d.acumulada).toBe(0)
    expect(d.valorContabil).toBe(800000)
    expect(d.percentual).toBe(0)
  })
  it('baixa congela a depreciação na data da baixa', () => {
    const a = mk({ valor_aquisicao_num: 12000, vida_util_meses: 12, data_aquisicao: '2025-01-10', baixado_em: '2025-07-10' })
    const futuro = Date.UTC(2030, 0, 1, 12)
    const d = depreciar(a, futuro)
    expect(d.mesesDecorridos).toBe(6)
    expect(d.acumulada).toBe(6000)
    expect(d.valorContabil).toBe(6000)
  })
  it('residual maior que aquisição não gera depreciação negativa', () => {
    const d = depreciar(mk({ valor_aquisicao_num: 1000, valor_residual_num: 5000, vida_util_meses: 12 }), NOW)
    expect(d.acumulada).toBe(0)
    expect(d.valorContabil).toBe(1000)
  })
  it('expõe fim da vida útil', () => {
    const d = depreciar(mk({ data_aquisicao: '2025-01-15', vida_util_meses: 24 }), NOW)
    expect(d.fimVidaUtil).toBe('2027-01-15')
  })
})

describe('cronogramaAnual', () => {
  it('uma linha por ano e soma fecha na base depreciável', () => {
    const linhas = cronogramaAnual(mk({ valor_aquisicao_num: 60000, valor_residual_num: 12000, vida_util_meses: 60 }))
    expect(linhas).toHaveLength(5)
    expect(linhas[0]).toMatchObject({ ano: 1, meses: 12, depreciacao: 9600, acumulada: 9600, valorContabil: 50400 })
    const ultima = linhas[linhas.length - 1]
    expect(ultima.acumulada).toBe(48000)        // = base
    expect(ultima.valorContabil).toBe(12000)    // = residual
    const soma = linhas.reduce((s, l) => s + l.depreciacao, 0)
    expect(round2(soma)).toBe(48000)
  })
  it('último ano usa o resto dos meses', () => {
    const linhas = cronogramaAnual(mk({ valor_aquisicao_num: 1800, valor_residual_num: 0, vida_util_meses: 18 }))
    expect(linhas).toHaveLength(2)
    expect(linhas[1].meses).toBe(6)
    expect(linhas[1].valorContabil).toBe(0)
  })
  it('vazio quando não deprecia', () => {
    expect(cronogramaAnual(mk({ vida_util_meses: 0 }))).toEqual([])
    expect(cronogramaAnual(mk({ metodo_deprec: 'nenhum' }))).toEqual([])
  })
})

// ── Carteira ──────────────────────────────────────────────────────────────────
describe('resumoPatrimonio', () => {
  it('soma aquisição, acumulada e contábil ignorando baixados', () => {
    const r = resumoPatrimonio([
      mk({ valor_aquisicao_num: 10000, vida_util_meses: 10, data_aquisicao: '2025-06-15' }), // depreciado ao máx → contábil 0
      mk({ valor_aquisicao_num: 6000, vida_util_meses: 60, data_aquisicao: '2026-01-15' }),  // 5 meses → 500 acum, 5500 contábil
      mk({ valor_aquisicao_num: 9999, baixado_em: '2026-01-01' }),                            // baixado → ignorado
    ], NOW)
    expect(r.qtd).toBe(2)
    expect(r.baixados).toBe(1)
    expect(r.aquisicaoTotal).toBe(16000)
    expect(r.depreciacaoAcumulada).toBe(10500)
    expect(r.valorContabil).toBe(5500)
  })
  it('carteira vazia', () => {
    expect(resumoPatrimonio([], NOW)).toMatchObject({ aquisicaoTotal: 0, valorContabil: 0, qtd: 0, baixados: 0 })
  })
})

// ── Garantia / Seguro ─────────────────────────────────────────────────────────
describe('statusVencimento', () => {
  it('classifica os vencimentos', () => {
    expect(statusVencimento(null, NOW)).toBe('sem')
    expect(statusVencimento('2026-06-10', NOW)).toBe('vencido')
    expect(statusVencimento('2026-06-25', NOW)).toBe('avencer') // 10 dias
    expect(statusVencimento('2026-06-15', NOW)).toBe('avencer') // hoje
    expect(statusVencimento('2026-12-01', NOW)).toBe('emdia')
  })
  it('respeita a janela de aviso', () => {
    expect(statusVencimento('2026-07-10', NOW, 60)).toBe('avencer')
    expect(statusVencimento('2026-07-10', NOW, 10)).toBe('emdia')
  })
})

// ── Manutenção ────────────────────────────────────────────────────────────────
describe('manutenção e decisão repor×consertar', () => {
  const ordens = [
    { status: 'concluida', custo_num: 300 },
    { status: 'em_andamento', custo_num: 200 },
    { status: 'aberta', custo_num: null },
    { status: 'cancelada', custo_num: 50 },
  ]
  it('custoManutencao soma tudo', () => {
    expect(custoManutencao(ordens)).toBe(550)
    expect(custoManutencao([])).toBe(0)
  })
  it('manutencaoAbertas conta as não-finalizadas', () => {
    expect(manutencaoAbertas(ordens)).toBe(2) // em_andamento + aberta
  })
  it('indiceManutencao = custo / valor contábil', () => {
    expect(indiceManutencao(500, 1000)).toBe(0.5)
    expect(indiceManutencao(0, 1000)).toBe(0)
    expect(indiceManutencao(100, 0)).toBe(Infinity) // depreciado mas ainda gastando
    expect(indiceManutencao(0, 0)).toBe(0)
  })
  it('sugereSubstituir quando manutenção passa o limiar do valor', () => {
    expect(sugereSubstituir(700, 1000, 0.6)).toBe(true)
    expect(sugereSubstituir(500, 1000, 0.6)).toBe(false)
    expect(sugereSubstituir(100, 0)).toBe(true)
  })
})
