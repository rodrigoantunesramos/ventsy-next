// Motor PURO de Multi-unidades / Franquias da Ventsy.
// ─────────────────────────────────────────────────────────────────────────────
// Para quem opera VÁRIAS unidades (rede de espaços, franquias, parque com vários
// pavilhões geridos como negócios): consolida e compara as unidades do dono.
//   • Cada UNIDADE é uma `propriedade`. O dono pode ter muitas.
//   • Métricas por unidade (receita/despesa/margem, eventos, ocupação, ticket,
//     pipeline, avaliação) a partir das tabelas já escopadas por propriedade
//     (`lancamentos.prop_id`, `clientes_eventos.propriedade_id`).
//   • Consolidação (somatório), ranking, benchmark lado a lado.
//   • Franquia: royalties/taxas por unidade (% da receita + taxa fixa).
//   • Grupos (rede/franquia/região/marca) e controle de qual MEMBRO acessa qual
//     unidade (liga com Permissões/RBAC).
//
// Consumido por:
//   • /painel/unidades   (visão consolidada, comparativo, troca de contexto)
//   • lib/unidades.test  (este motor é testado isoladamente)
//
// Regras de ouro (espelham lib/seguros.ts, lib/licencas.ts, lib/comissoes.ts):
//   • SEM React, SEM Supabase, SEM "R$"/Intl aqui — só números/datas/strings
//     crus. A formatação (moeda/locale) fica em lib/format, chamada por quem usa.
//   • Determinístico e testável: o "hoje"/janela entram SEMPRE por parâmetro
//     (formato 'YYYY-MM-DD'). Nada de relógio/fetch escondido na lógica.
//   • i18n: rótulos PT são o default dos catálogos; a UI pode reescrevê-los.

// ── Datas (agnósticas de fuso: ancoram nos componentes Y-M-D em UTC) ──────────
type Ymd = { y: number; m: number; d: number }
function parseYmd(v: string | null | undefined): Ymd | null {
  if (!v) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v))
  if (!m) return null
  const y = +m[1], mo = +m[2], d = +m[3]
  if (!y || !mo || !d) return null
  return { y, m: mo, d }
}
const DIA_MS = 86_400_000
/** Dia-epoch (UTC, em dias inteiros) de um 'YYYY-MM-DD'. null se inválido. */
function epochDay(v: string | null | undefined): number | null {
  const p = parseYmd(v)
  if (!p) return null
  return Math.floor(Date.UTC(p.y, p.m - 1, p.d) / DIA_MS)
}
function pad2(n: number): string { return String(n).padStart(2, '0') }

/** Data de hoje como 'YYYY-MM-DD' no horário local (helper p/ a UI passar à engine). */
export function todayYMD(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

/** Dias inteiros de `hojeYmd` até `ymd` (negativo = já passou; null se vazio). */
export function diasAte(ymd: string | null | undefined, hojeYmd: string): number | null {
  const a = epochDay(ymd), h = epochDay(hojeYmd)
  if (a == null || h == null) return null
  return a - h
}

/** A data 'YYYY-MM-DD' cai dentro da janela [de, ate] (inclusiva)? */
export function dentroDaJanela(ymd: string | null | undefined, de: string, ate: string): boolean {
  const d = epochDay(ymd)
  if (d == null) return false
  const lo = epochDay(de), hi = epochDay(ate)
  if (lo == null || hi == null) return false
  return d >= lo && d <= hi
}

// ── Janelas de período (presets) ──────────────────────────────────────────────
export type PeriodoPreset = 'mes' | 'ano' | '12m' | 'tudo'
export type Janela = { de: string; ate: string; dias: number }

export const PERIODOS: { v: PeriodoPreset; label: string }[] = [
  { v: 'mes', label: 'Este mês' },
  { v: 'ano', label: 'Este ano' },
  { v: '12m', label: '12 meses' },
  { v: 'tudo', label: 'Tudo' },
]

/**
 * Constrói a janela [de, ate] (YMD) a partir de um preset e do "hoje". Para
 * `tudo` usa uma âncora distante no passado (consolidação histórica). `dias` é a
 * contagem inclusiva de dias da janela (base de disponibilidade da ocupação).
 */
export function janelaPreset(preset: PeriodoPreset, hojeYmd: string): Janela {
  const h = parseYmd(hojeYmd) || { y: 1970, m: 1, d: 1 }
  let de: string
  const ate = hojeYmd
  if (preset === 'mes') de = `${h.y}-${pad2(h.m)}-01`
  else if (preset === 'ano') de = `${h.y}-01-01`
  else if (preset === '12m') {
    // 12 meses corridos: mesmo dia, 12 meses atrás (mês anterior +1 dia evita 13).
    const start = new Date(Date.UTC(h.y, h.m - 1, h.d))
    start.setUTCFullYear(start.getUTCFullYear() - 1)
    start.setUTCDate(start.getUTCDate() + 1)
    de = `${start.getUTCFullYear()}-${pad2(start.getUTCMonth() + 1)}-${pad2(start.getUTCDate())}`
  } else de = '2000-01-01'
  const lo = epochDay(de)!, hi = epochDay(ate)!
  return { de, ate, dias: Math.max(1, hi - lo + 1) }
}

// ── Vocabulário do funil (espelha /painel/clientes e /painel/financeiro) ──────
export type GrupoFunil = 'negociando' | 'contratados' | 'finalizados' | 'perdidos'
const GRUPO_DE: Record<string, GrupoFunil> = {
  lead: 'negociando', consultada: 'negociando', visita: 'negociando', negociacao: 'negociando', reserva: 'negociando',
  contratado: 'contratados', briefing: 'contratados', pronto: 'contratados', montagem: 'contratados',
  finalizado: 'finalizados', pos: 'finalizados', perdido: 'perdidos', recontactar: 'perdidos',
}
export function grupoFunil(status: string | null | undefined): GrupoFunil {
  return GRUPO_DE[status || 'lead'] || 'negociando'
}
const GANHO = new Set<GrupoFunil>(['contratados', 'finalizados'])
/** O evento foi GANHO (contratado/realizado)? */
export function eventoGanho(status: string | null | undefined): boolean { return GANHO.has(grupoFunil(status)) }
/** O evento ainda está em NEGOCIAÇÃO (pipeline)? */
export function eventoEmNegociacao(status: string | null | undefined): boolean { return grupoFunil(status) === 'negociando' }

// ── Formas mínimas das linhas (subconjunto lido das tabelas) ──────────────────
export type PropriedadeLite = {
  id: number
  nome: string | null
  cidade: string | null
  estado: string | null
  categoria: string | null
  tipo_propriedade: string | null
  capacidade: number | null
  avaliacao: number | null
  imagem_url: string | null
  publicada: boolean | null
}
export type LancamentoLite = { prop_id: number | null; tipo: string | null; valor: number | null; data: string | null }
export type EventoLite = {
  propriedade_id: number | null
  status: string | null
  valor_total_num: number | null
  data_inicio: string | null
  data_fim: string | null
}

// ── Grupos (rede/franquia/região/marca) e config por unidade ──────────────────
export type TipoGrupo = 'rede' | 'franquia' | 'regiao' | 'marca'
export const TIPOS_GRUPO: { v: TipoGrupo; label: string; cor: string; chip: string }[] = [
  { v: 'rede',     label: 'Rede',     cor: '#0ea5e9', chip: 'bg-sky-50 text-sky-700' },
  { v: 'franquia', label: 'Franquia', cor: '#ff385c', chip: 'bg-brand-50 text-brand' },
  { v: 'regiao',   label: 'Região',   cor: '#10b981', chip: 'bg-emerald-50 text-emerald-700' },
  { v: 'marca',    label: 'Marca',    cor: '#8b5cf6', chip: 'bg-violet-50 text-violet-700' },
]
const TIPO_GRUPO_BY = Object.fromEntries(TIPOS_GRUPO.map((t) => [t.v, t])) as Record<string, (typeof TIPOS_GRUPO)[number]>
export function tipoGrupoMeta(v: string | null | undefined): (typeof TIPOS_GRUPO)[number] {
  return TIPO_GRUPO_BY[v || 'rede'] || { v: 'rede', label: v || 'Grupo', cor: '#94a3b8', chip: 'bg-gray-100 text-gray-600' }
}

export type GrupoUnidade = {
  id: number
  usuario_id?: string
  nome: string
  tipo: TipoGrupo | string
  cor: string | null
  obs: string | null
  criado_em?: string
  atualizado_em?: string
}

/** Configuração por unidade (apelido, grupo, ativo, metas, franquia). */
export type UnidadeConfig = {
  id?: number
  usuario_id?: string
  propriedade_id: number
  grupo_id: number | null
  apelido: string | null
  ativo: boolean
  ordem: number | null
  royalties_pct: number | null   // % da receita repassado (pontos percentuais, ex.: 5 = 5%)
  taxa_fixa_num: number | null   // taxa fixa por período (royalty mínimo)
  meta_receita_num: number | null
  obs?: string | null
  criado_em?: string
  atualizado_em?: string
}

/** Config default para uma unidade ainda sem linha em `unidades_config`. */
export function configPadrao(propriedade_id: number): UnidadeConfig {
  return {
    propriedade_id, grupo_id: null, apelido: null, ativo: true, ordem: null,
    royalties_pct: null, taxa_fixa_num: null, meta_receita_num: null,
  }
}

// ── Unidade = propriedade + sua config ────────────────────────────────────────
export type Unidade = { prop: PropriedadeLite; cfg: UnidadeConfig }

/** Nome de exibição da unidade: apelido da config > nome da propriedade > "Unidade #id". */
export function nomeUnidade(u: Unidade): string {
  return (u.cfg.apelido || '').trim() || (u.prop.nome || '').trim() || `Unidade #${u.prop.id}`
}

/**
 * Casa propriedades com suas configs (1 config por propriedade). Propriedade sem
 * config recebe a config padrão. Ordena por `ordem` (asc) e depois pelo nome.
 */
export function montarUnidades(props: PropriedadeLite[], configs: UnidadeConfig[]): Unidade[] {
  const byProp = new Map<number, UnidadeConfig>()
  for (const c of configs) if (c && c.propriedade_id != null) byProp.set(c.propriedade_id, c)
  return props
    .map((prop) => ({ prop, cfg: byProp.get(prop.id) || configPadrao(prop.id) }))
    .sort((a, b) => {
      const oa = a.cfg.ordem ?? 9_999, ob = b.cfg.ordem ?? 9_999
      if (oa !== ob) return oa - ob
      return nomeUnidade(a).localeCompare(nomeUnidade(b))
    })
}

// ── Ocupação (união de intervalos clipados na janela) ─────────────────────────
const num = (v: unknown): number => {
  const x = Number(v)
  return Number.isFinite(x) ? x : 0
}

/**
 * Dias OCUPADOS por eventos GANHOS dentro de [de, ate] (inclusiva). Conta cada
 * dia uma única vez (une intervalos sobrepostos). Eventos sem data são ignorados;
 * `data_fim` ausente vira evento de 1 dia (data_inicio).
 */
export function diasOcupados(eventos: EventoLite[], de: string, ate: string): number {
  const lo = epochDay(de), hi = epochDay(ate)
  if (lo == null || hi == null || hi < lo) return 0
  const intervalos: [number, number][] = []
  for (const e of eventos) {
    if (!eventoGanho(e.status)) continue
    const s0 = epochDay(e.data_inicio)
    if (s0 == null) continue
    const e0 = epochDay(e.data_fim) ?? s0
    const s = Math.max(lo, Math.min(s0, e0))
    const en = Math.min(hi, Math.max(s0, e0))
    if (en < s) continue
    intervalos.push([s, en])
  }
  if (!intervalos.length) return 0
  intervalos.sort((a, b) => a[0] - b[0])
  let total = 0, curS = intervalos[0][0], curE = intervalos[0][1]
  for (let i = 1; i < intervalos.length; i++) {
    const [s, e] = intervalos[i]
    if (s <= curE + 1) curE = Math.max(curE, e)
    else { total += curE - curS + 1; curS = s; curE = e }
  }
  total += curE - curS + 1
  return total
}

// ── Métricas por unidade ──────────────────────────────────────────────────────
export type MetricasUnidade = {
  propriedade_id: number
  receita: number             // Σ lancamentos receita (prop_id) na janela
  despesa: number             // Σ lancamentos despesa (prop_id) na janela
  margem: number              // receita - despesa
  margemPct: number | null    // margem / receita (fração; null se sem receita)
  eventos: number             // eventos GANHOS com data_inicio na janela
  eventosTotais: number       // todos os eventos (qualquer status) com data_inicio na janela
  valorContratado: number     // Σ valor_total_num dos ganhos na janela
  pipeline: number            // Σ valor_total_num dos eventos em negociação na janela
  ticket: number              // valorContratado / eventos (0 se nenhum)
  diasOcupados: number
  diasDisponiveis: number
  ocupacao: number | null     // diasOcupados / diasDisponiveis (fração; null se sem base)
  avaliacao: number | null    // propriedades.avaliacao (proxy de NPS/satisfação)
  royalties: number           // receita * pct/100 + taxa_fixa  (franquia)
  metaReceita: number | null
  atingimento: number | null  // receita / meta (fração; null se sem meta)
}

/** Royalty/repasse de uma unidade dado o faturamento e a config de franquia. */
export function royaltiesUnidade(receita: number, cfg: Pick<UnidadeConfig, 'royalties_pct' | 'taxa_fixa_num'>): number {
  const pct = num(cfg.royalties_pct)
  const fixa = num(cfg.taxa_fixa_num)
  const variavel = pct > 0 ? num(receita) * (pct / 100) : 0
  return Math.round((variavel + fixa) * 100) / 100
}

/** Calcula as métricas de UMA unidade na janela, a partir de suas linhas já filtradas por propriedade. */
export function metricasUnidade(
  u: Unidade,
  lancamentos: LancamentoLite[],
  eventos: EventoLite[],
  janela: Janela,
): MetricasUnidade {
  let receita = 0, despesa = 0
  for (const l of lancamentos) {
    if (!dentroDaJanela(l.data, janela.de, janela.ate)) continue
    const v = num(l.valor)
    if (l.tipo === 'receita') receita += v
    else if (l.tipo === 'despesa') despesa += v
  }
  let eventosGanhos = 0, eventosTotais = 0, valorContratado = 0, pipeline = 0
  for (const e of eventos) {
    if (!dentroDaJanela(e.data_inicio, janela.de, janela.ate)) continue
    eventosTotais++
    if (eventoGanho(e.status)) { eventosGanhos++; valorContratado += num(e.valor_total_num) }
    else if (eventoEmNegociacao(e.status)) pipeline += num(e.valor_total_num)
  }
  const ocup = diasOcupados(eventos, janela.de, janela.ate)
  const margem = receita - despesa
  const meta = u.cfg.meta_receita_num != null ? num(u.cfg.meta_receita_num) : null
  return {
    propriedade_id: u.prop.id,
    receita, despesa, margem,
    margemPct: receita > 0 ? margem / receita : null,
    eventos: eventosGanhos,
    eventosTotais,
    valorContratado,
    pipeline,
    ticket: eventosGanhos > 0 ? valorContratado / eventosGanhos : 0,
    diasOcupados: ocup,
    diasDisponiveis: janela.dias,
    ocupacao: janela.dias > 0 ? ocup / janela.dias : null,
    avaliacao: u.prop.avaliacao != null ? num(u.prop.avaliacao) : null,
    royalties: royaltiesUnidade(receita, u.cfg),
    metaReceita: meta,
    atingimento: meta && meta > 0 ? receita / meta : null,
  }
}

/** Calcula as métricas de TODAS as unidades (filtrando as linhas por propriedade). */
export function metricasTodas(
  unidades: Unidade[],
  lancamentos: LancamentoLite[],
  eventos: EventoLite[],
  janela: Janela,
): Map<number, MetricasUnidade> {
  const lancPorProp = new Map<number, LancamentoLite[]>()
  for (const l of lancamentos) {
    if (l.prop_id == null) continue
    const arr = lancPorProp.get(l.prop_id) || []
    arr.push(l); lancPorProp.set(l.prop_id, arr)
  }
  const evtPorProp = new Map<number, EventoLite[]>()
  for (const e of eventos) {
    if (e.propriedade_id == null) continue
    const arr = evtPorProp.get(e.propriedade_id) || []
    arr.push(e); evtPorProp.set(e.propriedade_id, arr)
  }
  const out = new Map<number, MetricasUnidade>()
  for (const u of unidades) {
    out.set(u.prop.id, metricasUnidade(u, lancPorProp.get(u.prop.id) || [], evtPorProp.get(u.prop.id) || [], janela))
  }
  return out
}

// ── Consolidação (somatório + médias ponderadas) ──────────────────────────────
export type Consolidado = {
  unidades: number
  receita: number
  despesa: number
  margem: number
  margemPct: number | null
  eventos: number
  valorContratado: number
  pipeline: number
  ticket: number              // valorContratado / eventos (consolidado)
  diasOcupados: number
  diasDisponiveis: number
  ocupacao: number | null     // Σ ocupados / Σ disponíveis (taxa consolidada)
  avaliacao: number | null    // média das avaliações disponíveis
  royalties: number
  metaReceita: number         // Σ metas definidas
  atingimento: number | null  // receita / Σ metas (fração; null se sem metas)
}

/** Soma as métricas das unidades numa visão consolidada (médias ponderadas onde faz sentido). */
export function consolidar(metrics: MetricasUnidade[]): Consolidado {
  const c: Consolidado = {
    unidades: metrics.length, receita: 0, despesa: 0, margem: 0, margemPct: null,
    eventos: 0, valorContratado: 0, pipeline: 0, ticket: 0,
    diasOcupados: 0, diasDisponiveis: 0, ocupacao: null,
    avaliacao: null, royalties: 0, metaReceita: 0, atingimento: null,
  }
  let avSoma = 0, avN = 0
  for (const m of metrics) {
    c.receita += m.receita; c.despesa += m.despesa
    c.eventos += m.eventos; c.valorContratado += m.valorContratado; c.pipeline += m.pipeline
    c.diasOcupados += m.diasOcupados; c.diasDisponiveis += m.diasDisponiveis
    c.royalties += m.royalties
    if (m.metaReceita != null) c.metaReceita += m.metaReceita
    if (m.avaliacao != null) { avSoma += m.avaliacao; avN++ }
  }
  c.margem = c.receita - c.despesa
  c.margemPct = c.receita > 0 ? c.margem / c.receita : null
  c.ticket = c.eventos > 0 ? c.valorContratado / c.eventos : 0
  c.ocupacao = c.diasDisponiveis > 0 ? c.diasOcupados / c.diasDisponiveis : null
  c.avaliacao = avN > 0 ? avSoma / avN : null
  c.atingimento = c.metaReceita > 0 ? c.receita / c.metaReceita : null
  return c
}

// ── Ranking & benchmark ───────────────────────────────────────────────────────
/** Chaves numéricas das métricas que podem ranquear/comparar unidades. */
export type MetricaKey = 'receita' | 'margem' | 'eventos' | 'ocupacao' | 'ticket' | 'pipeline' | 'avaliacao' | 'royalties'
export const METRICAS_COMPARE: { key: MetricaKey; label: string; tipo: 'moeda' | 'numero' | 'percent' | 'nota'; maior_melhor: boolean }[] = [
  { key: 'receita',    label: 'Receita',        tipo: 'moeda',   maior_melhor: true },
  { key: 'margem',     label: 'Margem',         tipo: 'moeda',   maior_melhor: true },
  { key: 'eventos',    label: 'Eventos',        tipo: 'numero',  maior_melhor: true },
  { key: 'ocupacao',   label: 'Ocupação',       tipo: 'percent', maior_melhor: true },
  { key: 'ticket',     label: 'Ticket médio',   tipo: 'moeda',   maior_melhor: true },
  { key: 'pipeline',   label: 'Pipeline',       tipo: 'moeda',   maior_melhor: true },
  { key: 'avaliacao',  label: 'Avaliação',      tipo: 'nota',    maior_melhor: true },
  { key: 'royalties',  label: 'Royalties',      tipo: 'moeda',   maior_melhor: true },
]

/** Valor numérico de uma métrica (ocupação/avaliação podem ser null → 0 p/ ordenar). */
export function valorMetrica(m: MetricasUnidade, key: MetricaKey): number {
  const v = m[key]
  return v == null ? 0 : num(v)
}

/** Ranking das unidades por uma métrica (desc por padrão; asc se maior_melhor=false). */
export function ranking(metrics: MetricasUnidade[], key: MetricaKey): MetricasUnidade[] {
  const meta = METRICAS_COMPARE.find((x) => x.key === key)
  const dir = meta && !meta.maior_melhor ? 1 : -1
  return [...metrics].sort((a, b) => (valorMetrica(a, key) - valorMetrica(b, key)) * dir)
}

export type BenchmarkStat = { min: number; max: number; media: number; total: number; melhorId: number | null; piorId: number | null }
/** Estatísticas de uma métrica entre as unidades (para o comparativo/benchmark). */
export function benchmark(metrics: MetricasUnidade[], key: MetricaKey): BenchmarkStat {
  if (!metrics.length) return { min: 0, max: 0, media: 0, total: 0, melhorId: null, piorId: null }
  let min = Infinity, max = -Infinity, total = 0, melhorId: number | null = null, piorId: number | null = null
  for (const m of metrics) {
    const v = valorMetrica(m, key)
    total += v
    if (v > max) { max = v; melhorId = m.propriedade_id }
    if (v < min) { min = v; piorId = m.propriedade_id }
  }
  return { min, max, media: total / metrics.length, total, melhorId, piorId }
}

// ── Lançamentos não atribuídos (sem prop_id) — transparência da consolidação ──
export type NaoAtribuido = { receita: number; despesa: number }
/** Receita/despesa de lançamentos SEM prop_id na janela (não entram por unidade). */
export function naoAtribuidos(lancamentos: LancamentoLite[], janela: Janela): NaoAtribuido {
  const r: NaoAtribuido = { receita: 0, despesa: 0 }
  for (const l of lancamentos) {
    if (l.prop_id != null) continue
    if (!dentroDaJanela(l.data, janela.de, janela.ate)) continue
    const v = num(l.valor)
    if (l.tipo === 'receita') r.receita += v
    else if (l.tipo === 'despesa') r.despesa += v
  }
  return r
}

// ── Acesso por unidade (liga com Permissões/RBAC) ─────────────────────────────
export type UnidadeAcesso = {
  id?: number
  usuario_id?: string
  membro_id: number          // → equipe.id
  propriedade_id: number
  criado_em?: string
}

/**
 * Conjunto de IDs de unidade visíveis a um membro. O DONO (dono=true) vê todas.
 * Um membro SEM nenhuma linha de acesso também vê todas (acesso não restrito —
 * a restrição é opt-in). Com ao menos uma linha, vê apenas as concedidas.
 */
export function unidadesVisiveis(
  acessos: UnidadeAcesso[],
  todasIds: number[],
  ctx: { dono?: boolean; membroId?: number | null },
): Set<number> {
  if (ctx.dono || ctx.membroId == null) return new Set(todasIds)
  const doMembro = acessos.filter((a) => a.membro_id === ctx.membroId)
  if (!doMembro.length) return new Set(todasIds)
  return new Set(doMembro.map((a) => a.propriedade_id).filter((id) => todasIds.includes(id)))
}

/** O membro pode ver esta unidade? (atalho sobre unidadesVisiveis). */
export function membroPodeVer(
  acessos: UnidadeAcesso[], todasIds: number[], propriedadeId: number,
  ctx: { dono?: boolean; membroId?: number | null },
): boolean {
  return unidadesVisiveis(acessos, todasIds, ctx).has(propriedadeId)
}

// ── Detecção de "tabela ainda não criada" (rodar o SQL) ──────────────────────
// PGRST205 = REST não encontrou a tabela; 42P01 = undefined_table (SQL direto).
export function isMissingTable(err: { code?: string | null; message?: string | null } | null | undefined): boolean {
  if (!err) return false
  return err.code === 'PGRST205' || err.code === '42P01' ||
    /could not find the table|schema cache|does not exist/i.test(err.message || '')
}
