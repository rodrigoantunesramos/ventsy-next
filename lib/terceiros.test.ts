import { describe, it, expect } from 'vitest'
import {
  diasAte, diasLabel, ehCompetencia, compCompetencia, mesesEntre, competenciaAtual,
  statusVigencia, mensalizarCusto, anualizarCusto,
  resultadosNaJanela, custoRealizado, retornoTotal, indiceValor, roi,
  tendenciaCusto, slaAlvo, slaNivel,
  recomendarDecisao, alertasTerceiro, agregarTerceiro,
  serieEvolucao, compararInternalizar, resumoCarteira, rankearDecisao,
  percentualSobreReceita,
  normalizarSla, normalizarResultado, normalizarTerceiro, isMissingTable,
  categoriaMeta, modeloMeta, statusMeta, decisaoMeta, DECISOES,
  type Terceiro, type ResultadoTerceiro,
} from '@/lib/terceiros'

const HOJE = '2026-06-09'

// ── Fábricas ──────────────────────────────────────────────────────────────────
function mkTerceiro(p: Partial<Terceiro> = {}): Terceiro {
  return normalizarTerceiro({
    id: p.id ?? 't1',
    fornecedor_id: p.fornecedor_id ?? null,
    servico: p.servico ?? 'Segurança terceirizada',
    categoria: p.categoria ?? 'seguranca',
    modelo_custo: p.modelo_custo ?? 'mensal',
    custo_num: p.custo_num ?? 5000,
    custo_interno_mensal_num: p.custo_interno_mensal_num ?? null,
    responsavel: p.responsavel ?? null,
    contrato_id: p.contrato_id ?? null,
    documento_url: p.documento_url ?? null,
    documento_nome: p.documento_nome ?? null,
    vigencia_inicio: p.vigencia_inicio ?? '2026-01-01',
    vigencia_fim: p.vigencia_fim ?? '2026-12-31',
    renovacao_automatica: p.renovacao_automatica ?? false,
    aviso_previo_dias: p.aviso_previo_dias ?? 30,
    multa_rescisao: p.multa_rescisao ?? null,
    sla: p.sla ?? { alvo_pct: 95, metas: [] },
    status: p.status ?? 'ativo',
    obs: p.obs ?? null,
  })
}
let _seq = 0
function mkResultado(competencia: string, p: Partial<ResultadoTerceiro> = {}): ResultadoTerceiro {
  return normalizarResultado({
    id: p.id ?? `r${_seq++}`,
    terceiro_id: p.terceiro_id ?? 't1',
    competencia,
    custo_num: p.custo_num ?? 0,
    receita_atribuida_num: p.receita_atribuida_num ?? 0,
    eventos_atendidos: p.eventos_atendidos ?? 0,
    economia_num: p.economia_num ?? 0,
    sla_cumprido_pct: p.sla_cumprido_pct ?? null,
    satisfacao: p.satisfacao ?? null,
    obs: p.obs ?? null,
  })
}

// ── Datas / competências ──────────────────────────────────────────────────────
describe('datas e competências', () => {
  it('diasAte conta dias (agnóstico de fuso)', () => {
    expect(diasAte('2026-06-09', HOJE)).toBe(0)
    expect(diasAte('2026-06-10', HOJE)).toBe(1)
    expect(diasAte('2026-06-08', HOJE)).toBe(-1)
    expect(diasAte('2026-07-09', HOJE)).toBe(30)
    expect(diasAte('2026-06-10T23:00:00', HOJE)).toBe(1)
    expect(diasAte(null, HOJE)).toBeNull()
  })
  it('diasLabel descreve o prazo', () => {
    expect(diasLabel(null)).toBe('Sem prazo')
    expect(diasLabel(-2)).toBe('Venceu há 2 dias')
    expect(diasLabel(0)).toBe('Vence hoje')
    expect(diasLabel(5)).toBe('Vence em 5 dias')
  })
  it('competências: validação, comparação e contagem', () => {
    expect(ehCompetencia('2026-06')).toBe(true)
    expect(ehCompetencia('2026-13')).toBe(false)
    expect(ehCompetencia('2026-6')).toBe(false)
    expect(compCompetencia('2026-05', '2026-06')).toBe(-1)
    expect(mesesEntre('2026-01', '2026-06')).toBe(6)      // inclusivo
    expect(mesesEntre('2026-06', '2026-01')).toBeNull()   // ordem invertida
    expect(competenciaAtual(new Date('2026-06-09T12:00:00'))).toBe('2026-06')
  })
})

// ── Vigência ──────────────────────────────────────────────────────────────────
describe('statusVigencia', () => {
  it('classifica futura/vigente/a_vencer/vencida/sem_termo', () => {
    expect(statusVigencia(mkTerceiro({ vigencia_inicio: '2026-07-01', vigencia_fim: '2027-01-01' }), HOJE)).toBe('futura')
    expect(statusVigencia(mkTerceiro({ vigencia_fim: '2026-12-31' }), HOJE)).toBe('vigente')
    expect(statusVigencia(mkTerceiro({ vigencia_fim: '2026-06-20', aviso_previo_dias: 30 }), HOJE)).toBe('a_vencer') // 11d ≤ 30
    expect(statusVigencia(mkTerceiro({ vigencia_inicio: '2025-01-01', vigencia_fim: '2026-06-01' }), HOJE)).toBe('vencida')
    // Literal direto: o factory usa ?? e trocaria o null pelo default.
    expect(statusVigencia({ vigencia_inicio: '2026-01-01', vigencia_fim: null, aviso_previo_dias: 30 }, HOJE)).toBe('sem_termo')
  })
  it('respeita o aviso prévio do contrato', () => {
    expect(statusVigencia(mkTerceiro({ vigencia_fim: '2026-08-01', aviso_previo_dias: 90 }), HOJE)).toBe('a_vencer') // 53d ≤ 90
    expect(statusVigencia(mkTerceiro({ vigencia_fim: '2026-08-01', aviso_previo_dias: 30 }), HOJE)).toBe('vigente')
  })
})

// ── Mensalização ──────────────────────────────────────────────────────────────
describe('mensalizarCusto / anualizarCusto', () => {
  it('mensal devolve o próprio custo', () => {
    expect(mensalizarCusto('mensal', 5000)).toBe(5000)
    expect(anualizarCusto('mensal', 5000)).toBe(60000)
  })
  it('por_evento e hora exigem uso; percentual exige receita', () => {
    expect(mensalizarCusto('por_evento', 800, { eventosMes: 4 })).toBe(3200)
    expect(mensalizarCusto('por_evento', 800)).toBeNull()
    expect(mensalizarCusto('hora', 120, { horasMes: 40 })).toBe(4800)
    expect(mensalizarCusto('hora', 120)).toBeNull()
    expect(mensalizarCusto('percentual', 5, { receitaMes: 100000 })).toBe(5000) // 5% de 100k
    expect(mensalizarCusto('percentual', 5)).toBeNull()
  })
})

// ── Custo / retorno / valor ────────────────────────────────────────────────────
describe('custo, retorno, índice de valor e ROI', () => {
  const res = [
    mkResultado('2026-04', { custo_num: 5000, receita_atribuida_num: 8000, economia_num: 1000 }),
    mkResultado('2026-05', { custo_num: 5000, receita_atribuida_num: 9000, economia_num: 0 }),
  ]
  it('custoRealizado e retornoTotal somam', () => {
    expect(custoRealizado(res)).toBe(10000)
    expect(retornoTotal(res)).toBe(18000) // 8000+1000 + 9000+0
  })
  it('indiceValor = retorno÷custo; roi = (retorno−custo)÷custo', () => {
    expect(indiceValor(18000, 10000)).toBe(1.8)
    expect(roi(18000, 10000)).toBeCloseTo(0.8, 10)
    expect(indiceValor(100, 0)).toBeNull()
    expect(roi(100, 0)).toBeNull()
  })
  it('resultadosNaJanela ordena e limita às N competências recentes', () => {
    const todas = [
      mkResultado('2026-01'), mkResultado('2026-03'), mkResultado('2026-02'),
    ]
    expect(resultadosNaJanela(todas).map((r) => r.competencia)).toEqual(['2026-01', '2026-02', '2026-03'])
    expect(resultadosNaJanela(todas, 2).map((r) => r.competencia)).toEqual(['2026-02', '2026-03'])
  })
})

// ── Tendência de custo ──────────────────────────────────────────────────────────
describe('tendenciaCusto', () => {
  it('detecta alta comparando metades', () => {
    const res = [
      mkResultado('2026-01', { custo_num: 1000 }),
      mkResultado('2026-02', { custo_num: 1000 }),
      mkResultado('2026-03', { custo_num: 1500 }),
      mkResultado('2026-04', { custo_num: 1500 }),
    ]
    const t = tendenciaCusto(res)
    expect(t.direcao).toBe('subindo')
    expect(t.variacao).toBeCloseTo(0.5, 10) // 1000 → 1500
  })
  it('estável com <2 pontos ou variação pequena', () => {
    expect(tendenciaCusto([mkResultado('2026-01', { custo_num: 1000 })]).direcao).toBe('estavel')
    const estavel = tendenciaCusto([
      mkResultado('2026-01', { custo_num: 1000 }), mkResultado('2026-02', { custo_num: 1010 }),
    ])
    expect(estavel.direcao).toBe('estavel')
  })
})

// ── SLA ──────────────────────────────────────────────────────────────────────
describe('SLA', () => {
  it('slaAlvo lê o alvo do contrato', () => {
    expect(slaAlvo({ alvo_pct: 95, metas: [] })).toBe(95)
    expect(slaAlvo({ alvo_pct: null, metas: [] })).toBeNull()
    expect(slaAlvo(null)).toBeNull()
  })
  it('slaNivel: verde ≥ alvo, amarelo até 10pp abaixo, vermelho abaixo disso', () => {
    expect(slaNivel(96, 95)).toBe('verde')
    expect(slaNivel(95, 95)).toBe('verde')
    expect(slaNivel(88, 95)).toBe('amarelo') // 7pp abaixo
    expect(slaNivel(80, 95)).toBe('vermelho') // 15pp abaixo
    expect(slaNivel(null, 95)).toBe('neutro')
    expect(slaNivel(90, null)).toBe('neutro')
  })
})

// ── Decisão ───────────────────────────────────────────────────────────────────
describe('recomendarDecisao', () => {
  const estavel = { direcao: 'estavel' as const, variacao: null }
  it('manter quando valor bom e SLA em dia', () => {
    const r = recomendarDecisao({ indiceValor: 2.5, slaCumpridoPct: 97, slaAlvoPct: 95, tendencia: estavel, custoMensal: 5000, custoInternoMensal: null })
    expect(r.decisao).toBe('manter')
    expect(r.severidade).toBe(0)
  })
  it('trocar quando SLA crítico e custa mais do que devolve', () => {
    const r = recomendarDecisao({ indiceValor: 0.6, slaCumpridoPct: 70, slaAlvoPct: 95, tendencia: estavel, custoMensal: 5000, custoInternoMensal: null })
    expect(r.decisao).toBe('trocar')
    expect(r.severidade).toBe(3)
  })
  it('internalizar quando trazer p/ dentro é bem mais barato e há problema', () => {
    const r = recomendarDecisao({ indiceValor: 0.9, slaCumpridoPct: 92, slaAlvoPct: 95, tendencia: estavel, custoMensal: 10000, custoInternoMensal: 6000 })
    expect(r.decisao).toBe('internalizar')
    expect(r.severidade).toBe(2)
  })
  it('renegociar quando custo sobe', () => {
    const r = recomendarDecisao({ indiceValor: 1.8, slaCumpridoPct: 96, slaAlvoPct: 95, tendencia: { direcao: 'subindo', variacao: 0.2 }, custoMensal: 5000, custoInternoMensal: null })
    expect(r.decisao).toBe('renegociar')
  })
  it('renegociar quando SLA abaixo da meta mas não crítico', () => {
    const r = recomendarDecisao({ indiceValor: 1.5, slaCumpridoPct: 90, slaAlvoPct: 95, tendencia: estavel, custoMensal: 5000, custoInternoMensal: null })
    expect(r.decisao).toBe('renegociar')
  })
  it('sem medição (tudo null) → manter por padrão', () => {
    const r = recomendarDecisao({ indiceValor: null, slaCumpridoPct: null, slaAlvoPct: 95, tendencia: estavel, custoMensal: null, custoInternoMensal: null })
    expect(r.decisao).toBe('manter')
  })
})

// ── Alertas ───────────────────────────────────────────────────────────────────
describe('alertasTerceiro', () => {
  const estavel = { direcao: 'estavel' as const, variacao: null }
  it('contrato vencendo dentro do aviso prévio (sem renovação automática)', () => {
    const t = mkTerceiro({ vigencia_fim: '2026-06-20', aviso_previo_dias: 30, renovacao_automatica: false })
    const al = alertasTerceiro(t, { indiceValor: 2, slaCumpridoPct: 96, slaAlvoPct: 95, tendencia: estavel, temMedicao: true }, HOJE)
    expect(al.some((a) => a.tipo === 'contrato_vencendo')).toBe(true)
  })
  it('renovação automática silencia o aviso de contrato', () => {
    const t = mkTerceiro({ vigencia_fim: '2026-06-20', aviso_previo_dias: 30, renovacao_automatica: true })
    const al = alertasTerceiro(t, { indiceValor: 2, slaCumpridoPct: 96, slaAlvoPct: 95, tendencia: estavel, temMedicao: true }, HOJE)
    expect(al.some((a) => a.tipo.startsWith('contrato'))).toBe(false)
  })
  it('sinaliza custo subindo, SLA baixo, valor baixo e sem medição', () => {
    const t = mkTerceiro({ vigencia_fim: '2027-01-01' })
    const al = alertasTerceiro(t, { indiceValor: 0.7, slaCumpridoPct: 75, slaAlvoPct: 95, tendencia: { direcao: 'subindo', variacao: 0.3 }, temMedicao: false }, HOJE)
    const tipos = al.map((a) => a.tipo)
    expect(tipos).toContain('custo_subindo')
    expect(tipos).toContain('sla_baixo')
    expect(tipos).toContain('valor_baixo')
    expect(tipos).toContain('sem_medicao')
  })
})

// ── Agregação completa ──────────────────────────────────────────────────────────
describe('agregarTerceiro', () => {
  it('monta o retrato completo a partir das medições', () => {
    const t = mkTerceiro({ custo_num: 5000, sla: { alvo_pct: 95, metas: [] } })
    const res = [
      mkResultado('2026-03', { custo_num: 5000, receita_atribuida_num: 9000, economia_num: 1000, eventos_atendidos: 3, sla_cumprido_pct: 96, satisfacao: 4 }),
      mkResultado('2026-04', { custo_num: 5000, receita_atribuida_num: 9000, economia_num: 1000, eventos_atendidos: 2, sla_cumprido_pct: 98, satisfacao: 5 }),
    ]
    const a = agregarTerceiro(t, res, { hojeYmd: HOJE })
    expect(a.meses).toBe(2)
    expect(a.custoMedido).toBe(10000)
    expect(a.retorno).toBe(20000) // (9000+1000)×2
    expect(a.custoMensalMedido).toBe(5000)
    expect(a.custoMensal).toBe(5000)
    expect(a.custoAnual).toBe(60000)
    expect(a.indiceValor).toBe(2)
    expect(a.eventos).toBe(5)
    expect(a.slaCumpridoPct).toBe(97)
    expect(a.slaNivel).toBe('verde')
    expect(a.satisfacao).toBe(4.5)
    expect(a.recomendacao.decisao).toBe('manter')
  })
  it('sem medições estima o custo mensal pelo contrato', () => {
    const t = mkTerceiro({ modelo_custo: 'por_evento', custo_num: 800 })
    const a = agregarTerceiro(t, [], { hojeYmd: HOJE, uso: { eventosMes: 5 } })
    expect(a.temMedicao).toBe(false)
    expect(a.custoMensalMedido).toBeNull()
    expect(a.custoMensal).toBe(4000) // 800 × 5
    expect(a.indiceValor).toBeNull()
  })
  it('cai p/ o custo realizado de Contas a pagar quando não há medição própria', () => {
    const t = mkTerceiro({ modelo_custo: 'mensal', custo_num: 5000 })
    const a = agregarTerceiro(t, [], { hojeYmd: HOJE, custoRealizadoMensal: 4200 })
    expect(a.custoMensal).toBe(4200) // AP tem prioridade sobre a estimativa do contrato (5000)
  })
  it('usa o custo interno do cadastro p/ recomendar internalizar', () => {
    const t = mkTerceiro({ custo_num: 10000, custo_interno_mensal_num: 6000, sla: { alvo_pct: 95, metas: [] } })
    const res = [mkResultado('2026-05', { custo_num: 10000, receita_atribuida_num: 8000, sla_cumprido_pct: 90 })]
    const a = agregarTerceiro(t, res, { hojeYmd: HOJE })
    expect(a.recomendacao.decisao).toBe('internalizar') // interno 6000 < 10000 e valor/SLA ruins
  })
  it('what-if do contexto sobrepõe o custo interno do cadastro', () => {
    const t = mkTerceiro({ custo_num: 10000, custo_interno_mensal_num: 6000 })
    const res = [mkResultado('2026-05', { custo_num: 10000, receita_atribuida_num: 8000, sla_cumprido_pct: 90 })]
    const a = agregarTerceiro(t, res, { hojeYmd: HOJE, custoInternoMensal: null }) // anula a estimativa
    expect(a.recomendacao.decisao).not.toBe('internalizar')
  })
})

// ── Evolução, internalizar, carteira, ranking ────────────────────────────────────
describe('serieEvolucao', () => {
  it('ordena por competência e calcula ROI por ponto', () => {
    const res = [
      mkResultado('2026-02', { custo_num: 1000, receita_atribuida_num: 3000 }),
      mkResultado('2026-01', { custo_num: 1000, receita_atribuida_num: 2000 }),
    ]
    const s = serieEvolucao(res)
    expect(s.map((p) => p.competencia)).toEqual(['2026-01', '2026-02'])
    expect(s[0].roi).toBeCloseTo(1, 10) // (2000−1000)/1000
    expect(s[1].retorno).toBe(3000)
  })
})

describe('compararInternalizar', () => {
  it('favorável quando interno < terceirizado', () => {
    const c = compararInternalizar(10000, 7000)
    expect(c.favoravel).toBe(true)
    expect(c.economiaMensal).toBe(3000) // terceirizar custa 3000 a mais
    expect(c.fracao).toBeCloseTo(0.7, 10)
  })
  it('desfavorável quando interno > terceirizado', () => {
    const c = compararInternalizar(5000, 9000)
    expect(c.favoravel).toBe(false)
    expect(c.economiaMensal).toBe(-4000)
  })
})

describe('resumoCarteira e rankearDecisao', () => {
  const ctx = { hojeYmd: HOJE }
  const bom = agregarTerceiro(
    mkTerceiro({ id: 'a', servico: 'Contabilidade', categoria: 'contabilidade', custo_num: 3000 }),
    [mkResultado('2026-05', { custo_num: 3000, receita_atribuida_num: 9000, sla_cumprido_pct: 98, terceiro_id: 'a' })],
    ctx,
  )
  const ruim = agregarTerceiro(
    mkTerceiro({ id: 'b', servico: 'Marketing', categoria: 'marketing', custo_num: 8000, sla: { alvo_pct: 95, metas: [] } }),
    [mkResultado('2026-05', { custo_num: 8000, receita_atribuida_num: 2000, sla_cumprido_pct: 70, terceiro_id: 'b' })],
    ctx,
  )
  const encerrado = agregarTerceiro(
    mkTerceiro({ id: 'c', servico: 'Antigo', categoria: 'ti', custo_num: 1000, status: 'encerrado' }),
    [], ctx,
  )
  const aggs = [bom, ruim, encerrado]
  it('resumo agrega custo (exclui encerrado), % sobre receita e farol', () => {
    const r = resumoCarteira(aggs, 100000) // receita mensal de referência
    expect(r.total).toBe(3)
    expect(r.ativos).toBe(2) // bom + ruim ativos; encerrado não
    expect(r.custoMensal).toBe(11000) // 3000 + 8000 (encerrado fora)
    expect(r.percentualReceita).toBeCloseTo(0.11, 10)
    expect(r.decisoes.trocar).toBe(1) // ruim
    expect(r.farol).toBe('vermelho')
    expect(r.porCategoria[0].custoMensal).toBe(8000) // marketing primeiro (maior custo)
  })
  it('ranking põe a ação mais urgente primeiro', () => {
    const rk = rankearDecisao(aggs)
    expect(rk[0].terceiro.id).toBe('b') // trocar (severidade 3) primeiro
  })
  it('percentualSobreReceita helper', () => {
    expect(percentualSobreReceita(11000, 100000)).toBeCloseTo(0.11, 10)
    expect(percentualSobreReceita(11000, 0)).toBeNull()
  })
})

// ── Normalizadores e catálogos ───────────────────────────────────────────────────
describe('normalizadores e catálogos', () => {
  it('normalizarSla coage alvo e descarta metas vazias', () => {
    const s = normalizarSla({ alvo_pct: '95', metas: [{ nome: 'Resposta', alvo: '≤2h' }, { nome: '', alvo: '' }, 'lixo'] })
    expect(s.alvo_pct).toBe(95)
    expect(s.metas).toEqual([{ nome: 'Resposta', alvo: '≤2h' }])
  })
  it('normalizarResultado coage números e clampa eventos', () => {
    const r = normalizarResultado({ id: 1, terceiro_id: 9, competencia: '2026-05', custo_num: '5000', eventos_atendidos: 2.7, sla_cumprido_pct: '', satisfacao: '4' })
    expect(r.custo_num).toBe(5000)
    expect(r.eventos_atendidos).toBe(3)
    expect(r.sla_cumprido_pct).toBeNull()
    expect(r.satisfacao).toBe(4)
  })
  it('normalizarTerceiro aplica defaults', () => {
    const t = normalizarTerceiro({ id: 1, servico: '', categoria: 'ti' })
    expect(t.servico).toBe('Serviço')
    expect(t.aviso_previo_dias).toBe(30)
    expect(t.renovacao_automatica).toBe(false)
    expect(t.sla.metas).toEqual([])
  })
  it('catálogos expõem metadados consistentes', () => {
    expect(categoriaMeta('seguranca').label).toBe('Segurança')
    expect(modeloMeta('percentual').unidade).toBe('% receita')
    expect(statusMeta('encerrado').ativo).toBe(false)
    expect(decisaoMeta('trocar').severidade).toBe(3)
    expect(DECISOES).toHaveLength(4)
  })
  it('isMissingTable detecta PGRST205 e 42P01', () => {
    expect(isMissingTable({ code: 'PGRST205' })).toBe(true)
    expect(isMissingTable({ code: '42P01' })).toBe(true)
    expect(isMissingTable({ code: 'PGRST116' })).toBe(false)
    expect(isMissingTable(null)).toBe(false)
  })
})
