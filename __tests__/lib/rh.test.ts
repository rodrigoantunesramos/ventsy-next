import { describe, it, expect } from 'vitest'
import {
  diffDays, diffMesesCompletos, addMonths, addDays, avos, tempoCasaLabel,
  periodosAquisitivos, direitoFeriasDias, diasFeriasGozados, saldoFeriasDias,
  vencimentoFerias, feriasVencidas, statusValidade, diasAteVencer,
  contarPor, turnover, admitidosNoPeriodo, desligadosNoPeriodo, aniversariantesDoMes,
  diasAvisoPrevio, calcularRescisao, proximaEtapa, taxaConversao,
  type AusenciaLite, type FuncionarioLite,
} from '@/lib/rh'

const HOJE = '2026-06-08'

describe('datas', () => {
  it('diffDays conta dias-corridos com sinal', () => {
    expect(diffDays('2026-06-01', '2026-06-08')).toBe(7)
    expect(diffDays('2026-06-08', '2026-06-01')).toBe(-7)
  })
  it('diffMesesCompletos só conta o mês quando o "aniversário" chegou', () => {
    expect(diffMesesCompletos('2024-01-15', '2026-06-08')).toBe(28) // dia 8 < 15 → mês corrente não conta
    expect(diffMesesCompletos('2024-01-15', '2026-06-15')).toBe(29)
  })
  it('addMonths/addDays', () => {
    expect(addMonths('2025-01-15', 12)).toBe('2026-01-15')
    expect(addDays('2026-06-08', 5)).toBe('2026-06-13')
  })
})

describe('avos (regra dos 15 dias)', () => {
  it('conta meses com ≥15 dias trabalhados', () => {
    expect(avos('2026-01-01', '2026-06-08')).toBe(5) // jun tem só 8 dias → não conta
    expect(avos('2026-06-01', '2026-06-20')).toBe(1) // 20 dias
    expect(avos('2026-06-20', '2026-06-28')).toBe(0) // 9 dias
  })
})

describe('tempoCasaLabel', () => {
  it('rotula novo / meses / anos', () => {
    expect(tempoCasaLabel(null, HOJE)).toBe('—')
    expect(tempoCasaLabel('2026-06-01', HOJE)).toBe('Novo')
    expect(tempoCasaLabel('2024-01-15', HOJE)).toBe('2a 4m')
  })
})

describe('férias', () => {
  const semGozo: AusenciaLite[] = []
  it('direito = períodos aquisitivos completos × 30', () => {
    expect(periodosAquisitivos('2024-01-15', HOJE)).toBe(2)
    expect(direitoFeriasDias('2024-01-15', HOJE)).toBe(60)
  })
  it('saldo desconta gozados e agendados', () => {
    const aus: AusenciaLite[] = [
      { tipo: 'ferias', inicio: '2025-02-01', fim: '2025-03-02', dias: 30, status: 'gozada' },
      { tipo: 'ferias', inicio: '2026-07-01', fim: '2026-07-11', dias: 10, status: 'aprovada' },
    ]
    expect(diasFeriasGozados(aus)).toBe(30)
    expect(saldoFeriasDias('2024-01-15', HOJE, aus)).toBe(60 - 30 - 10)
  })
  it('vencimento = fim do concessivo do período mais antigo não gozado', () => {
    // 1º aquisitivo termina 2025-01-15; concessivo +12m → 2026-01-15
    expect(vencimentoFerias('2024-01-15', HOJE, semGozo)).toBe('2026-01-15')
    expect(feriasVencidas('2024-01-15', HOJE, semGozo)).toBe(true) // 2026-01-15 já passou
  })
  it('quem gozou o período mais antigo não tem férias vencidas', () => {
    const aus: AusenciaLite[] = [{ tipo: 'ferias', inicio: '2025-02-01', fim: '2025-03-02', dias: 30, status: 'gozada' }]
    expect(feriasVencidas('2024-01-15', HOJE, aus)).toBe(false)
  })
  it('sem período completo → sem direito e sem vencimento', () => {
    expect(direitoFeriasDias('2026-01-01', HOJE)).toBe(0)
    expect(vencimentoFerias('2026-01-01', HOJE, semGozo)).toBeNull()
  })
})

describe('validade de documentos', () => {
  it('semáforo por proximidade do vencimento', () => {
    expect(statusValidade(null, HOJE)).toBe('sem_validade')
    expect(statusValidade('2026-06-01', HOJE)).toBe('vencido')
    expect(statusValidade('2026-06-12', HOJE)).toBe('critico') // ≤7 dias
    expect(statusValidade('2026-06-30', HOJE)).toBe('atencao') // ≤30 dias
    expect(statusValidade('2026-12-01', HOJE)).toBe('ok')
  })
  it('diasAteVencer com sinal', () => {
    expect(diasAteVencer('2026-06-18', HOJE)).toBe(10)
    expect(diasAteVencer('2026-06-01', HOJE)).toBe(-7)
    expect(diasAteVencer(null, HOJE)).toBeNull()
  })
})

describe('headcount & turnover', () => {
  const equipe: FuncionarioLite[] = [
    { status: 'ativo', departamento: 'Operações', contrato: 'clt', admissao: '2026-06-02', nascimento: '1990-06-20' },
    { status: 'ativo', departamento: 'Operações', contrato: 'horista', admissao: '2023-01-01', nascimento: '1985-03-10' },
    { status: 'ativo', departamento: 'Comercial', contrato: 'clt', admissao: '2022-05-01', desligado_em: '2026-06-05', nascimento: '1992-06-01' },
  ]
  it('contarPor agrupa e ordena desc', () => {
    expect(contarPor(equipe, (e) => e.departamento)).toEqual([
      { chave: 'Operações', total: 2 },
      { chave: 'Comercial', total: 1 },
    ])
  })
  it('turnover = desligados / headcount médio', () => {
    expect(turnover(2, 10, 10)).toBe(0.2)
    expect(turnover(1, 0, 0)).toBe(0)
  })
  it('admitidos/desligados no período (inclusive)', () => {
    expect(admitidosNoPeriodo(equipe, '2026-06-01', '2026-06-30')).toHaveLength(1)
    expect(desligadosNoPeriodo(equipe, '2026-06-01', '2026-06-30')).toHaveLength(1)
  })
  it('aniversariantes do mês ignoram desligados', () => {
    const nomes = aniversariantesDoMes(equipe, 6) // junho: 1 ativo (o outro nasceu em março) + 1 desligado ignorado
    expect(nomes).toHaveLength(1)
  })
})

describe('rescisão', () => {
  const base = { salario: 3000, admissao: '2024-01-15', desligamento: '2026-06-20' as string }
  it('aviso prévio: 30 + 3 por ano, teto 90', () => {
    expect(diasAvisoPrevio('2026-01-01', '2026-06-20')).toBe(30)
    expect(diasAvisoPrevio('2024-01-15', '2026-06-20')).toBe(36) // 2 anos
    expect(diasAvisoPrevio('2000-01-01', '2026-06-20')).toBe(90) // teto
  })
  it('sem justa causa inclui aviso, 13º, férias e multa de 40%', () => {
    const r = calcularRescisao({ ...base, motivo: 'sem_justa_causa' })
    const labels = r.verbas.map((v) => v.label)
    expect(labels).toContain('Saldo de salário')
    expect(labels).toContain('Aviso prévio indenizado')
    expect(labels).toContain('13º proporcional')
    expect(labels.some((l) => l.startsWith('Multa FGTS'))).toBe(true)
    expect(r.total).toBeGreaterThan(0)
    // saldo de salário = (3000/30)×20 dias = 2000
    expect(r.verbas.find((v) => v.label === 'Saldo de salário')!.valor).toBeCloseTo(2000, 2)
  })
  it('pedido de demissão não tem aviso indenizado nem multa FGTS', () => {
    const r = calcularRescisao({ ...base, motivo: 'pedido_demissao' })
    const labels = r.verbas.map((v) => v.label)
    expect(labels).not.toContain('Aviso prévio indenizado')
    expect(labels.some((l) => l.startsWith('Multa FGTS'))).toBe(false)
    expect(labels).toContain('13º proporcional')
  })
  it('justa causa: só saldo de salário (+ férias vencidas se houver)', () => {
    const r = calcularRescisao({ ...base, motivo: 'justa_causa', saldoFeriasVencidasDias: 30 })
    const labels = r.verbas.map((v) => v.label)
    expect(labels).not.toContain('13º proporcional')
    expect(labels).not.toContain('Férias proporcionais + 1/3')
    expect(labels).toContain('Férias vencidas + 1/3')
  })
  it('acordo (484-A): aviso pela metade e multa de 20%', () => {
    const cheio = calcularRescisao({ ...base, motivo: 'sem_justa_causa' })
    const acordo = calcularRescisao({ ...base, motivo: 'acordo' })
    const avisoCheio = cheio.verbas.find((v) => v.label === 'Aviso prévio indenizado')!.valor
    const avisoAcordo = acordo.verbas.find((v) => v.label === 'Aviso prévio indenizado')!.valor
    expect(avisoAcordo).toBeCloseTo(avisoCheio / 2, 2)
    expect(acordo.verbas.some((v) => v.label === 'Multa FGTS (20%)')).toBe(true)
  })
})

describe('recrutamento (kanban)', () => {
  it('proximaEtapa avança no funil até contratado', () => {
    expect(proximaEtapa('triagem')).toBe('entrevista')
    expect(proximaEtapa('teste')).toBe('proposta')
    expect(proximaEtapa('proposta')).toBe('contratado')
  })
  it('taxa de conversão = contratados / total', () => {
    expect(taxaConversao({ triagem: 4, entrevista: 2, contratado: 2, reprovado: 2 })).toBe(0.2)
    expect(taxaConversao({})).toBe(0)
  })
})
