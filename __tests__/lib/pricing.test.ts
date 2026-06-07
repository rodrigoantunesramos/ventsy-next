import { describe, it, expect } from 'vitest'
import {
  calcularPreco,
  regraCasa,
  numeroDeDiarias,
  precoDoDia,
  margem,
  type PrecoRegra,
  type Taxa,
} from '@/lib/pricing'

// Fábricas enxutas — só os campos que a engine lê.
const tabela = (over: Partial<Parameters<typeof calcularPreco>[0]['tabela']> = {}) => ({
  base: 'diaria' as const,
  valor_base_num: 1000,
  moeda: 'BRL' as const,
  ...over,
})
let _id = 0
const regra = (over: Partial<PrecoRegra> = {}): PrecoRegra => ({
  id: `r${++_id}`,
  tabela_id: 't1',
  nome: null,
  tipo: 'tipo_evento',
  condicao: {},
  ajuste_tipo: 'percentual',
  ajuste_valor: 0,
  prioridade: 0,
  ativo: true,
  ...over,
})
const taxa = (over: Partial<Taxa> = {}): Taxa => ({
  id: `tx${++_id}`,
  propriedade_id: null,
  nome: 'Taxa',
  tipo: 'fixo',
  valor: 0,
  obrigatoria: false,
  reembolsavel: false,
  ativo: true,
  ...over,
})

describe('quantidade × base', () => {
  it('diária multiplica pelo nº de diárias (intervalo inclusivo)', () => {
    expect(numeroDeDiarias('2026-06-12', '2026-06-14')).toBe(3)
    const b = calcularPreco({ tabela: tabela(), req: { data: '2026-06-12', dataFim: '2026-06-14' } })
    expect(b.quantidade).toBe(3)
    expect(b.base).toBe(3000)
  })
  it('por hora e por pessoa multiplicam pela quantidade do pedido', () => {
    expect(calcularPreco({ tabela: tabela({ base: 'hora', valor_base_num: 200 }), req: { horas: 5 } }).base).toBe(1000)
    expect(calcularPreco({ tabela: tabela({ base: 'pessoa', valor_base_num: 90 }), req: { convidados: 100 } }).base).toBe(9000)
  })
  it('período/pacote são valor fechado (quantidade 1)', () => {
    expect(calcularPreco({ tabela: tabela({ base: 'periodo' }), req: {} }).base).toBe(1000)
  })
})

describe('regras dinâmicas', () => {
  it('fim de semana acresce percentual sobre a base', () => {
    const sab = regra({ tipo: 'dia_semana', condicao: { dias: [0, 6] }, ajuste_tipo: 'percentual', ajuste_valor: 30 })
    // 2026-06-13 é sábado
    const b = calcularPreco({ tabela: tabela(), regras: [sab], req: { data: '2026-06-13' } })
    expect(b.subtotal).toBe(1300)
    expect(b.ajustes).toHaveLength(1)
    expect(b.ajustes[0].delta).toBe(300)
  })

  it('aplica por prioridade: substitui (maior) vira base, demais empilham', () => {
    const feriadoFlat = regra({ ajuste_tipo: 'substitui', ajuste_valor: 2000, prioridade: 10, tipo: 'feriado', condicao: { datas: ['12-25'] } })
    const corp = regra({ ajuste_tipo: 'percentual', ajuste_valor: 10, prioridade: 5, tipo: 'tipo_evento', condicao: { tipos: ['Corporativo'] } })
    const b = calcularPreco({
      tabela: tabela(),
      regras: [corp, feriadoFlat],
      req: { data: '2026-12-25', tipoEvento: 'Corporativo' },
    })
    // substitui → 2000; depois +10% = 2200
    expect(b.subtotal).toBe(2200)
    expect(b.ajustes[0].ajuste_tipo).toBe('substitui')
    expect(b.ajustes[0].delta).toBe(1000)
    expect(b.ajustes[1].delta).toBeCloseTo(200)
  })

  it('regra que não casa não entra no breakdown', () => {
    const corp = regra({ tipo: 'tipo_evento', condicao: { tipos: ['Corporativo'] }, ajuste_valor: 50 })
    const b = calcularPreco({ tabela: tabela(), regras: [corp], req: { tipoEvento: 'Casamento' } })
    expect(b.ajustes).toHaveLength(0)
    expect(b.subtotal).toBe(1000)
  })

  it('temporada trata a virada de ano', () => {
    const r = regra({ tipo: 'temporada', condicao: { de: '12-15', ate: '02-28' } })
    expect(regraCasa(r, { data: '2027-01-10' })).toBe(true)
    expect(regraCasa(r, { data: '2026-12-20' })).toBe(true)
    expect(regraCasa(r, { data: '2026-07-10' })).toBe(false)
  })

  it('antecedência usa req.hoje (engine determinística)', () => {
    const lastMinute = regra({ tipo: 'antecedencia', condicao: { operador: 'menos', dias_ant: 15 }, ajuste_valor: -20 })
    expect(regraCasa(lastMinute, { data: '2026-06-20', hoje: '2026-06-10' })).toBe(true)  // 10 dias
    expect(regraCasa(lastMinute, { data: '2026-08-20', hoje: '2026-06-10' })).toBe(false) // 71 dias
  })

  it('desconto nunca leva o subtotal abaixo de zero', () => {
    const r = regra({ tipo: 'tipo_evento', condicao: { tipos: ['X'] }, ajuste_tipo: 'fixo', ajuste_valor: -5000 })
    const b = calcularPreco({ tabela: tabela(), regras: [r], req: { tipoEvento: 'X' } })
    expect(b.subtotal).toBe(0)
  })
})

describe('taxas', () => {
  it('obrigatórias entram sempre; adicionais só quando escolhidas', () => {
    const limpeza = taxa({ nome: 'Limpeza', tipo: 'fixo', valor: 300, obrigatoria: true })
    const seguranca = taxa({ nome: 'Segurança', tipo: 'por_hora', valor: 50, obrigatoria: false })
    const b = calcularPreco({
      tabela: tabela(),
      taxas: [limpeza, seguranca],
      req: { horas: 6, taxasSelecionadas: [seguranca.id] },
    })
    expect(b.totalTaxas).toBe(300 + 50 * 6)
    expect(b.total).toBe(1000 + 600)
    // sem escolher a de segurança, só a obrigatória conta
    const b2 = calcularPreco({ tabela: tabela(), taxas: [limpeza, seguranca], req: { horas: 6 } })
    expect(b2.totalTaxas).toBe(300)
  })

  it('taxa percentual incide sobre o subtotal (após regras)', () => {
    const fee = taxa({ tipo: 'percentual', valor: 10, obrigatoria: true })
    const wknd = regra({ tipo: 'dia_semana', condicao: { dias: [6] }, ajuste_valor: 50 }) // +50%
    const b = calcularPreco({ tabela: tabela(), regras: [wknd], taxas: [fee], req: { data: '2026-06-13' } })
    expect(b.subtotal).toBe(1500)
    expect(b.totalTaxas).toBe(150)
    expect(b.total).toBe(1650)
  })
})

describe('helpers de apoio', () => {
  it('precoDoDia ignora taxas e usa só regras de data', () => {
    const wknd = regra({ tipo: 'dia_semana', condicao: { dias: [6] }, ajuste_valor: 50 })
    expect(precoDoDia(tabela(), [wknd], '2026-06-13')).toBe(1500) // sábado
    expect(precoDoDia(tabela(), [wknd], '2026-06-15')).toBe(1000) // segunda
  })
  it('margem = (total − custo) / total, ou null sem custo', () => {
    expect(margem(2000, 1200)).toBeCloseTo(0.4)
    expect(margem(2000, null)).toBeNull()
  })
})
