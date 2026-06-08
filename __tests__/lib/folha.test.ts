import { describe, it, expect } from 'vitest'
import {
  calcCusto, totalPct, calcularINSS, calcularIRRF, calcularHolerite,
  DEFAULT_CHARGES, INSS_FAIXAS,
} from '@/lib/folha'

describe('calcCusto', () => {
  it('CLT soma todos os encargos patronais sobre o salário', () => {
    const pct = totalPct(DEFAULT_CHARGES.clt) // 79.24%
    const r = calcCusto(1000, 'clt', DEFAULT_CHARGES)
    expect(r.salario).toBe(1000)
    expect(r.encargos).toBeCloseTo(1000 * (pct / 100), 2)
    expect(r.total).toBeCloseTo(1000 + r.encargos, 2)
  })
  it('MEI/PJ e Estágio não geram custo patronal', () => {
    expect(calcCusto(5000, 'mei', DEFAULT_CHARGES)).toEqual({ salario: 5000, encargos: 0, total: 5000 })
    expect(calcCusto(1500, 'estagio', DEFAULT_CHARGES)).toEqual({ salario: 1500, encargos: 0, total: 1500 })
  })
  it('contrato desconhecido cai no conjunto CLT', () => {
    expect(calcCusto(1000, 'qualquer', DEFAULT_CHARGES).total).toBe(calcCusto(1000, 'clt', DEFAULT_CHARGES).total)
  })
  it('salário inválido vira 0 (defensivo)', () => {
    expect(calcCusto(NaN, 'clt', DEFAULT_CHARGES).total).toBe(0)
  })
})

describe('calcularINSS (progressivo + teto)', () => {
  it('1ª faixa: 7,5%', () => {
    expect(calcularINSS(1000)).toBeCloseTo(75, 2)
  })
  it('2ª faixa soma as alíquotas por faixa', () => {
    // 1412×7,5% + (2000−1412)×9%
    expect(calcularINSS(2000)).toBeCloseTo(1412 * 0.075 + (2000 - 1412) * 0.09, 2)
  })
  it('respeita o teto (acima do teto não cresce)', () => {
    const teto = INSS_FAIXAS[INSS_FAIXAS.length - 1].ate
    expect(calcularINSS(100000)).toBeCloseTo(calcularINSS(teto), 2)
    expect(calcularINSS(100000)).toBeLessThan(950)
  })
})

describe('calcularIRRF (tabela progressiva)', () => {
  it('base na faixa de isenção → zero', () => {
    expect(calcularIRRF(2000)).toBe(0)
  })
  it('dependentes reduzem a base tributável', () => {
    const semDep = calcularIRRF(3500, 0)
    const comDep = calcularIRRF(3500, 3)
    expect(comDep).toBeLessThan(semDep)
  })
  it('nunca negativo', () => {
    expect(calcularIRRF(2300, 5)).toBeGreaterThanOrEqual(0)
  })
})

describe('calcularHolerite', () => {
  it('CLT: aplica INSS+IRRF, deposita FGTS e fecha líquido = proventos − descontos', () => {
    const h = calcularHolerite({ salario: 3000, contrato: 'clt', dependentes: 0 })
    expect(h.totalProventos).toBe(3000)
    expect(h.inss).toBeGreaterThan(0)
    expect(h.irrf).toBeGreaterThanOrEqual(0)
    expect(h.fgts).toBeCloseTo(240, 2) // 8%
    expect(h.liquido).toBeCloseTo(h.totalProventos - h.totalDescontos, 2)
    expect(h.custoEmpregador).toBe(calcCusto(3000, 'clt', DEFAULT_CHARGES).total)
  })
  it('proventos extras entram na base e descontos reduzem o líquido', () => {
    const base = calcularHolerite({ salario: 3000, contrato: 'clt' })
    const comHE = calcularHolerite({ salario: 3000, contrato: 'clt', proventosExtras: [{ label: 'Horas extras', valor: 500 }] })
    expect(comHE.totalProventos).toBe(3500)
    expect(comHE.liquido).toBeGreaterThan(base.liquido)
  })
  it('MEI/Estágio não têm INSS/IRRF/FGTS', () => {
    const h = calcularHolerite({ salario: 2000, contrato: 'mei', descontosExtras: [{ label: 'Adiantamento', valor: 200 }] })
    expect(h.inss).toBe(0)
    expect(h.irrf).toBe(0)
    expect(h.fgts).toBe(0)
    expect(h.liquido).toBe(1800)
  })
  it('desconto de VT respeita o teto de 6%', () => {
    const h = calcularHolerite({ salario: 1000, contrato: 'clt', vtDescontoPct: 50 })
    const vt = h.linhas.find((l) => l.label === 'Vale-transporte')!
    expect(vt.valor).toBeCloseTo(60, 2) // cap 6% de 1000
  })
})
