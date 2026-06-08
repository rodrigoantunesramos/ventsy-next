import { describe, it, expect } from 'vitest'
import {
  calcularImpostos, round2, proximaSequencia, formatarNumero, isMissingTable,
  ALIQUOTAS_PADRAO, PROVEDOR_BY, TIPO_LABEL, STATUS_META,
} from '@/lib/fiscal'

describe('round2', () => {
  it('arredonda centavos sem erro de ponto flutuante', () => {
    expect(round2(0.1 + 0.2)).toBe(0.3)
    expect(round2(1.005)).toBe(1.01)
    expect(round2(2.675)).toBe(2.68)
  })
  it('coage entradas inválidas para 0', () => {
    expect(round2(NaN as unknown as number)).toBe(0)
    expect(round2(undefined as unknown as number)).toBe(0)
  })
})

describe('calcularImpostos — base e ISS', () => {
  it('base = serviços − descontos e ISS sobre a base', () => {
    const r = calcularImpostos({ valorServicos: 1000, descontos: 100, aliquotaIss: 5 })
    expect(r.baseCalculo).toBe(900)
    expect(r.iss).toBe(45) // 5% de 900
    expect(r.valorTotal).toBe(900)
  })
  it('base nunca é negativa (desconto maior que serviços)', () => {
    const r = calcularImpostos({ valorServicos: 100, descontos: 250, aliquotaIss: 5 })
    expect(r.baseCalculo).toBe(0)
    expect(r.iss).toBe(0)
  })
  it('ISS não retido NÃO abate o líquido', () => {
    const r = calcularImpostos({ valorServicos: 1000, aliquotaIss: 5 })
    expect(r.iss).toBe(50)
    expect(r.issRetido).toBe(0)
    expect(r.totalRetencoes).toBe(0)
    expect(r.valorLiquido).toBe(1000)
  })
})

describe('calcularImpostos — retenções', () => {
  it('Simples sem retenções marcadas: líquido = total', () => {
    const r = calcularImpostos({ valorServicos: 2000, aliquotaIss: 5, regime: 'simples' })
    expect(r.retencoes).toHaveLength(0)
    expect(r.valorLiquido).toBe(2000)
  })
  it('ISS retido abate o líquido e aparece como linha', () => {
    const r = calcularImpostos({ valorServicos: 1000, aliquotaIss: 5, retencoes: { iss_retido: true } })
    expect(r.issRetido).toBe(50)
    const linha = r.retencoes.find((l) => l.chave === 'iss_retido')
    expect(linha?.valor).toBe(50)
    expect(r.totalRetencoes).toBe(50)
    expect(r.valorLiquido).toBe(950)
  })
  it('retenções federais usam alíquotas padrão quando não informadas', () => {
    const r = calcularImpostos({
      valorServicos: 1000, aliquotaIss: 0,
      retencoes: { irrf: true, pis: true, cofins: true, csll: true },
    })
    const by = Object.fromEntries(r.retencoes.map((l) => [l.chave, l.valor]))
    expect(by.irrf).toBe(round2(1000 * ALIQUOTAS_PADRAO.aliquota_irrf / 100)) // 15
    expect(by.pis).toBe(6.5)
    expect(by.cofins).toBe(30)
    expect(by.csll).toBe(10)
    expect(r.totalRetencoes).toBe(61.5)
    expect(r.valorLiquido).toBe(938.5)
  })
  it('alíquotas customizadas sobrescrevem o padrão', () => {
    const r = calcularImpostos({
      valorServicos: 1000, aliquotaIss: 0,
      retencoes: { irrf: true, aliquota_irrf: 3 },
    })
    expect(r.retencoes[0].valor).toBe(30)
  })
  it('combina ISS retido + federais corretamente', () => {
    const r = calcularImpostos({
      valorServicos: 1000, descontos: 0, aliquotaIss: 5,
      retencoes: { iss_retido: true, inss: true },
    })
    // ISS retido 50 + INSS 11% (110) = 160
    expect(r.totalRetencoes).toBe(160)
    expect(r.valorLiquido).toBe(840)
  })
  it('retenção com valor 0 não vira linha', () => {
    const r = calcularImpostos({ valorServicos: 0, aliquotaIss: 5, retencoes: { irrf: true } })
    expect(r.retencoes).toHaveLength(0)
  })
})

describe('proximaSequencia', () => {
  it('incrementa o maior atual', () => {
    expect(proximaSequencia(0)).toBe(1)
    expect(proximaSequencia(7)).toBe(8)
  })
  it('respeita o piso configurado quando maior que o atual', () => {
    expect(proximaSequencia(0, 100)).toBe(100) // começa em 100
    expect(proximaSequencia(150, 100)).toBe(151) // já passou do piso
  })
})

describe('formatarNumero', () => {
  it('aplica prefixo e zero-padding', () => {
    expect(formatarNumero(1)).toBe('NF-0001')
    expect(formatarNumero(42, 'RC-')).toBe('RC-0042')
    expect(formatarNumero(12345, 'NF-')).toBe('NF-12345')
  })
})

describe('catálogo e metadados', () => {
  it('todos os provedores genéricos têm site, exceto manual', () => {
    expect(PROVEDOR_BY.focusnfe.generico).toBe(true)
    expect(PROVEDOR_BY.manual.generico).toBe(false)
  })
  it('rótulos de tipo/status existem', () => {
    expect(TIPO_LABEL.nfse).toBe('NFS-e')
    expect(STATUS_META.emitida.label).toBe('Emitida')
  })
})

describe('isMissingTable', () => {
  it('detecta os códigos de tabela ausente', () => {
    expect(isMissingTable({ code: 'PGRST205' })).toBe(true)
    expect(isMissingTable({ code: '42P01' })).toBe(true)
    expect(isMissingTable({ message: 'Could not find the table in schema cache' })).toBe(true)
    expect(isMissingTable({ code: '23505' })).toBe(false)
    expect(isMissingTable(null)).toBe(false)
  })
})
