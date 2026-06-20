// Motor PURO de Seguros & Apólices da Ventsy.
// ─────────────────────────────────────────────────────────────────────────────
// Protege a operação contra risco existencial: apólices PATRIMONIAIS do espaço
// (incêndio, danos), RESPONSABILIDADE CIVIL geral, seguros POR EVENTO (RC de
// evento, acidentes pessoais para corrida/equestre/automobilismo), FROTA e
// EQUIPAMENTOS. Calcula situação de vigência (vigente/a vencer/vencida), alertas
// de renovação (30/60/90d), prêmio da carteira, cobertura contratada,
// sinistralidade e rateio do prêmio ao custo do evento. Também guarda a
// BIBLIOTECA de exigências de seguro por tipo de evento (degrade enquanto o
// módulo Licenças não existe) e checa se o evento está coberto.
//
// Consumido por:
//   • /painel/seguros      (carteira, seguro por evento, sinistros, custos)
//   • __tests__/lib/seguros (este motor é testado isoladamente)
//
// Regras de ouro (espelham lib/plano-b.ts, lib/ativos.ts, lib/manutencao.ts):
//   • SEM React, SEM Supabase, SEM "R$"/Intl aqui — só números/datas/strings
//     crus. A formatação (moeda/data/locale) fica em lib/format, chamada por
//     quem consome.
//   • Determinístico e testável: nada de relógio/fetch escondido. O "hoje" entra
//     SEMPRE por parâmetro (hojeYmd, formato 'YYYY-MM-DD').
//   • i18n: os rótulos PT são o default dos catálogos; a UI pode reescrevê-los.

export { isMissingTable } from '@/lib/dbErrors'

// ── Tipos de domínio ─────────────────────────────────────────────────────────
export type Escopo = 'patrimonial' | 'rc' | 'evento' | 'acidentes' | 'frota' | 'equipamento'
export type StatusAdmin = 'ativa' | 'em_cotacao' | 'cancelada' | 'renovada'
export type SinistroStatus = 'aberto' | 'em_analise' | 'aprovado' | 'negado' | 'pago' | 'encerrado'
/** Situação efetiva da apólice (admin + vigência), exibida na carteira. */
export type Situacao = 'vigente' | 'a_vencer' | 'vencida' | 'futura' | 'em_cotacao' | 'cancelada' | 'sem_vigencia'

/** Uma cobertura da apólice: o item segurado e o limite/franquia (em dinheiro cru). */
export type Cobertura = { item: string; limite_num: number; franquia_num: number | null }
export type Anexo = { url: string; nome: string; tipo: string | null; tamanho: number | null }

/** Forma mínima (estrutural) de uma apólice para os cálculos do motor. */
export type SeguroLike = {
  escopo: Escopo
  status: string
  premio_num: number
  vigencia_inicio: string | null
  vigencia_fim: string | null
  coberturas?: Cobertura[]
  evento_id?: string | null
}
/** Forma mínima de um sinistro para os cálculos do motor. */
export type SinistroLike = {
  status: SinistroStatus
  valor_estimado_num: number
  valor_indenizado_num: number
}

export const DIAS_AVISO_PADRAO = 30

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
const utc = (p: Ymd): number => Date.UTC(p.y, p.m - 1, p.d)

/** Dias inteiros de `hojeYmd` até `ymd` (negativo = já passou; null se vazio). */
export function diasAte(ymd: string | null | undefined, hojeYmd: string): number | null {
  const a = parseYmd(ymd)
  const h = parseYmd(hojeYmd)
  if (!a || !h) return null
  return Math.round((utc(a) - utc(h)) / 86_400_000)
}

/** Duração da vigência em dias (inclusiva). null se faltar data ou for inválida. */
export function duracaoDias(inicio: string | null | undefined, fim: string | null | undefined): number | null {
  const a = parseYmd(inicio)
  const b = parseYmd(fim)
  if (!a || !b) return null
  const dias = Math.round((utc(b) - utc(a)) / 86_400_000) + 1
  return dias >= 1 ? dias : null
}

/** Dias de sobreposição (inclusiva) entre dois períodos [aIni,aFim] e [bIni,bFim]. */
export function diasSobrepostos(
  aIni: string | null | undefined, aFim: string | null | undefined,
  bIni: string | null | undefined, bFim: string | null | undefined,
): number {
  const a1 = parseYmd(aIni), a2 = parseYmd(aFim), b1 = parseYmd(bIni), b2 = parseYmd(bFim)
  if (!a1 || !a2 || !b1 || !b2) return 0
  const ini = Math.max(utc(a1), utc(b1))
  const fim = Math.min(utc(a2), utc(b2))
  if (fim < ini) return 0
  return Math.round((fim - ini) / 86_400_000) + 1
}

// ── Situação de vigência ─────────────────────────────────────────────────────
/** Classifica a vigência (futura/vigente/a_vencer/vencida/sem) em relação ao hoje. */
export function statusVigencia(
  inicio: string | null | undefined,
  fim: string | null | undefined,
  hojeYmd: string,
  diasAviso = DIAS_AVISO_PADRAO,
): Exclude<Situacao, 'em_cotacao' | 'cancelada'> {
  const iniDias = diasAte(inicio, hojeYmd)
  const fimDias = diasAte(fim, hojeYmd)
  if (inicio == null && fim == null) return 'sem_vigencia'
  if (iniDias != null && iniDias > 0) return 'futura'      // ainda não começou
  if (fimDias != null && fimDias < 0) return 'vencida'     // já passou o fim
  if (fimDias != null && fimDias <= diasAviso) return 'a_vencer'
  return 'vigente'                                          // vigente (com ou sem fim)
}

/** Situação efetiva combinando o status administrativo com a vigência. */
export function situacao(
  s: { status: string; vigencia_inicio: string | null; vigencia_fim: string | null },
  hojeYmd: string,
  diasAviso = DIAS_AVISO_PADRAO,
): Situacao {
  if (s.status === 'cancelada') return 'cancelada'
  if (s.status === 'em_cotacao') return 'em_cotacao'
  return statusVigencia(s.vigencia_inicio, s.vigencia_fim, hojeYmd, diasAviso)
}

/** A apólice conta como "ativa no risco" (cobre algo hoje)? */
export function estaVigente(s: SeguroLike, hojeYmd: string, diasAviso = DIAS_AVISO_PADRAO): boolean {
  const sit = situacao(s, hojeYmd, diasAviso)
  return sit === 'vigente' || sit === 'a_vencer'
}

// ── Prêmio, cobertura, sinistralidade ────────────────────────────────────────
const num = (v: unknown): number => {
  const x = Number(v)
  return Number.isFinite(x) ? x : 0
}

/** Soma dos limites de todas as coberturas (cobertura contratada total). */
export function coberturaTotal(cobs: Cobertura[] | null | undefined): number {
  if (!Array.isArray(cobs)) return 0
  return cobs.reduce((s, c) => s + num(c?.limite_num), 0)
}

/**
 * Rateio do prêmio ao período de um evento (custo de seguro do evento).
 * Apólice por evento → prêmio integral. Apólice anual/patrimonial → pro-rata
 * pelos dias de sobreposição com o evento. null se não der para ratear.
 */
export function rateioPremioEvento(
  s: SeguroLike,
  eventoInicio: string | null | undefined,
  eventoFim: string | null | undefined,
): number | null {
  const premio = num(s.premio_num)
  if (premio <= 0) return 0
  // Seguros dedicados ao evento: o prêmio inteiro é custo do evento.
  if (s.escopo === 'evento' || s.escopo === 'acidentes') return premio
  // Demais escopos: rateio diário pela sobreposição com o evento.
  const dur = duracaoDias(s.vigencia_inicio, s.vigencia_fim)
  if (!dur) return null
  const fimEvento = eventoFim || eventoInicio
  const sobre = diasSobrepostos(s.vigencia_inicio, s.vigencia_fim, eventoInicio, fimEvento)
  if (sobre <= 0) return 0
  return Math.round((premio / dur) * sobre * 100) / 100
}

/** Índice de sinistralidade (indenizado ÷ prêmio). null se não há prêmio. */
export function sinistralidade(premio: number, indenizado: number): number | null {
  const p = num(premio)
  if (p <= 0) return null
  return num(indenizado) / p
}

// ── Agregação da carteira ────────────────────────────────────────────────────
export type ResumoEscopo = { escopo: Escopo; quantidade: number; premio: number; cobertura: number }
export type ResumoCarteira = {
  total: number
  vigentes: number
  aVencer: number      // vigentes vencendo dentro de `diasAviso`
  vencidas: number
  emCotacao: number
  canceladas: number
  premioVigente: number      // soma dos prêmios das apólices vigentes/a vencer
  coberturaVigente: number   // soma das coberturas das apólices vigentes/a vencer
  porEscopo: ResumoEscopo[]
}

/** Resumo da carteira de apólices para os KPIs e o gráfico por escopo. */
export function resumoCarteira(
  seguros: SeguroLike[],
  hojeYmd: string,
  diasAviso = DIAS_AVISO_PADRAO,
): ResumoCarteira {
  const r: ResumoCarteira = {
    total: seguros.length, vigentes: 0, aVencer: 0, vencidas: 0, emCotacao: 0, canceladas: 0,
    premioVigente: 0, coberturaVigente: 0, porEscopo: [],
  }
  const porEscopo = new Map<Escopo, ResumoEscopo>()
  for (const s of seguros) {
    const sit = situacao(s, hojeYmd, diasAviso)
    if (sit === 'vigente') r.vigentes++
    else if (sit === 'a_vencer') { r.vigentes++; r.aVencer++ }
    else if (sit === 'vencida') r.vencidas++
    else if (sit === 'em_cotacao') r.emCotacao++
    else if (sit === 'cancelada') r.canceladas++

    const ativaNoRisco = sit === 'vigente' || sit === 'a_vencer'
    if (ativaNoRisco) {
      r.premioVigente += num(s.premio_num)
      r.coberturaVigente += coberturaTotal(s.coberturas)
    }
    const e = porEscopo.get(s.escopo) || { escopo: s.escopo, quantidade: 0, premio: 0, cobertura: 0 }
    e.quantidade++
    if (ativaNoRisco) { e.premio += num(s.premio_num); e.cobertura += coberturaTotal(s.coberturas) }
    porEscopo.set(s.escopo, e)
  }
  // Ordena por prêmio desc para o gráfico/legenda.
  r.porEscopo = Array.from(porEscopo.values()).sort((a, b) => b.premio - a.premio || b.quantidade - a.quantidade)
  return r
}

/** Faixas de vencimento (cumulativas) para os alertas de renovação. */
export type JanelasVencimento = { vencidas: number; ate30: number; ate60: number; ate90: number }
export function janelasVencimento(
  seguros: SeguroLike[],
  hojeYmd: string,
): JanelasVencimento {
  const j: JanelasVencimento = { vencidas: 0, ate30: 0, ate60: 0, ate90: 0 }
  for (const s of seguros) {
    if (s.status === 'cancelada' || s.status === 'em_cotacao') continue
    const fimDias = diasAte(s.vigencia_fim, hojeYmd)
    if (fimDias == null) continue
    if (fimDias < 0) { j.vencidas++; continue }
    if (fimDias <= 30) j.ate30++
    if (fimDias <= 60) j.ate60++
    if (fimDias <= 90) j.ate90++
  }
  return j
}

/** Apólices a vencer (ou vencidas) dentro de `dentroDeDias`, ordenadas pela data de fim. */
export function aVencer<T extends SeguroLike>(seguros: T[], hojeYmd: string, dentroDeDias = 90): T[] {
  return seguros
    .filter((s) => {
      if (s.status === 'cancelada' || s.status === 'em_cotacao') return false
      const fimDias = diasAte(s.vigencia_fim, hojeYmd)
      return fimDias != null && fimDias <= dentroDeDias
    })
    .sort((a, b) => (diasAte(a.vigencia_fim, hojeYmd) ?? 0) - (diasAte(b.vigencia_fim, hojeYmd) ?? 0))
}

// ── Agregação de sinistros ───────────────────────────────────────────────────
export type ResumoSinistros = {
  total: number
  abertos: number           // não encerrados/pagos/negados
  pagos: number
  estimado: number
  indenizado: number
}
/** Estados que ainda demandam acompanhamento (em aberto). */
const SINISTRO_EM_ABERTO: SinistroStatus[] = ['aberto', 'em_analise', 'aprovado']
export function resumoSinistros(sinistros: SinistroLike[]): ResumoSinistros {
  const r: ResumoSinistros = { total: sinistros.length, abertos: 0, pagos: 0, estimado: 0, indenizado: 0 }
  for (const s of sinistros) {
    if (SINISTRO_EM_ABERTO.includes(s.status)) r.abertos++
    if (s.status === 'pago') r.pagos++
    r.estimado += num(s.valor_estimado_num)
    r.indenizado += num(s.valor_indenizado_num)
  }
  return r
}

// ── Biblioteca de exigências de seguro por tipo de evento ─────────────────────
// Degrade enquanto /painel/licencas não existe: aqui mora o conhecimento de QUE
// seguro cada tipo de evento costuma exigir. A UI checa se o evento está coberto.
export type Exigencia = { escopo: Escopo; label: string; obrigatorio: boolean; motivo: string }

function semAcento(s: string): string {
  return s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
}

const RC_EVENTO: Exigencia = { escopo: 'evento', label: 'RC de Evento', obrigatorio: true, motivo: 'Cobre danos a terceiros e ao público durante o evento.' }
const ACIDENTES: Exigencia = { escopo: 'acidentes', label: 'Acidentes Pessoais', obrigatorio: true, motivo: 'Obrigatório para participantes em eventos de alto risco.' }
const RC_EVENTO_REC: Exigencia = { ...RC_EVENTO, obrigatorio: false, motivo: 'Recomendado: cobre danos a terceiros durante o evento.' }

/** Exigências de seguro típicas para um tipo de evento (heurística por palavra-chave). */
export function exigenciasPorTipoEvento(tipo: string | null | undefined): Exigencia[] {
  const t = semAcento(tipo || '')
  if (!t) return [RC_EVENTO_REC]
  // Alto risco: acidentes pessoais + RC obrigatórios.
  if (/(automob|kart|rally|motovel|corrida de carro|drag)/.test(t)) return [RC_EVENTO, ACIDENTES]
  if (/(equest|hipic|cavalo|salto|enduro|rodeio|vaquejad)/.test(t)) return [RC_EVENTO, ACIDENTES]
  if (/(corrida|maraton|atlet|triat|ciclis|bike|run)/.test(t)) return [RC_EVENTO, ACIDENTES]
  if (/(aero|air ?show|aviacao|paraqued|balon)/.test(t)) return [RC_EVENTO, ACIDENTES]
  // Público em massa: RC de evento obrigatório.
  if (/(show|festival|festa|feira|exposic|congress|formatura|carnaval|micareta)/.test(t)) return [RC_EVENTO]
  // Social: recomendado.
  if (/(casamento|aniversar|debutante|bodas|batiz|confraterniz|corporativo)/.test(t)) return [RC_EVENTO_REC]
  return [RC_EVENTO_REC]
}

/** Resultado da checagem de cobertura de um evento contra suas exigências. */
export type CoberturaExigencia = { exigencia: Exigencia; cobertaPor: string | null; vigente: boolean }

/**
 * Para cada exigência do tipo de evento, procura entre as apólices do evento
 * uma de escopo compatível e ainda vigente. Devolve o id da apólice que cobre
 * (ou null) e se está vigente.
 */
export function checarExigenciasEvento(
  tipoEvento: string | null | undefined,
  segurosDoEvento: (SeguroLike & { id: string })[],
  hojeYmd: string,
): CoberturaExigencia[] {
  return exigenciasPorTipoEvento(tipoEvento).map((ex) => {
    // Escopo compatível: o exigido OU 'rc' (RC geral cobre RC de evento).
    const cand = segurosDoEvento.find((s) => s.escopo === ex.escopo || (ex.escopo === 'evento' && s.escopo === 'rc'))
    return { exigencia: ex, cobertaPor: cand?.id ?? null, vigente: cand ? estaVigente(cand, hojeYmd) : false }
  })
}

// ── Catálogos (rótulos PT; i18n: extrair p/ dicionário) ──────────────────────
export const ESCOPOS: { v: Escopo; label: string; descricao: string; cor: string; chip: string }[] = [
  { v: 'patrimonial', label: 'Patrimonial',         descricao: 'Incêndio, danos e perdas ao espaço/imóvel.',        cor: '#0ea5e9', chip: 'bg-sky-50 text-sky-700' },
  { v: 'rc',          label: 'Responsabilidade Civil', descricao: 'RC geral da operação do espaço.',                 cor: '#6366f1', chip: 'bg-indigo-50 text-indigo-700' },
  { v: 'evento',      label: 'RC de Evento',         descricao: 'Responsabilidade civil de um evento específico.',    cor: '#ff385c', chip: 'bg-brand-50 text-brand' },
  { v: 'acidentes',   label: 'Acidentes Pessoais',   descricao: 'Participantes em corrida, equestre, automobilismo.', cor: '#f97316', chip: 'bg-orange-50 text-orange-700' },
  { v: 'frota',       label: 'Frota',                descricao: 'Veículos da operação (vans, caminhões, carrinhos).', cor: '#14b8a6', chip: 'bg-teal-50 text-teal-700' },
  { v: 'equipamento', label: 'Equipamentos',         descricao: 'Som, luz, palco, mobiliário e equipamentos.',        cor: '#8b5cf6', chip: 'bg-violet-50 text-violet-700' },
]
export const ESCOPO_BY = Object.fromEntries(ESCOPOS.map((e) => [e.v, e])) as Record<Escopo, (typeof ESCOPOS)[number]>
export const escopoLabel = (v: string | null): string => ESCOPO_BY[(v || 'patrimonial') as Escopo]?.label || v || '—'
export const escopoCor = (v: string | null): string => ESCOPO_BY[(v || 'patrimonial') as Escopo]?.cor || '#94a3b8'

// Situação efetiva — rótulo + classe do chip + tom semântico (semáforo).
export const SITUACAO_META: Record<Situacao, { label: string; chip: string; cor: string }> = {
  vigente:      { label: 'Vigente',     chip: 'bg-emerald-50 text-emerald-700', cor: '#16a34a' },
  a_vencer:     { label: 'A vencer',    chip: 'bg-amber-50 text-amber-700',     cor: '#d97706' },
  vencida:      { label: 'Vencida',     chip: 'bg-red-50 text-red-700',         cor: '#dc2626' },
  futura:       { label: 'Futura',      chip: 'bg-sky-50 text-sky-700',         cor: '#0ea5e9' },
  em_cotacao:   { label: 'Em cotação',  chip: 'bg-violet-50 text-violet-700',   cor: '#8b5cf6' },
  cancelada:    { label: 'Cancelada',   chip: 'bg-gray-100 text-gray-500',      cor: '#94a3b8' },
  sem_vigencia: { label: 'Sem vigência', chip: 'bg-black/[0.04] text-ink-muted', cor: '#6b7280' },
}

export const STATUS_ADMIN: { v: StatusAdmin; label: string }[] = [
  { v: 'ativa',      label: 'Ativa' },
  { v: 'em_cotacao', label: 'Em cotação' },
  { v: 'renovada',   label: 'Renovada' },
  { v: 'cancelada',  label: 'Cancelada' },
]

// Status do sinistro — rótulo, classe (chip) e se está "em aberto".
export const SINISTRO_STATUS: { v: SinistroStatus; label: string; chip: string; aberto: boolean }[] = [
  { v: 'aberto',    label: 'Aberto',     chip: 'bg-sky-50 text-sky-700',         aberto: true },
  { v: 'em_analise', label: 'Em análise', chip: 'bg-amber-50 text-amber-700',     aberto: true },
  { v: 'aprovado',  label: 'Aprovado',   chip: 'bg-indigo-50 text-indigo-700',   aberto: true },
  { v: 'pago',      label: 'Pago',       chip: 'bg-emerald-50 text-emerald-700', aberto: false },
  { v: 'negado',    label: 'Negado',     chip: 'bg-red-50 text-red-700',         aberto: false },
  { v: 'encerrado', label: 'Encerrado',  chip: 'bg-gray-100 text-gray-500',      aberto: false },
]
export const SINISTRO_STATUS_BY = Object.fromEntries(SINISTRO_STATUS.map((s) => [s.v, s])) as Record<SinistroStatus, (typeof SINISTRO_STATUS)[number]>
export const sinistroStatusLabel = (v: string | null): string => SINISTRO_STATUS_BY[(v || 'aberto') as SinistroStatus]?.label || v || '—'

// ── Normalizadores (coerção defensiva do jsonb) ──────────────────────────────
/* eslint-disable @typescript-eslint/no-explicit-any */
export function normalizarCoberturas(v: any): Cobertura[] {
  if (!Array.isArray(v)) return []
  return v
    .map((c) => ({
      item: String(c?.item ?? '').trim(),
      limite_num: num(c?.limite_num),
      franquia_num: c?.franquia_num == null ? null : num(c.franquia_num),
    }))
    .filter((c) => c.item || c.limite_num > 0)
}
export function normalizarAnexos(v: any): Anexo[] {
  if (!Array.isArray(v)) return []
  return v
    .filter((a) => a && a.url)
    .map((a) => ({ url: String(a.url), nome: String(a.nome ?? a.url), tipo: a.tipo ?? null, tamanho: a.tamanho == null ? null : num(a.tamanho) }))
}
/* eslint-enable @typescript-eslint/no-explicit-any */
