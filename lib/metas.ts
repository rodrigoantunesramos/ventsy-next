// Motor PURO de Metas & OKR da Ventsy.
// ─────────────────────────────────────────────────────────────────────────────
// Transforma os números espalhados pelos módulos (Financeiro, CRM, Pesquisas,
// Avaliações) em ALVO × REALIZADO acompanhado automaticamente, com projeção de
// fechamento (run-rate), semáforo e OKRs por trimestre.
//
// Consumido por:
//   • /painel/metas            (Quadro de metas, OKRs, Histórico)
//   • _lib.ts da página         (lê as tabelas-fonte e chama avaliarMeta)
//
// Regras de ouro (espelham lib/licencas.ts, lib/seguros.ts, lib/reservas.ts):
//   • SEM React, SEM Supabase, SEM "R$"/Intl aqui — só números, datas
//     (YYYY-MM-DD) e flags. A formatação (moeda/percent/locale) fica em
//     lib/format, chamada por quem exibe, escolhida pela `unidade` da métrica.
//   • Determinístico e testável: o "hoje" entra por parâmetro (hojeYMD). Nada de
//     relógio escondido dentro da lógica de período/projeção/semáforo.
//   • O "realizado" NÃO é lido aqui — quem usa traz o valor já agregado da fonte
//     certa e passa para `avaliarMeta`. Assim o motor continua puro e testável.

// ── Datas (puras, sem fuso — só-data ancorada ao meio-dia local) ─────────────
function pad2(n: number): string { return String(n).padStart(2, '0') }

/** Data de hoje como 'YYYY-MM-DD' no horário local (helper p/ a UI passar ao motor). */
export function todayYMD(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

/** Dias de `hojeYMD` até `ymd` (negativo = no passado). null se `ymd` inválido. */
export function diasAte(ymd: string | null | undefined, hojeYMD: string): number | null {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null
  const alvo = Date.parse(`${ymd}T00:00:00`)
  const hoje = Date.parse(`${hojeYMD}T00:00:00`)
  if (Number.isNaN(alvo) || Number.isNaN(hoje)) return null
  return Math.round((alvo - hoje) / 86_400_000)
}

/** Último dia (número) do mês 0-indexado de um ano. */
function ultimoDiaDoMes(ano: number, mes0: number): number {
  return new Date(ano, mes0 + 1, 0).getDate()
}

// ── Período (granularidade + janela absoluta) ────────────────────────────────
export type Granularidade = 'mes' | 'trimestre' | 'ano'

export type Periodo = {
  gran: Granularidade
  key: string   // canônico: 'YYYY-MM' | 'YYYY-Qn' | 'YYYY'
  ini: string   // 'YYYY-MM-DD' (inclusive)
  fim: string   // 'YYYY-MM-DD' (inclusive)
}

export const GRANS: { v: Granularidade; label: string }[] = [
  { v: 'mes',        label: 'Mês' },
  { v: 'trimestre',  label: 'Trimestre' },
  { v: 'ano',        label: 'Ano' },
]

/**
 * Período absoluto a partir de hoje + um deslocamento (0 = atual, -1 = anterior,
 * +1 = próximo). Deslocamento em unidades da granularidade. Determinístico.
 */
export function periodoDeOffset(gran: Granularidade, offset: number, hojeYMD: string): Periodo {
  const [y, m] = hojeYMD.split('-').map(Number)
  const ano = y
  const mes0 = (m || 1) - 1
  const off = Math.round(Number(offset) || 0)

  if (gran === 'ano') {
    const a = ano + off
    return { gran, key: `${a}`, ini: `${a}-01-01`, fim: `${a}-12-31` }
  }
  if (gran === 'trimestre') {
    const qAtual = Math.floor(mes0 / 3)              // 0..3
    const total = ano * 4 + qAtual + off
    const a = Math.floor(total / 4)
    const q = ((total % 4) + 4) % 4                  // 0..3
    const mIni = q * 3
    const dFim = ultimoDiaDoMes(a, mIni + 2)
    return { gran, key: `${a}-Q${q + 1}`, ini: `${a}-${pad2(mIni + 1)}-01`, fim: `${a}-${pad2(mIni + 3)}-${pad2(dFim)}` }
  }
  // mês
  const total = ano * 12 + mes0 + off
  const a = Math.floor(total / 12)
  const mo = ((total % 12) + 12) % 12
  const dFim = ultimoDiaDoMes(a, mo)
  return { gran, key: `${a}-${pad2(mo + 1)}`, ini: `${a}-${pad2(mo + 1)}-01`, fim: `${a}-${pad2(mo + 1)}-${pad2(dFim)}` }
}

/** Reconstrói um período a partir da chave canônica. null se a chave for inválida. */
export function parsePeriodoKey(key: string | null | undefined): Periodo | null {
  if (!key) return null
  if (/^\d{4}$/.test(key)) {
    return { gran: 'ano', key, ini: `${key}-01-01`, fim: `${key}-12-31` }
  }
  const q = /^(\d{4})-Q([1-4])$/.exec(key)
  if (q) {
    const a = Number(q[1]); const qi = Number(q[2]) - 1; const mIni = qi * 3
    return { gran: 'trimestre', key, ini: `${a}-${pad2(mIni + 1)}-01`, fim: `${a}-${pad2(mIni + 3)}-${pad2(ultimoDiaDoMes(a, mIni + 2))}` }
  }
  const mo = /^(\d{4})-(\d{2})$/.exec(key)
  if (mo) {
    const a = Number(mo[1]); const mi = Number(mo[2]) - 1
    if (mi < 0 || mi > 11) return null
    return { gran: 'mes', key, ini: `${a}-${pad2(mi + 1)}-01`, fim: `${a}-${pad2(mi + 1)}-${pad2(ultimoDiaDoMes(a, mi))}` }
  }
  return null
}

/**
 * Fração do período já decorrida em `hojeYMD` (0..1). Antes do início → 0;
 * depois do fim → 1 (período fechado). Inclusiva por dia — base do run-rate.
 */
export function fracaoDecorrida(p: Periodo, hojeYMD: string): number {
  const total = (diasAte(p.fim, p.ini) ?? 0) + 1
  if (total <= 0) return 1
  const decorridos = (diasAte(hojeYMD, p.ini) ?? 0) + 1
  if (decorridos <= 0) return 0
  if (decorridos >= total) return 1
  return decorridos / total
}

/** Período já encerrado (passado) em relação a hoje? */
export function periodoEncerrado(p: Periodo, hojeYMD: string): boolean {
  return (diasAte(p.fim, hojeYMD) ?? 0) < 0
}

// ── Áreas ────────────────────────────────────────────────────────────────────
export type Area = 'comercial' | 'financeiro' | 'operacional' | 'marketing' | 'pessoas'
export type AreaMeta = { v: Area; label: string; cor: string }
export const AREAS: AreaMeta[] = [
  { v: 'comercial',   label: 'Comercial',    cor: '#ff385c' },
  { v: 'financeiro',  label: 'Financeiro',   cor: '#10b981' },
  { v: 'operacional', label: 'Operacional',  cor: '#1a73e8' },
  { v: 'marketing',   label: 'Marketing',    cor: '#a855f7' },
  { v: 'pessoas',     label: 'Pessoas',      cor: '#f59e0b' },
]
const AREA_BY = Object.fromEntries(AREAS.map((a) => [a.v, a])) as Record<string, AreaMeta>
export function areaMeta(v: string | null | undefined): AreaMeta {
  return AREA_BY[v || ''] || { v: 'comercial', label: v || '—', cor: '#94a3b8' }
}

// ── Catálogo de métricas ──────────────────────────────────────────────────────
// `unidade` decide o formatador na UI; `sentido` decide se MAIOR ou MENOR é
// melhor; `auto` indica que o realizado é calculado da fonte; `store` diz em qual
// tabela o ALVO mora — as 3 métricas-núcleo do Financeiro reusam `metas_financeiras`
// (mesma convenção do /painel/financeiro), o resto vive em `metas`.
export type Unidade = 'moeda' | 'numero' | 'percent' | 'nota' | 'nps'
export type Sentido = 'maior_melhor' | 'menor_melhor'
export type Store = 'metas' | 'metas_financeiras'

export type MetricaMeta = {
  v: string
  area: Area
  label: string
  unidade: Unidade
  sentido: Sentido
  auto: boolean      // realizado calculado automaticamente da fonte
  store: Store       // onde o alvo é persistido
  fonte: string      // rótulo curto da origem do realizado
  descricao: string
}

export const METRICAS: MetricaMeta[] = [
  // Financeiro — reusa metas_financeiras (sincronizado com /painel/financeiro)
  { v: 'receita',      area: 'financeiro',  label: 'Receita',              unidade: 'moeda',   sentido: 'maior_melhor', auto: true,  store: 'metas_financeiras', fonte: 'Financeiro (caixa)',   descricao: 'Receita realizada no caixa (lançamentos).' },
  { v: 'lucro',        area: 'financeiro',  label: 'Lucro líquido',        unidade: 'moeda',   sentido: 'maior_melhor', auto: true,  store: 'metas_financeiras', fonte: 'Financeiro (caixa)',   descricao: 'Receita menos despesas no período.' },
  { v: 'adimplencia',  area: 'financeiro',  label: 'Adimplência',          unidade: 'percent', sentido: 'maior_melhor', auto: true,  store: 'metas_financeiras', fonte: 'Financeiro (caixa)',   descricao: 'Lançamentos pagos sobre o total.' },
  // Financeiro — extras (tabela metas)
  { v: 'margem',       area: 'financeiro',  label: 'Margem líquida',       unidade: 'percent', sentido: 'maior_melhor', auto: true,  store: 'metas',             fonte: 'Financeiro (caixa)',   descricao: 'Lucro sobre a receita do período.' },
  { v: 'despesa',      area: 'financeiro',  label: 'Teto de despesas',     unidade: 'moeda',   sentido: 'menor_melhor', auto: true,  store: 'metas',             fonte: 'Financeiro (caixa)',   descricao: 'Limite de despesas — quanto menor, melhor.' },
  // Comercial — CRM (clientes_eventos)
  { v: 'eventos',      area: 'comercial',   label: 'Eventos contratados',  unidade: 'numero',  sentido: 'maior_melhor', auto: true,  store: 'metas',             fonte: 'CRM (eventos)',        descricao: 'Eventos fechados com data no período.' },
  { v: 'leads',        area: 'comercial',   label: 'Novos leads',          unidade: 'numero',  sentido: 'maior_melhor', auto: true,  store: 'metas',             fonte: 'CRM (leads)',          descricao: 'Leads/eventos criados no período.' },
  { v: 'conversao',    area: 'comercial',   label: 'Conversão de leads',   unidade: 'percent', sentido: 'maior_melhor', auto: true,  store: 'metas',             fonte: 'CRM (funil)',          descricao: 'Eventos contratados sobre leads criados.' },
  { v: 'ticket_medio', area: 'comercial',   label: 'Ticket médio',         unidade: 'moeda',   sentido: 'maior_melhor', auto: true,  store: 'metas',             fonte: 'CRM (eventos)',        descricao: 'Valor médio dos eventos contratados.' },
  { v: 'receita_contratada', area: 'comercial', label: 'Receita contratada', unidade: 'moeda', sentido: 'maior_melhor', auto: true, store: 'metas',             fonte: 'CRM (eventos)',        descricao: 'Valor contratado dos eventos do período.' },
  // Operacional
  { v: 'ocupacao',     area: 'operacional', label: 'Ocupação',             unidade: 'percent', sentido: 'maior_melhor', auto: true,  store: 'metas',             fonte: 'CRM (agenda)',         descricao: 'Dias ocupados sobre dias disponíveis dos espaços.' },
  { v: 'eventos_realizados', area: 'operacional', label: 'Eventos realizados', unidade: 'numero', sentido: 'maior_melhor', auto: true, store: 'metas',          fonte: 'CRM (eventos)',        descricao: 'Eventos concluídos no período.' },
  { v: 'nps',          area: 'operacional', label: 'NPS',                  unidade: 'nps',     sentido: 'maior_melhor', auto: true,  store: 'metas',             fonte: 'Pesquisas & NPS',      descricao: 'Net Promoter Score das respostas no período.' },
  // Marketing
  { v: 'avaliacao',    area: 'marketing',   label: 'Avaliação média',      unidade: 'nota',    sentido: 'maior_melhor', auto: true,  store: 'metas',             fonte: 'Avaliações',           descricao: 'Média das avaliações públicas (1–5).' },
  { v: 'cac',          area: 'marketing',   label: 'CAC (custo/cliente)',  unidade: 'moeda',   sentido: 'menor_melhor', auto: true,  store: 'metas',             fonte: 'Marketing + CRM',      descricao: 'Gasto de marketing por novo cliente — quanto menor, melhor.' },
  // Pessoas (manual — sem fonte automática)
  { v: 'personalizada', area: 'pessoas',    label: 'Meta personalizada',   unidade: 'numero',  sentido: 'maior_melhor', auto: false, store: 'metas',             fonte: 'Manual',               descricao: 'Acompanhamento manual — você atualiza o realizado.' },
]
const METRICA_BY = Object.fromEntries(METRICAS.map((m) => [m.v, m])) as Record<string, MetricaMeta>
export function metricaMeta(v: string | null | undefined): MetricaMeta {
  return METRICA_BY[v || ''] || {
    v: v || 'personalizada', area: 'pessoas', label: v || 'Meta', unidade: 'numero',
    sentido: 'maior_melhor', auto: false, store: 'metas', fonte: 'Manual', descricao: '',
  }
}
/** Métricas de uma área. */
export function metricasDaArea(area: Area): MetricaMeta[] {
  return METRICAS.filter((m) => m.area === area)
}

// ── Avaliação de uma meta (alvo × realizado × run-rate) ──────────────────────
export type Semaforo = 'verde' | 'amarelo' | 'vermelho'

export type Avaliacao = {
  alvo: number
  realizado: number
  pct: number        // atingimento atual (0..1+, fração; UI multiplica por 100)
  projecao: number   // valor projetado no fim do período (run-rate linear)
  projPct: number    // atingimento projetado (0..1+)
  atingida: boolean  // meta já cumprida com o realizado atual
  emRisco: boolean   // período em curso e a projeção fica aquém do alvo
  semaforo: Semaforo
}

// Limiares do semáforo pela projeção (atingimento projetado).
const VERDE_MIN = 0.95
const AMARELO_MIN = 0.7

/**
 * Avalia uma meta. `fracao` = fração do período decorrida (0..1) — base da
 * projeção por run-rate linear. Respeita o `sentido`:
 *  • maior_melhor: alvo é piso (atingir/superar é bom).
 *  • menor_melhor: alvo é teto (ficar abaixo é bom) — pct/projeção/semáforo
 *    são invertidos (usa o alvo÷valor para virar "quanto melhor = mais perto de 1").
 */
export function avaliarMeta(
  alvo: number, realizado: number, sentido: Sentido, fracao: number,
): Avaliacao {
  const A = Number(alvo) || 0
  const R = Number(realizado) || 0
  const f = Math.min(1, Math.max(0, Number(fracao) || 0))
  const encerrado = f >= 1

  // Projeção por run-rate: extrapola o realizado para o período inteiro.
  // Para teto (menor_melhor) também faz sentido — projeta o gasto/total final.
  const projecao = f > 0 ? R / f : R

  if (sentido === 'menor_melhor') {
    // Teto: melhor = ficar ≤ alvo. "Atingimento" = quão folgado se está sob o teto.
    const pct = A > 0 ? A / Math.max(R, 1e-9) : (R <= 0 ? 1 : 0)            // ≥1 = dentro do teto
    const projPct = A > 0 ? A / Math.max(projecao, 1e-9) : (projecao <= 0 ? 1 : 0)
    const atingida = A > 0 ? R <= A : R <= 0
    const estouradoFinal = projecao > A
    const emRisco = !encerrado && estouradoFinal
    const semaforo: Semaforo = encerrado
      ? (R <= A ? 'verde' : 'vermelho')
      : (projPct >= VERDE_MIN ? 'verde' : projPct >= AMARELO_MIN ? 'amarelo' : 'vermelho')
    return { alvo: A, realizado: R, pct, projecao, projPct, atingida, emRisco, semaforo }
  }

  // maior_melhor: piso. Atingimento = realizado/alvo.
  const pct = A > 0 ? R / A : (R > 0 ? 1 : 0)
  const projPct = A > 0 ? projecao / A : (projecao > 0 ? 1 : 0)
  const atingida = A > 0 ? R >= A : R > 0
  const emRisco = !encerrado && !atingida && projPct < VERDE_MIN
  const semaforo: Semaforo = atingida
    ? 'verde'
    : encerrado
      ? (pct >= VERDE_MIN ? 'verde' : pct >= AMARELO_MIN ? 'amarelo' : 'vermelho')
      : (projPct >= VERDE_MIN ? 'verde' : projPct >= AMARELO_MIN ? 'amarelo' : 'vermelho')
  return { alvo: A, realizado: R, pct, projecao, projPct, atingida, emRisco, semaforo }
}

// ── Resumo do quadro ──────────────────────────────────────────────────────────
export type ResumoQuadro = {
  total: number
  verde: number
  amarelo: number
  vermelho: number
  atingidas: number
  emRisco: number
  atingimentoMedio: number   // média do pct (limitado a 1 por meta) — 0..1
}
export function resumoQuadro(avs: Avaliacao[]): ResumoQuadro {
  const r: ResumoQuadro = { total: 0, verde: 0, amarelo: 0, vermelho: 0, atingidas: 0, emRisco: 0, atingimentoMedio: 0 }
  let soma = 0
  for (const a of avs) {
    r.total++
    r[a.semaforo]++
    if (a.atingida) r.atingidas++
    if (a.emRisco) r.emRisco++
    soma += Math.min(1, Math.max(0, a.pct))
  }
  r.atingimentoMedio = r.total > 0 ? soma / r.total : 0
  return r
}

// ── OKRs (objetivo + resultados-chave) ────────────────────────────────────────
export type KR = {
  id: string
  titulo: string
  unidade: Unidade
  inicial: number    // baseline (de onde partiu)
  alvo: number       // onde quer chegar
  atual: number      // valor atual (manual ou puxado de `metrica`)
  metrica: string | null   // se setado, o realizado pode vir automático da fonte
}
export type Okr = {
  id?: string
  objetivo: string
  trimestre: string  // chave canônica de trimestre 'YYYY-Qn'
  krs: KR[]
}

/** Progresso de um KR (0..1). Respeita o sentido do alvo vs. baseline (sobe ou desce). */
export function progressoKR(kr: Pick<KR, 'inicial' | 'alvo' | 'atual'>): number {
  const ini = Number(kr.inicial) || 0
  const alvo = Number(kr.alvo) || 0
  const atual = Number(kr.atual) || 0
  const span = alvo - ini
  if (span === 0) return atual >= alvo ? 1 : 0
  const p = (atual - ini) / span
  return Math.min(1, Math.max(0, p))
}

export type ProgressoOkr = {
  progresso: number              // média dos KRs (0..1)
  krs: { kr: KR; progresso: number }[]
  status: 'no_caminho' | 'atencao' | 'em_risco' | 'concluido'
  concluidos: number
  total: number
}
/** Progresso de um OKR = média simples do progresso dos KRs + status agregado. */
export function progressoOkr(okr: Okr): ProgressoOkr {
  const krs = (okr.krs || []).map((kr) => ({ kr, progresso: progressoKR(kr) }))
  const total = krs.length
  const progresso = total > 0 ? krs.reduce((s, x) => s + x.progresso, 0) / total : 0
  const concluidos = krs.filter((x) => x.progresso >= 1).length
  const status: ProgressoOkr['status'] =
    progresso >= 1 ? 'concluido'
      : progresso >= 0.7 ? 'no_caminho'
        : progresso >= 0.4 ? 'atencao'
          : 'em_risco'
  return { progresso, krs, status, concluidos, total }
}

/** Normaliza o jsonb `krs` vindo do banco em KR[] consistente (defensivo). */
export function normalizarKRs(raw: unknown): KR[] {
  if (!Array.isArray(raw)) return []
  return raw.map((r, i): KR => {
    const o = (r || {}) as Record<string, unknown>
    const un = String(o.unidade || 'numero')
    return {
      id: String(o.id || `kr${i + 1}`),
      titulo: String(o.titulo || ''),
      unidade: (['moeda', 'numero', 'percent', 'nota', 'nps'].includes(un) ? un : 'numero') as Unidade,
      inicial: Number(o.inicial) || 0,
      alvo: Number(o.alvo) || 0,
      atual: Number(o.atual) || 0,
      metrica: o.metrica ? String(o.metrica) : null,
    }
  })
}

// ── Detecção de "tabela ainda não criada" (rodar o SQL) ──────────────────────
export function isMissingTable(err: { code?: string | null; message?: string | null } | null | undefined): boolean {
  if (!err) return false
  return err.code === 'PGRST205' || err.code === '42P01' ||
    /could not find the table|schema cache|does not exist/i.test(err.message || '')
}
