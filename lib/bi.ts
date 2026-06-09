// Motor PURO de Business Intelligence da Ventsy.
// ─────────────────────────────────────────────────────────────────────────────
// Central de inteligência que cruza TODOS os módulos (comercial, financeiro,
// operações, ocupação, clientes) com indicadores próprios de LOCAÇÃO DE ESPAÇOS
// PARA EVENTOS:
//   • Ocupação (% de space-days ocupados), RevPAS (receita por space-day
//     disponível), receita por m², receita por evento, ticket médio por tipo.
//   • Funil comercial (lead → proposta → contrato), ciclo de venda, pipeline.
//   • Financeiro: margem por tipo, DRE resumido, inadimplência (aging).
//   • Operacional: NPS, avaliação média, CSAT.
//   • Construtor de relatórios: agregação dimensão × métrica sobre os eventos.
//
// Consumido por:
//   • /painel/relatorios            (dashboards, construtor, exportação/agendamento)
//   • /api/cron/relatorios-agendados (digest por e-mail — reusa as mesmas funções)
//
// Regras de ouro (espelham lib/licencas.ts, lib/seguros.ts, lib/reservas.ts):
//   • SEM React, SEM Supabase, SEM "R$"/Intl aqui — só números, datas
//     ('YYYY-MM-DD') e flags. A formatação (moeda/locale) é de quem consome
//     (lib/format). O construtor devolve CHAVES cruas ('YYYY-MM', id…), a UI
//     formata.
//   • Determinístico e testável: o "hoje" entra por parâmetro (hojeYMD). Nenhum
//     relógio escondido dentro do cálculo de período/ocupação.

// ── Datas (puras, fuso-agnósticas — só-data ancorada à meia-noite local) ──────
function pad2(n: number): string { return String(n).padStart(2, '0') }

/** Hoje como 'YYYY-MM-DD' no horário local (helper p/ a UI passar à engine). */
export function todayYMD(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

/** Date → 'YYYY-MM-DD'. */
export function ymd(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

const YMD_RE = /^\d{4}-\d{2}-\d{2}/

/** Extrai 'YYYY-MM-DD' de uma data ou timestamp ISO ('2026-06-09T..' → '2026-06-09'). */
export function toYMD(v: string | null | undefined): string | null {
  if (!v) return null
  const m = String(v).match(YMD_RE)
  return m ? m[0] : null
}

/** Dias (inteiro) de `hojeYMD` até `ymd` (negativo = passado). null se inválido. */
export function diasAte(alvoYMD: string | null | undefined, hojeYMD: string): number | null {
  if (!alvoYMD || !YMD_RE.test(alvoYMD)) return null
  const alvo = Date.parse(`${alvoYMD.slice(0, 10)}T00:00:00`)
  const hoje = Date.parse(`${hojeYMD.slice(0, 10)}T00:00:00`)
  if (Number.isNaN(alvo) || Number.isNaN(hoje)) return null
  return Math.round((alvo - hoje) / 86_400_000)
}

/** 'YYYY-MM-DD' + n dias → 'YYYY-MM-DD' (meio-dia evita off-by-one de DST/UTC). */
export function addDiasYMD(d: string, n: number): string {
  if (!YMD_RE.test(d)) return d
  const dt = new Date(`${d.slice(0, 10)}T12:00:00`)
  dt.setDate(dt.getDate() + Math.round(Number(n) || 0))
  return ymd(dt)
}

/** Nº de dias INCLUSIVO entre duas datas só-data (>=1 quando ini<=fim; 0 se invertido). */
export function diasNoRange(iniYMD: string, fimYMD: string): number {
  const d = diasAte(fimYMD, iniYMD)
  return d == null || d < 0 ? 0 : d + 1
}

/** Primeiro dia do mês de uma data. */
export function inicioMes(d: string): string { return `${d.slice(0, 7)}-01` }
/** Último dia do mês de uma data. */
export function fimMes(d: string): string {
  const dt = new Date(`${d.slice(0, 7)}-01T12:00:00`)
  return ymd(new Date(dt.getFullYear(), dt.getMonth() + 1, 0))
}

/** Lista de chaves 'YYYY-MM' cobrindo o intervalo (inclusive). */
export function mesesNoRange(iniYMD: string, fimYMD: string): string[] {
  const out: string[] = []
  let y = Number(iniYMD.slice(0, 4)), m = Number(iniYMD.slice(5, 7))
  const yf = Number(fimYMD.slice(0, 4)), mf = Number(fimYMD.slice(5, 7))
  let guard = 0
  while ((y < yf || (y === yf && m <= mf)) && guard++ < 600) {
    out.push(`${y}-${pad2(m)}`)
    m++; if (m > 12) { m = 1; y++ }
  }
  return out
}

// ── Período (presets + comparativo "período anterior") ───────────────────────
export type PeriodoPreset = 'mes' | 'trimestre' | 'ano' | '12meses' | 'personalizado'

export type Range = { ini: string; fim: string }

/** Intervalo [ini,fim] de um preset, a partir de hoje. `custom` para personalizado. */
export function periodoRange(preset: PeriodoPreset, hojeYMD: string, custom?: Partial<Range>): Range {
  const y = Number(hojeYMD.slice(0, 4)), m = Number(hojeYMD.slice(5, 7))
  const d0 = (yy: number, mm: number, dd: number) => ymd(new Date(yy, mm - 1, dd))
  switch (preset) {
    case 'ano': return { ini: `${y}-01-01`, fim: `${y}-12-31` }
    case 'trimestre': return { ini: fimMes(d0(y, m - 2, 1)).replace(/-\d\d$/, '-01'), fim: fimMes(d0(y, m, 1)) }
    case '12meses': return { ini: inicioMes(addDiasYMD(`${y}-${pad2(m)}-01`, -334)), fim: fimMes(hojeYMD) }
    case 'personalizado': return {
      ini: custom?.ini && YMD_RE.test(custom.ini) ? custom.ini : inicioMes(hojeYMD),
      fim: custom?.fim && YMD_RE.test(custom.fim) ? custom.fim : fimMes(hojeYMD),
    }
    case 'mes':
    default: return { ini: inicioMes(hojeYMD), fim: fimMes(hojeYMD) }
  }
}

/** Rótulo PT do preset de período (default; a UI pode reescrever p/ i18n). */
export function periodoLabel(preset: PeriodoPreset): string {
  return { mes: 'Mês atual', trimestre: 'Trimestre', ano: 'Ano atual', '12meses': 'Últimos 12 meses', personalizado: 'Período personalizado' }[preset] || 'Período'
}

/** Intervalo equivalente IMEDIATAMENTE anterior (mesma duração) — p/ comparativos. */
export function periodoAnterior(r: Range): Range {
  const dias = diasNoRange(r.ini, r.fim)
  return { ini: addDiasYMD(r.ini, -dias), fim: addDiasYMD(r.ini, -1) }
}

/** Variação percentual de `a` vs `b` (inteiro). b=0 → 100 se a>0, senão 0. */
export function variacao(a: number, b: number): number {
  if (!b) return a > 0 ? 100 : 0
  return Math.round(((a - b) / Math.abs(b)) * 100)
}

/** `ymd` está dentro de [ini,fim] inclusivo? */
export function noRange(d: string | null | undefined, r: Range): boolean {
  const x = toYMD(d)
  return !!x && x >= r.ini && x <= r.fim
}

// ─────────────────────────────────────────────────────────────────────────────
// TIPOS DE ENTRADA (mínimos que a engine lê — a UI/_lib monta a partir das
// tabelas reais: clientes_eventos, lancamentos, parcelas, reservas, espacos…).
// ─────────────────────────────────────────────────────────────────────────────
export type EventoBI = {
  id: string
  nome_evento?: string | null
  tipo_evento?: string | null
  status?: string | null
  data_inicio?: string | null
  data_fim?: string | null
  valor_total_num?: number | null
  propriedade_id?: number | null
  qtd_adultos?: number | null
  qtd_criancas?: number | null
  quem_contratou?: string | null
  cliente_id?: string | null
  como_conheceu?: string | null
  criado_em?: string | null
}
export type LancamentoBI = { tipo: string; valor: number; data?: string | null; categoria?: string | null; tipo_evento?: string | null; status?: string | null }
export type ParcelaBI = { valor: number; vencimento?: string | null; status?: string | null; pago_em?: string | null }
export type ReservaBI = { espaco_id?: number | null; propriedade_id?: number | null; status?: string | null; inicio?: string | null; fim?: string | null; data_inicio?: string | null; data_fim?: string | null }
export type EspacoBI = { id: number; propriedade_id?: number | null; nome?: string | null; capacidade?: number | null; area_m2?: number | null }
export type RespostaNpsBI = { nps?: number | null; criado_em?: string | null }
export type AvaliacaoBI = { nota?: number | null; criado_em?: string | null }
export type FeedbackBI = { nota_geral?: number | null; criado_em?: string | null }

// ─────────────────────────────────────────────────────────────────────────────
// FUNIL COMERCIAL — lead → proposta → contrato (+ ciclo de venda, perdas).
// ─────────────────────────────────────────────────────────────────────────────
// Ranking dos estágios do CRM (clientes_eventos.status). Negativos = terminal
// negativo (não conta como lead ativo). A UI pode reescrever os rótulos.
const STAGE_RANK: Record<string, number> = {
  lead: 0, aberta: 0, aberto: 0, consultada: 0, novo: 0,
  visita: 1, negociacao: 1, em_cotacao: 1, cotacao: 1, proposta: 1, qualificado: 1, reserva: 1,
  contratado: 2, confirmado: 2, fechado: 2, ganho: 2, briefing: 2, pronto: 2, montagem: 2,
  realizado: 3, finalizado: 3, concluido: 3, pos: 3,
  cancelado: -1, perdido: -1, descartado: -1, recusada: -1,
}
export function stageRank(status: string | null | undefined): number {
  const s = (status || 'lead').toLowerCase().trim()
  return STAGE_RANK[s] ?? 0
}

export type FunilComercial = {
  leads: number
  propostas: number
  contratos: number
  perdidos: number
  convProposta: number   // propostas / leads
  convContrato: number   // contratos / propostas
  convGeral: number      // contratos / leads
  cicloMedioDias: number | null
  valorContratado: number
}
/**
 * Funil comercial a partir dos eventos do CRM. Um evento "virou proposta" se o
 * estágio ≥ proposta OU se há proposta registrada (`comProposta`); "virou
 * contrato" se estágio ≥ contratado OU há contrato assinado (`assinadoEm` mapeado).
 * Ciclo de venda = média de dias entre criação do evento e a assinatura.
 */
export function funilComercial(
  eventos: EventoBI[],
  opts: { comProposta?: Set<string>; assinadoEm?: Map<string, string> } = {},
): FunilComercial {
  const comProposta = opts.comProposta || new Set<string>()
  const assinadoEm = opts.assinadoEm || new Map<string, string>()
  let leads = 0, propostas = 0, contratos = 0, perdidos = 0, valorContratado = 0
  let ciclos = 0, ciclosN = 0
  for (const e of eventos) {
    const rank = stageRank(e.status)
    if (rank === -1) { perdidos++; continue }
    leads++
    const temProposta = rank >= 1 || comProposta.has(e.id)
    const temContrato = rank >= 2 || assinadoEm.has(e.id)
    if (temProposta) propostas++
    if (temContrato) {
      contratos++
      valorContratado += Number(e.valor_total_num) || 0
      const assinado = assinadoEm.get(e.id)
      const dias = assinado && e.criado_em ? diasAte(toYMD(assinado)!, toYMD(e.criado_em)!) : null
      if (dias != null && dias >= 0) { ciclos += dias; ciclosN++ }
    }
  }
  return {
    leads, propostas, contratos, perdidos,
    convProposta: leads > 0 ? propostas / leads : 0,
    convContrato: propostas > 0 ? contratos / propostas : 0,
    convGeral: leads > 0 ? contratos / leads : 0,
    cicloMedioDias: ciclosN > 0 ? Math.round(ciclos / ciclosN) : null,
    valorContratado,
  }
}

// Pesos de probabilidade por estágio (pipeline ponderado — espelha o Financeiro).
const PESO_PIPELINE: Record<string, number> = {
  lead: 0.1, aberta: 0.1, aberto: 0.1, consultada: 0.2, novo: 0.1,
  visita: 0.35, negociacao: 0.5, em_cotacao: 0.4, cotacao: 0.4, proposta: 0.6, qualificado: 0.45, reserva: 0.7,
}
/** Valor em pipeline ponderado pela probabilidade do estágio (só negociações em aberto). */
export function pipelinePonderado(eventos: EventoBI[]): number {
  let total = 0
  for (const e of eventos) {
    const rank = stageRank(e.status)
    if (rank !== 0 && rank !== 1) continue // só leads/negociação em aberto
    const peso = PESO_PIPELINE[(e.status || 'lead').toLowerCase().trim()] ?? 0.1
    total += (Number(e.valor_total_num) || 0) * peso
  }
  return total
}

// ── Ticket médio por tipo de evento ──────────────────────────────────────────
export type GrupoValor = { chave: string; soma: number; n: number; media: number }
/** Agrupa eventos por tipo_evento → soma/contagem/ticket médio (valor_total_num). */
export function ticketMedioPorTipo(eventos: EventoBI[]): GrupoValor[] {
  const m = new Map<string, { soma: number; n: number }>()
  for (const e of eventos) {
    const v = Number(e.valor_total_num) || 0
    if (v <= 0) continue
    const k = (e.tipo_evento || '').trim() || 'Não classificado'
    const cur = m.get(k) || { soma: 0, n: 0 }
    cur.soma += v; cur.n++; m.set(k, cur)
  }
  return [...m.entries()]
    .map(([chave, { soma, n }]) => ({ chave, soma, n, media: n > 0 ? soma / n : 0 }))
    .sort((a, b) => b.soma - a.soma)
}

// ─────────────────────────────────────────────────────────────────────────────
// FINANCEIRO — receita/margem por tipo, DRE resumido, aging/inadimplência.
// ─────────────────────────────────────────────────────────────────────────────
export type MargemTipo = { chave: string; receita: number; despesa: number; margem: number }
/** Receita, despesa e margem por tipo de evento (do caixa: lancamentos). */
export function margemPorTipo(lancamentos: LancamentoBI[]): MargemTipo[] {
  const m = new Map<string, { receita: number; despesa: number }>()
  for (const l of lancamentos) {
    const k = (l.tipo_evento || '').trim() || 'Não classificado'
    const cur = m.get(k) || { receita: 0, despesa: 0 }
    if (l.tipo === 'receita') cur.receita += Number(l.valor) || 0
    else if (l.tipo === 'despesa') cur.despesa += Number(l.valor) || 0
    m.set(k, cur)
  }
  return [...m.entries()]
    .map(([chave, { receita, despesa }]) => ({ chave, receita, despesa, margem: receita > 0 ? (receita - despesa) / receita : 0 }))
    .filter((x) => x.receita > 0 || x.despesa > 0)
    .sort((a, b) => b.receita - a.receita)
}

export type DRE = { receita: number; despesas: [string, number][]; totalDespesa: number; resultado: number; margem: number }
/** DRE resumido (caixa): receita bruta − despesas por categoria = resultado. */
export function dreResumido(lancamentos: LancamentoBI[]): DRE {
  let receita = 0
  const desp = new Map<string, number>()
  for (const l of lancamentos) {
    if (l.tipo === 'receita') receita += Number(l.valor) || 0
    else if (l.tipo === 'despesa') {
      const k = (l.categoria || '').trim() || 'Outros'
      desp.set(k, (desp.get(k) || 0) + (Number(l.valor) || 0))
    }
  }
  const despesas = [...desp.entries()].sort((a, b) => b[1] - a[1])
  const totalDespesa = despesas.reduce((s, [, v]) => s + v, 0)
  return { receita, despesas, totalDespesa, resultado: receita - totalDespesa, margem: receita > 0 ? (receita - totalDespesa) / receita : 0 }
}

export type Aging = { aVencer: number; atraso30: number; atraso30mais: number; vencido: number; total: number; recebido: number; nAtraso: number; inadimplencia: number }
/** Aging das parcelas a receber + inadimplência (vencido / carteira a receber). */
export function agingParcelas(parcelas: ParcelaBI[], hojeYMD: string): Aging {
  let aVencer = 0, atraso30 = 0, atraso30mais = 0, recebido = 0, nAtraso = 0
  for (const p of parcelas) {
    const status = (p.status || 'pendente').toLowerCase()
    const valor = Number(p.valor) || 0
    if (status === 'pago') { recebido += valor; continue }
    if (status === 'cancelado') continue
    const atraso = p.vencimento ? -(diasAte(toYMD(p.vencimento)!, hojeYMD) ?? 0) : -1 // dias de atraso (>0 vencido)
    if (atraso <= 0) aVencer += valor
    else if (atraso <= 30) { atraso30 += valor; nAtraso++ }
    else { atraso30mais += valor; nAtraso++ }
  }
  const vencido = atraso30 + atraso30mais
  const total = aVencer + vencido
  return { aVencer, atraso30, atraso30mais, vencido, total, recebido, nAtraso, inadimplencia: total > 0 ? vencido / total : 0 }
}

// ─────────────────────────────────────────────────────────────────────────────
// OCUPAÇÃO / REVPAS / RECEITA POR M² — indicadores próprios do nicho.
// ─────────────────────────────────────────────────────────────────────────────
// Um "bloco" é um intervalo que ocupa um espaço (vem de reservas confirmadas/
// bloqueios ou de eventos contratados). A engine só faz a matemática de dias.
export type BlocoOcupacao = { espaco: string; ini: string; fim: string }

export type Ocupacao = {
  diasOcupados: number          // space-days distintos ocupados (dedup por espaço/dia)
  spaceDaysDisponiveis: number  // nEspacos × dias do período
  taxa: number                  // diasOcupados / spaceDaysDisponiveis (0..1)
  porEspaco: Record<string, number> // espaço → dias ocupados
}
/**
 * Ocupação no período: conta space-days DISTINTOS ocupados (cada espaço só conta
 * uma vez por dia, mesmo com blocos sobrepostos), recortando cada bloco ao
 * intervalo. Determinístico — base de RevPAS e da taxa de ocupação.
 */
export function calcularOcupacao(blocos: BlocoOcupacao[], nEspacos: number, r: Range): Ocupacao {
  const porEspacoSet = new Map<string, Set<string>>()
  const todos = new Set<string>()
  for (const b of blocos) {
    const ini = toYMD(b.ini), fim = toYMD(b.fim || b.ini)
    if (!ini) continue
    const lo = ini < r.ini ? r.ini : ini
    const hi = (fim || ini) > r.fim ? r.fim : (fim || ini)
    if (hi < lo) continue
    let dia = lo, guard = 0
    const set = porEspacoSet.get(b.espaco) || new Set<string>()
    while (dia <= hi && guard++ < 1000) {
      set.add(dia)
      todos.add(`${b.espaco}|${dia}`)
      dia = addDiasYMD(dia, 1)
    }
    porEspacoSet.set(b.espaco, set)
  }
  const dias = diasNoRange(r.ini, r.fim)
  const spaceDaysDisponiveis = Math.max(0, nEspacos) * dias
  const porEspaco: Record<string, number> = {}
  porEspacoSet.forEach((set, k) => { porEspaco[k] = set.size })
  return {
    diasOcupados: todos.size,
    spaceDaysDisponiveis,
    taxa: spaceDaysDisponiveis > 0 ? todos.size / spaceDaysDisponiveis : 0,
    porEspaco,
  }
}

// Status de reserva que efetivamente OCUPAM o espaço (espelha lib/reservas.ts /
// o Calendário). Holds e canceladas não contam.
const OCUPA_RESERVA = new Set(['confirmada', 'bloqueio', 'manutencao', 'aprovada', 'confirmado'])

/**
 * Monta os blocos de ocupação a partir das reservas que ocupam (nível espaço).
 * Quando NÃO há espaços cadastrados, cada propriedade conta como 1 espaço e os
 * eventos CONTRATADOS (stageRank≥2) entram como blocos (nível propriedade) — a
 * ocupação funciona mesmo sem o módulo de multi-espaços. Pura/determinística.
 */
export function montarBlocosOcupacao(
  reservas: ReservaBI[], eventos: EventoBI[], espacos: EspacoBI[], props: { id: number }[], propFiltro: number | null,
): { blocos: BlocoOcupacao[]; nEspacos: number; areaTotal: number } {
  const esp = propFiltro != null ? espacos.filter((e) => e.propriedade_id === propFiltro) : espacos
  const ps = propFiltro != null ? props.filter((p) => p.id === propFiltro) : props
  const temEspacos = esp.length > 0
  const blocos: BlocoOcupacao[] = []

  for (const r of reservas) {
    if (!OCUPA_RESERVA.has((r.status || '').toLowerCase())) continue
    if (propFiltro != null && r.propriedade_id !== propFiltro) continue
    const ini = toYMD(r.inicio || r.data_inicio)
    if (!ini) continue
    blocos.push({ espaco: r.espaco_id != null ? `esp:${r.espaco_id}` : `prop:${r.propriedade_id ?? '0'}`, ini, fim: toYMD(r.fim || r.data_fim) || ini })
  }
  if (!temEspacos) {
    for (const e of eventos) {
      if (stageRank(e.status) < 2) continue
      if (propFiltro != null && e.propriedade_id !== propFiltro) continue
      const ini = toYMD(e.data_inicio)
      if (!ini) continue
      blocos.push({ espaco: `prop:${e.propriedade_id ?? '0'}`, ini, fim: toYMD(e.data_fim) || ini })
    }
  }
  return { blocos, nEspacos: temEspacos ? esp.length : Math.max(1, ps.length), areaTotal: esp.reduce((s, e) => s + (Number(e.area_m2) || 0), 0) }
}

/** RevPAS — receita ÷ (espaços × dias disponíveis). 0 se não há space-days. */
export function revpas(receita: number, nEspacos: number, dias: number): number {
  const denom = Math.max(0, nEspacos) * Math.max(0, dias)
  return denom > 0 ? (Number(receita) || 0) / denom : 0
}

/** Receita por m² — null se a área total não está cadastrada (degrade gracioso). */
export function receitaPorM2(receita: number, areaM2Total: number): number | null {
  return areaM2Total > 0 ? (Number(receita) || 0) / areaM2Total : null
}

/** Receita por evento — receita ÷ nº de eventos. 0 se não há eventos. */
export function receitaPorEvento(receita: number, nEventos: number): number {
  return nEventos > 0 ? (Number(receita) || 0) / nEventos : 0
}

// ─────────────────────────────────────────────────────────────────────────────
// OPERACIONAL — NPS, avaliação média, CSAT.
// ─────────────────────────────────────────────────────────────────────────────
export type NpsResumo = { score: number; promotores: number; neutros: number; detratores: number; total: number }
/** NPS clássico: promotores (9–10) − detratores (0–6), em pontos (−100..100). */
export function calcularNps(respostas: RespostaNpsBI[]): NpsResumo {
  let promotores = 0, neutros = 0, detratores = 0, total = 0
  for (const r of respostas) {
    const n = Number(r.nps)
    if (!Number.isFinite(n)) continue
    total++
    if (n >= 9) promotores++
    else if (n >= 7) neutros++
    else detratores++
  }
  return { score: total > 0 ? Math.round(((promotores - detratores) / total) * 100) : 0, promotores, neutros, detratores, total }
}

export type MediaResumo = { media: number; n: number }
/** Média de avaliações (notas 1–5) + contagem. */
export function mediaAvaliacoes(avs: AvaliacaoBI[]): MediaResumo {
  const notas = avs.map((a) => Number(a.nota)).filter((n) => Number.isFinite(n) && n > 0)
  return { media: notas.length ? notas.reduce((s, n) => s + n, 0) / notas.length : 0, n: notas.length }
}
/** CSAT a partir de feedbacks (nota_geral 1–5): média + % de satisfeitos (≥4). */
export function csatFeedbacks(fbs: FeedbackBI[]): MediaResumo & { satisfacao: number } {
  const notas = fbs.map((f) => Number(f.nota_geral)).filter((n) => Number.isFinite(n) && n > 0)
  const media = notas.length ? notas.reduce((s, n) => s + n, 0) / notas.length : 0
  const sat = notas.length ? notas.filter((n) => n >= 4).length / notas.length : 0
  return { media, n: notas.length, satisfacao: sat }
}

// ─────────────────────────────────────────────────────────────────────────────
// CLIENTES — recorrência, origem, top por valor.
// ─────────────────────────────────────────────────────────────────────────────
export type ClientesResumo = {
  distintos: number
  recorrentes: number          // clientes com ≥2 eventos
  taxaRecorrencia: number
  porOrigem: GrupoContagem[]    // como_conheceu
  topClientes: { chave: string; soma: number; n: number }[]
}
export type GrupoContagem = { chave: string; n: number }
function chaveCliente(e: EventoBI): string {
  return (e.cliente_id || '').trim() || (e.quem_contratou || '').trim().toLowerCase() || `evt:${e.id}`
}
/** Resumo de clientes: distintos, recorrentes (≥2 eventos), origem, top por valor. */
export function clientesResumo(eventos: EventoBI[]): ClientesResumo {
  const porCliente = new Map<string, { soma: number; n: number; label: string }>()
  const origem = new Map<string, number>()
  for (const e of eventos) {
    const k = chaveCliente(e)
    const cur = porCliente.get(k) || { soma: 0, n: 0, label: (e.quem_contratou || '').trim() || 'Cliente' }
    cur.soma += Number(e.valor_total_num) || 0; cur.n++; porCliente.set(k, cur)
    const o = (e.como_conheceu || '').trim() || 'Não informado'
    origem.set(o, (origem.get(o) || 0) + 1)
  }
  const recorrentes = [...porCliente.values()].filter((c) => c.n >= 2).length
  const distintos = porCliente.size
  return {
    distintos,
    recorrentes,
    taxaRecorrencia: distintos > 0 ? recorrentes / distintos : 0,
    porOrigem: [...origem.entries()].map(([chave, n]) => ({ chave, n })).sort((a, b) => b.n - a.n),
    topClientes: [...porCliente.values()].map((c) => ({ chave: c.label, soma: c.soma, n: c.n })).sort((a, b) => b.soma - a.soma).slice(0, 8),
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CONSTRUTOR DE RELATÓRIOS — dimensão × métrica sobre os eventos (CRM).
// ─────────────────────────────────────────────────────────────────────────────
export type Dimensao = 'mes' | 'propriedade' | 'tipo' | 'cliente' | 'canal' | 'status'
export type Metrica = 'eventos' | 'receita' | 'ticket' | 'publico'

export const DIMENSOES: { v: Dimensao; label: string }[] = [
  { v: 'mes', label: 'Mês' },
  { v: 'propriedade', label: 'Propriedade' },
  { v: 'tipo', label: 'Tipo de evento' },
  { v: 'cliente', label: 'Cliente' },
  { v: 'canal', label: 'Canal de origem' },
  { v: 'status', label: 'Estágio do funil' },
]
export const METRICAS: { v: Metrica; label: string; formato: 'moeda' | 'numero' }[] = [
  { v: 'eventos', label: 'Nº de eventos', formato: 'numero' },
  { v: 'receita', label: 'Receita contratada', formato: 'moeda' },
  { v: 'ticket', label: 'Ticket médio', formato: 'moeda' },
  { v: 'publico', label: 'Público total', formato: 'numero' },
]

/** Chave crua de um evento para uma dimensão (a UI traduz id→nome, mês→rótulo). */
export function chaveDimensao(e: EventoBI, dim: Dimensao): string {
  switch (dim) {
    case 'mes': return toYMD(e.data_inicio || e.criado_em)?.slice(0, 7) || 'sem-data'
    case 'propriedade': return e.propriedade_id != null ? String(e.propriedade_id) : 'sem-propriedade'
    case 'tipo': return (e.tipo_evento || '').trim() || 'Não classificado'
    case 'cliente': return (e.quem_contratou || '').trim() || 'Não informado'
    case 'canal': return (e.como_conheceu || '').trim() || 'Não informado'
    case 'status': return (e.status || '').trim().toLowerCase() || 'lead'
    default: return '—'
  }
}

export type LinhaAgregada = { chave: string; valor: number; n: number; soma: number }
/**
 * Agrega os eventos por uma dimensão calculando a métrica escolhida. Devolve
 * chaves CRUAS (a UI formata) ordenadas: por valor (desc) para métricas
 * numéricas; cronologicamente quando a dimensão é o mês.
 */
export function agregar(eventos: EventoBI[], dim: Dimensao, metrica: Metrica): LinhaAgregada[] {
  const m = new Map<string, { soma: number; n: number }>()
  for (const e of eventos) {
    const k = chaveDimensao(e, dim)
    const cur = m.get(k) || { soma: 0, n: 0 }
    if (metrica === 'publico') cur.soma += (Number(e.qtd_adultos) || 0) + (Number(e.qtd_criancas) || 0)
    else cur.soma += Number(e.valor_total_num) || 0 // receita/ticket usam valor; eventos usa n
    cur.n++; m.set(k, cur)
  }
  const linhas = [...m.entries()].map(([chave, { soma, n }]) => ({
    chave, soma, n,
    valor: metrica === 'eventos' ? n : metrica === 'ticket' ? (n > 0 ? soma / n : 0) : soma,
  }))
  if (dim === 'mes') return linhas.sort((a, b) => a.chave.localeCompare(b.chave))
  return linhas.sort((a, b) => b.valor - a.valor)
}

// ── Série mensal genérica (p/ gráficos de evolução) ──────────────────────────
export type PontoMensal = { mes: string; valor: number }
/**
 * Soma `valorDe(item)` por mês (chave 'YYYY-MM' via `dataDe`) cobrindo todos os
 * meses do range (meses sem dado vêm com 0). Pronto p/ linha/barra de evolução.
 */
export function serieMensal<T>(
  itens: T[], dataDe: (x: T) => string | null | undefined, valorDe: (x: T) => number, r: Range,
): PontoMensal[] {
  const base = new Map(mesesNoRange(r.ini, r.fim).map((mes) => [mes, 0]))
  for (const it of itens) {
    const mes = toYMD(dataDe(it))?.slice(0, 7)
    if (mes && base.has(mes)) base.set(mes, (base.get(mes) || 0) + (Number(valorDe(it)) || 0))
  }
  return [...base.entries()].map(([mes, valor]) => ({ mes, valor }))
}

// ── Detecção de "tabela ainda não criada" (rodar o SQL) ──────────────────────
export function isMissingTable(err: { code?: string | null; message?: string | null } | null | undefined): boolean {
  if (!err) return false
  return err.code === 'PGRST205' || err.code === '42P01' ||
    /could not find the table|schema cache|does not exist/i.test(err.message || '')
}

// ── Agendamento de relatórios (próxima execução) ─────────────────────────────
export type Frequencia = 'diario' | 'semanal' | 'mensal'
/**
 * Próxima data de execução ('YYYY-MM-DD') de um agendamento a partir de `aPartir`
 * (exclusivo): diário = amanhã; semanal = próximo `diaSemana` (0=Dom);
 * mensal = próximo dia `diaMes` (1–28). Determinístico (sem relógio).
 */
export function proximaExecucao(freq: Frequencia, aPartirYMD: string, opts: { diaSemana?: number; diaMes?: number } = {}): string {
  if (freq === 'diario') return addDiasYMD(aPartirYMD, 1)
  if (freq === 'semanal') {
    const alvo = ((Number(opts.diaSemana) || 0) % 7 + 7) % 7
    const base = new Date(`${aPartirYMD}T12:00:00`)
    let delta = (alvo - base.getDay() + 7) % 7
    if (delta === 0) delta = 7
    return addDiasYMD(aPartirYMD, delta)
  }
  // mensal
  const dia = Math.min(28, Math.max(1, Number(opts.diaMes) || 1))
  const base = new Date(`${aPartirYMD}T12:00:00`)
  let y = base.getFullYear(), m = base.getMonth() // 0-based
  if (base.getDate() >= dia) { m++; if (m > 11) { m = 0; y++ } }
  return ymd(new Date(y, m, dia))
}
