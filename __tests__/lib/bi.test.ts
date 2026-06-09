import { describe, it, expect } from 'vitest'
import {
  todayYMD, ymd, toYMD, diasAte, addDiasYMD, diasNoRange, inicioMes, fimMes, mesesNoRange,
  periodoRange, periodoAnterior, variacao, noRange,
  stageRank, funilComercial, pipelinePonderado, ticketMedioPorTipo,
  margemPorTipo, dreResumido, agingParcelas,
  calcularOcupacao, revpas, receitaPorM2, receitaPorEvento, montarBlocosOcupacao,
  calcularNps, mediaAvaliacoes, csatFeedbacks, clientesResumo,
  chaveDimensao, agregar, serieMensal, proximaExecucao, periodoLabel, isMissingTable,
  type EventoBI, type LancamentoBI, type ParcelaBI, type ReservaBI, type EspacoBI,
} from '@/lib/bi'

const HOJE = '2026-06-09'

// Fábrica enxuta de evento (só o que a engine lê).
function ev(p: Partial<EventoBI> = {}): EventoBI {
  return { id: Math.random().toString(36).slice(2), status: 'lead', valor_total_num: 0, ...p }
}

describe('datas — helpers fuso-agnósticos', () => {
  it('toYMD / diasAte / addDiasYMD', () => {
    expect(toYMD('2026-06-09T23:30:00Z')).toBe('2026-06-09')
    expect(toYMD(null)).toBeNull()
    expect(diasAte('2026-06-19', HOJE)).toBe(10)
    expect(diasAte('2026-06-04', HOJE)).toBe(-5)
    expect(addDiasYMD('2026-01-31', 1)).toBe('2026-02-01')
    expect(addDiasYMD('2026-06-09', -10)).toBe('2026-05-30')
  })
  it('diasNoRange é inclusivo', () => {
    expect(diasNoRange('2026-06-01', '2026-06-30')).toBe(30)
    expect(diasNoRange('2026-06-09', '2026-06-09')).toBe(1)
    expect(diasNoRange('2026-06-10', '2026-06-09')).toBe(0)
  })
  it('inicioMes / fimMes / mesesNoRange', () => {
    expect(inicioMes('2026-06-09')).toBe('2026-06-01')
    expect(fimMes('2026-02-15')).toBe('2026-02-28')
    expect(fimMes('2024-02-15')).toBe('2024-02-29') // bissexto
    expect(mesesNoRange('2026-05-20', '2026-08-02')).toEqual(['2026-05', '2026-06', '2026-07', '2026-08'])
    expect(mesesNoRange('2025-11-01', '2026-02-01')).toEqual(['2025-11', '2025-12', '2026-01', '2026-02'])
  })
  it('ymd/todayYMD formatam estável', () => {
    expect(ymd(new Date(2026, 5, 9))).toBe('2026-06-09')
    expect(todayYMD(new Date(2026, 0, 1))).toBe('2026-01-01')
  })
})

describe('período — presets + comparativo anterior', () => {
  it('mês corrente', () => {
    expect(periodoRange('mes', HOJE)).toEqual({ ini: '2026-06-01', fim: '2026-06-30' })
  })
  it('ano corrente', () => {
    expect(periodoRange('ano', HOJE)).toEqual({ ini: '2026-01-01', fim: '2026-12-31' })
  })
  it('trimestre = 3 meses terminando no mês atual', () => {
    expect(periodoRange('trimestre', HOJE)).toEqual({ ini: '2026-04-01', fim: '2026-06-30' })
  })
  it('12 meses rolantes terminam no fim do mês atual', () => {
    const r = periodoRange('12meses', HOJE)
    expect(r.fim).toBe('2026-06-30')
    expect(r.ini).toBe('2025-07-01')
    expect(mesesNoRange(r.ini, r.fim).length).toBe(12)
  })
  it('personalizado respeita custom; cai p/ mês se inválido', () => {
    expect(periodoRange('personalizado', HOJE, { ini: '2026-01-15', fim: '2026-03-20' })).toEqual({ ini: '2026-01-15', fim: '2026-03-20' })
    expect(periodoRange('personalizado', HOJE, { ini: 'lixo' as string })).toEqual({ ini: '2026-06-01', fim: '2026-06-30' })
  })
  it('período anterior tem a mesma duração e termina na véspera', () => {
    const r = { ini: '2026-06-01', fim: '2026-06-30' }
    const prev = periodoAnterior(r)
    expect(prev.fim).toBe('2026-05-31')
    expect(diasNoRange(prev.ini, prev.fim)).toBe(diasNoRange(r.ini, r.fim))
  })
  it('variacao e noRange', () => {
    expect(variacao(120, 100)).toBe(20)
    expect(variacao(80, 100)).toBe(-20)
    expect(variacao(10, 0)).toBe(100)
    expect(variacao(0, 0)).toBe(0)
    expect(noRange('2026-06-15', { ini: '2026-06-01', fim: '2026-06-30' })).toBe(true)
    expect(noRange('2026-07-01', { ini: '2026-06-01', fim: '2026-06-30' })).toBe(false)
  })
})

describe('funil comercial', () => {
  it('rank dos estágios', () => {
    expect(stageRank('lead')).toBe(0)
    expect(stageRank('proposta')).toBe(1)
    expect(stageRank('contratado')).toBe(2)
    expect(stageRank('realizado')).toBe(3)
    expect(stageRank('perdido')).toBe(-1)
    expect(stageRank('desconhecido')).toBe(0)
  })
  it('conta leads/propostas/contratos e taxas; ignora perdidos como lead', () => {
    const eventos = [
      ev({ status: 'lead' }),
      ev({ status: 'negociacao' }),
      ev({ status: 'contratado', valor_total_num: 1000 }),
      ev({ status: 'realizado', valor_total_num: 2000 }),
      ev({ status: 'perdido' }),
    ]
    const f = funilComercial(eventos)
    expect(f.leads).toBe(4)          // exclui o perdido
    expect(f.perdidos).toBe(1)
    expect(f.propostas).toBe(3)      // negociacao + contratado + realizado
    expect(f.contratos).toBe(2)      // contratado + realizado
    expect(f.valorContratado).toBe(3000)
    expect(f.convGeral).toBeCloseTo(2 / 4)
    expect(f.convProposta).toBeCloseTo(3 / 4)
    expect(f.convContrato).toBeCloseTo(2 / 3)
  })
  it('proposta/contrato externos promovem um lead estágio-baixo', () => {
    const e = ev({ id: 'A', status: 'lead', valor_total_num: 500, criado_em: '2026-05-01' })
    const f = funilComercial([e], { comProposta: new Set(['A']), assinadoEm: new Map([['A', '2026-05-11']]) })
    expect(f.propostas).toBe(1)
    expect(f.contratos).toBe(1)
    expect(f.cicloMedioDias).toBe(10) // 01→11 mai
  })
  it('pipeline ponderado só conta negociações em aberto', () => {
    const eventos = [
      ev({ status: 'lead', valor_total_num: 1000 }),       // ×0.1 = 100
      ev({ status: 'reserva', valor_total_num: 1000 }),    // ×0.7 = 700
      ev({ status: 'contratado', valor_total_num: 5000 }), // ignora (fechado)
    ]
    expect(pipelinePonderado(eventos)).toBeCloseTo(800)
  })
})

describe('ticket médio por tipo', () => {
  it('agrupa por tipo e calcula média ignorando valor zero', () => {
    const r = ticketMedioPorTipo([
      ev({ tipo_evento: 'Casamento', valor_total_num: 10000 }),
      ev({ tipo_evento: 'Casamento', valor_total_num: 20000 }),
      ev({ tipo_evento: 'Corporativo', valor_total_num: 5000 }),
      ev({ tipo_evento: 'Corporativo', valor_total_num: 0 }), // ignorado
    ])
    expect(r[0]).toEqual({ chave: 'Casamento', soma: 30000, n: 2, media: 15000 })
    expect(r.find((x) => x.chave === 'Corporativo')).toEqual({ chave: 'Corporativo', soma: 5000, n: 1, media: 5000 })
  })
})

describe('financeiro — margem, DRE, aging', () => {
  const lanc: LancamentoBI[] = [
    { tipo: 'receita', valor: 10000, categoria: 'Aluguel', tipo_evento: 'Casamento' },
    { tipo: 'despesa', valor: 3000, categoria: 'Buffet', tipo_evento: 'Casamento' },
    { tipo: 'despesa', valor: 1000, categoria: 'Limpeza', tipo_evento: 'Casamento' },
    { tipo: 'receita', valor: 4000, categoria: 'Aluguel', tipo_evento: 'Corporativo' },
  ]
  it('margem por tipo', () => {
    const m = margemPorTipo(lanc)
    const cas = m.find((x) => x.chave === 'Casamento')!
    expect(cas.receita).toBe(10000)
    expect(cas.despesa).toBe(4000)
    expect(cas.margem).toBeCloseTo(0.6)
  })
  it('DRE resumido', () => {
    const dre = dreResumido(lanc)
    expect(dre.receita).toBe(14000)
    expect(dre.totalDespesa).toBe(4000)
    expect(dre.resultado).toBe(10000)
    expect(dre.margem).toBeCloseTo(10000 / 14000)
    expect(dre.despesas[0]).toEqual(['Buffet', 3000]) // maior primeiro
  })
  it('aging classifica a vencer / atraso / inadimplência', () => {
    const parcelas: ParcelaBI[] = [
      { valor: 1000, vencimento: '2026-07-01', status: 'pendente' }, // futuro → a vencer
      { valor: 500, vencimento: '2026-06-01', status: 'pendente' },  // -8d → atraso30
      { valor: 800, vencimento: '2026-04-01', status: 'pendente' },  // -69d → atraso30+
      { valor: 2000, vencimento: '2026-05-01', status: 'pago', pago_em: '2026-05-02' },
      { valor: 999, status: 'cancelado' },                           // ignora
    ]
    const a = agingParcelas(parcelas, HOJE)
    expect(a.aVencer).toBe(1000)
    expect(a.atraso30).toBe(500)
    expect(a.atraso30mais).toBe(800)
    expect(a.vencido).toBe(1300)
    expect(a.total).toBe(2300)
    expect(a.recebido).toBe(2000)
    expect(a.nAtraso).toBe(2)
    expect(a.inadimplencia).toBeCloseTo(1300 / 2300)
  })
})

describe('ocupação / RevPAS / receita por m²', () => {
  const R = { ini: '2026-06-01', fim: '2026-06-30' } // 30 dias
  it('conta space-days distintos, dedup sobreposição e recorta ao período', () => {
    const blocos = [
      { espaco: 'A', ini: '2026-06-01', fim: '2026-06-03' }, // 3 dias (1,2,3)
      { espaco: 'A', ini: '2026-06-02', fim: '2026-06-02' }, // sobrepõe → 0 novos
      { espaco: 'A', ini: '2026-05-30', fim: '2026-06-01' }, // recorta → só dia 1 (já contado)
      { espaco: 'B', ini: '2026-06-28', fim: '2026-07-05' }, // recorta → 28,29,30 = 3 dias
    ]
    const o = calcularOcupacao(blocos, 2, R)
    expect(o.porEspaco['A']).toBe(3)
    expect(o.porEspaco['B']).toBe(3)
    expect(o.diasOcupados).toBe(6)
    expect(o.spaceDaysDisponiveis).toBe(60) // 2 espaços × 30 dias
    expect(o.taxa).toBeCloseTo(6 / 60)
  })
  it('RevPAS = receita ÷ (espaços × dias)', () => {
    expect(revpas(60000, 2, 30)).toBeCloseTo(1000)
    expect(revpas(1000, 0, 30)).toBe(0)
  })
  it('receita por m² degrada para null sem área', () => {
    expect(receitaPorM2(30000, 150)).toBeCloseTo(200)
    expect(receitaPorM2(30000, 0)).toBeNull()
  })
  it('receita por evento', () => {
    expect(receitaPorEvento(30000, 3)).toBe(10000)
    expect(receitaPorEvento(30000, 0)).toBe(0)
  })
})

describe('montarBlocosOcupacao', () => {
  const reservas: ReservaBI[] = [
    { espaco_id: 10, propriedade_id: 1, status: 'confirmada', inicio: '2026-06-01', fim: '2026-06-02' },
    { espaco_id: 11, propriedade_id: 1, status: 'hold', inicio: '2026-06-03', fim: '2026-06-03' }, // hold não ocupa
    { espaco_id: 10, propriedade_id: 1, status: 'cancelada', inicio: '2026-06-05', fim: '2026-06-05' },
  ]
  it('com espaços cadastrados: usa reservas que ocupam, conta nº de espaços e soma área', () => {
    const espacos: EspacoBI[] = [{ id: 10, propriedade_id: 1, area_m2: 100 }, { id: 11, propriedade_id: 1, area_m2: 50 }]
    const { blocos, nEspacos, areaTotal } = montarBlocosOcupacao(reservas, [], espacos, [{ id: 1 }], null)
    expect(blocos.length).toBe(1) // só a confirmada
    expect(blocos[0].espaco).toBe('esp:10')
    expect(nEspacos).toBe(2)
    expect(areaTotal).toBe(150)
  })
  it('sem espaços: cada propriedade = 1 espaço e eventos contratados viram blocos', () => {
    const eventos: EventoBI[] = [
      ev({ status: 'contratado', propriedade_id: 1, data_inicio: '2026-06-10', data_fim: '2026-06-11' }),
      ev({ status: 'lead', propriedade_id: 1, data_inicio: '2026-06-15' }), // não contratado → ignora
    ]
    const { blocos, nEspacos, areaTotal } = montarBlocosOcupacao([], eventos, [], [{ id: 1 }, { id: 2 }], null)
    expect(blocos.length).toBe(1)
    expect(blocos[0].espaco).toBe('prop:1')
    expect(nEspacos).toBe(2)
    expect(areaTotal).toBe(0)
  })
  it('filtra por propriedade', () => {
    const espacos: EspacoBI[] = [{ id: 10, propriedade_id: 1, area_m2: 100 }, { id: 20, propriedade_id: 2, area_m2: 80 }]
    const { nEspacos, areaTotal } = montarBlocosOcupacao(reservas, [], espacos, [{ id: 1 }, { id: 2 }], 1)
    expect(nEspacos).toBe(1)
    expect(areaTotal).toBe(100)
  })
})

describe('operacional — NPS, avaliação, CSAT', () => {
  it('NPS = %promotores − %detratores', () => {
    const r = calcularNps([{ nps: 10 }, { nps: 9 }, { nps: 8 }, { nps: 6 }, { nps: 0 }])
    expect(r.promotores).toBe(2)
    expect(r.neutros).toBe(1)
    expect(r.detratores).toBe(2)
    expect(r.total).toBe(5)
    expect(r.score).toBe(0) // (2-2)/5 = 0
  })
  it('média de avaliações ignora notas vazias', () => {
    const m = mediaAvaliacoes([{ nota: 5 }, { nota: 4 }, { nota: null }, { nota: 0 }])
    expect(m.n).toBe(2)
    expect(m.media).toBeCloseTo(4.5)
  })
  it('CSAT com % de satisfeitos (≥4)', () => {
    const c = csatFeedbacks([{ nota_geral: 5 }, { nota_geral: 4 }, { nota_geral: 2 }])
    expect(c.n).toBe(3)
    expect(c.satisfacao).toBeCloseTo(2 / 3)
  })
})

describe('clientes — recorrência, origem, top', () => {
  it('distingue clientes, conta recorrentes e ordena top por valor', () => {
    const eventos = [
      ev({ quem_contratou: 'Maria', valor_total_num: 10000, como_conheceu: 'Instagram' }),
      ev({ quem_contratou: 'Maria', valor_total_num: 5000, como_conheceu: 'Indicação' }),
      ev({ quem_contratou: 'João', valor_total_num: 8000, como_conheceu: 'Instagram' }),
    ]
    const r = clientesResumo(eventos)
    expect(r.distintos).toBe(2)
    expect(r.recorrentes).toBe(1) // Maria
    expect(r.taxaRecorrencia).toBeCloseTo(0.5)
    expect(r.topClientes[0].chave).toBe('Maria')
    expect(r.topClientes[0].soma).toBe(15000)
    expect(r.porOrigem[0]).toEqual({ chave: 'Instagram', n: 2 })
  })
})

describe('construtor — chaveDimensao + agregar', () => {
  const eventos = [
    ev({ tipo_evento: 'Casamento', propriedade_id: 1, data_inicio: '2026-06-10', valor_total_num: 10000, qtd_adultos: 100, qtd_criancas: 10, como_conheceu: 'Site' }),
    ev({ tipo_evento: 'Casamento', propriedade_id: 1, data_inicio: '2026-07-05', valor_total_num: 20000, qtd_adultos: 200, qtd_criancas: 0, como_conheceu: 'Site' }),
    ev({ tipo_evento: 'Corporativo', propriedade_id: 2, data_inicio: '2026-06-20', valor_total_num: 6000, qtd_adultos: 50, qtd_criancas: 0, como_conheceu: 'Indicação' }),
  ]
  it('chaves cruas por dimensão', () => {
    expect(chaveDimensao(eventos[0], 'mes')).toBe('2026-06')
    expect(chaveDimensao(eventos[0], 'propriedade')).toBe('1')
    expect(chaveDimensao(eventos[2], 'tipo')).toBe('Corporativo')
    expect(chaveDimensao(eventos[0], 'canal')).toBe('Site')
  })
  it('métrica eventos (contagem) por tipo', () => {
    const r = agregar(eventos, 'tipo', 'eventos')
    expect(r.find((x) => x.chave === 'Casamento')!.valor).toBe(2)
    expect(r.find((x) => x.chave === 'Corporativo')!.valor).toBe(1)
  })
  it('métrica receita por mês ordena cronologicamente', () => {
    const r = agregar(eventos, 'mes', 'receita')
    expect(r.map((x) => x.chave)).toEqual(['2026-06', '2026-07'])
    expect(r[0].valor).toBe(16000) // 10k + 6k em junho
    expect(r[1].valor).toBe(20000)
  })
  it('métrica ticket médio e público', () => {
    const ticket = agregar(eventos, 'tipo', 'ticket')
    expect(ticket.find((x) => x.chave === 'Casamento')!.valor).toBe(15000)
    const pub = agregar(eventos, 'propriedade', 'publico')
    expect(pub.find((x) => x.chave === '1')!.valor).toBe(310) // 110 + 200
  })
})

describe('serieMensal', () => {
  it('soma por mês cobrindo todos os meses do range (zeros incluídos)', () => {
    const itens = [
      { d: '2026-06-10', v: 100 },
      { d: '2026-06-20', v: 50 },
      { d: '2026-08-01', v: 200 },
    ]
    const s = serieMensal(itens, (x) => x.d, (x) => x.v, { ini: '2026-06-01', fim: '2026-08-31' })
    expect(s).toEqual([
      { mes: '2026-06', valor: 150 },
      { mes: '2026-07', valor: 0 },
      { mes: '2026-08', valor: 200 },
    ])
  })
})

describe('agendamento — proximaExecucao', () => {
  it('diário = dia seguinte', () => {
    expect(proximaExecucao('diario', '2026-06-09')).toBe('2026-06-10')
  })
  it('semanal = próximo dia da semana (nunca o mesmo dia)', () => {
    // 2026-06-09 é uma terça (getDay=2)
    expect(proximaExecucao('semanal', '2026-06-09', { diaSemana: 1 })).toBe('2026-06-15') // próxima segunda
    expect(proximaExecucao('semanal', '2026-06-09', { diaSemana: 2 })).toBe('2026-06-16') // próxima terça (não hoje)
  })
  it('mensal = próximo dia do mês (vira o mês se já passou)', () => {
    expect(proximaExecucao('mensal', '2026-06-09', { diaMes: 20 })).toBe('2026-06-20')
    expect(proximaExecucao('mensal', '2026-06-09', { diaMes: 5 })).toBe('2026-07-05')
    expect(proximaExecucao('mensal', '2026-12-15', { diaMes: 1 })).toBe('2027-01-01')
  })
})

describe('periodoLabel', () => {
  it('rótulos PT dos presets', () => {
    expect(periodoLabel('mes')).toMatch(/mês/i)
    expect(periodoLabel('12meses')).toMatch(/12 meses/i)
    expect(periodoLabel('personalizado')).toMatch(/personalizado/i)
  })
})

describe('isMissingTable', () => {
  it('detecta tabela ausente por código/mensagem', () => {
    expect(isMissingTable({ code: 'PGRST205' })).toBe(true)
    expect(isMissingTable({ code: '42P01' })).toBe(true)
    expect(isMissingTable({ message: 'could not find the table' })).toBe(true)
    expect(isMissingTable({ code: '23505' })).toBe(false)
    expect(isMissingTable(null)).toBe(false)
  })
})
