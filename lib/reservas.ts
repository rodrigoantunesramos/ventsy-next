// Motor PURO da agenda multi-espaço da Ventsy.
// ─────────────────────────────────────────────────────────────────────────────
// Fonte única de verdade para: faixa de tempo de uma reserva, detecção de
// conflito por espaço (com buffer de montagem), expiração de hold, ocupação e
// geração de feed iCal (.ics). É consumida por:
//   • /painel/calendario      (timeline por espaço, grade do mês)
//   • /painel/reservas         (agenda operacional + criação com checagem)
//   • /api/reservas            (checagem AUTORITATIVA server-side)
//   • /api/reservas/ical       (feed .ics por propriedade)
//   • /api/cron/expirar-holds  (libera holds vencidos)
//
// Regras de ouro (espelham lib/pricing.ts):
//   • SEM React, SEM Supabase, SEM "R$"/Intl aqui — só dados crus. A formatação
//     fica em lib/format, chamada por quem consome.
//   • Determinístico e testável: o "agora" entra por parâmetro (nowMs); o
//     DTSTAMP do iCal entra por parâmetro. Nada de relógio escondido na lógica.

// ── Vocabulário do domínio ───────────────────────────────────────────────────
/** Status operacional da agenda. O legado de marketplace (solicitada/aprovada/
 *  paga/recusada/realizada/avaliada) continua válido e é tratado pela engine. */
export type ReservaStatus =
  | 'hold' | 'confirmada' | 'bloqueio' | 'manutencao' | 'cancelada'
export type ReservaOrigem = 'manual' | 'site' | 'proposta'
export type EspacoTipo =
  | 'salao' | 'arena' | 'galpao' | 'externa' | 'camarote'
  | 'estacionamento' | 'palco' | 'suite' | 'outro'

/** Sub-espaço reservável de uma propriedade (espelha docs/sql/reservas-multiespaco.sql). */
export type Espaco = {
  id: number
  usuario_id?: string
  propriedade_id: number
  nome: string
  tipo: EspacoTipo
  capacidade: number | null
  area_m2: number | null
  reservavel_isolado: boolean
  buffer_minutos: number
  cor: string | null
  ordem: number
  ativo: boolean
}

/** Linha de `reservas` na ótica da agenda. Inclui os campos legados de
 *  marketplace usados como fallback de faixa quando `inicio` é nulo. */
export type Reserva = {
  id: string
  usuario_id?: string
  host_id?: string | null
  propriedade_id: number
  espaco_id: number | null
  evento_id?: string | null
  titulo: string | null
  status: string
  origem?: string | null
  inicio: string | null
  fim: string | null
  hold_expira_em: string | null
  cor: string | null
  obs?: string | null
  // ── legado de marketplace (fallback de faixa) ──
  data_inicio?: string | null
  data_fim?: string | null
  modo?: string | null
  horas?: number | null
  valor_estimado?: number | null
  nome?: string | null
  tipo_evento?: string | null
  pessoas?: number | null
}

// ── Metadados de status (rótulo PT + classes Tailwind + hex p/ timeline) ─────
// i18n: o `label` é o default PT; a UI pode reescrever via dicionário próprio.
export type StatusMeta = { label: string; chip: string; bar: string; dot: string; hex: string }
export const RESERVA_STATUS_META: Record<string, StatusMeta> = {
  hold:       { label: 'Provisória',  chip: 'bg-amber-100 text-amber-700',   bar: 'border-amber-500 bg-amber-400/80',     dot: 'bg-amber-400',   hex: '#f59e0b' },
  confirmada: { label: 'Confirmada',  chip: 'bg-emerald-100 text-emerald-700', bar: 'border-emerald-600 bg-emerald-500/85', dot: 'bg-emerald-500', hex: '#10b981' },
  bloqueio:   { label: 'Bloqueio',    chip: 'bg-red-100 text-red-700',       bar: 'border-red-500 bg-red-400/80',         dot: 'bg-red-400',     hex: '#ef4444' },
  manutencao: { label: 'Manutenção',  chip: 'bg-slate-200 text-slate-700',   bar: 'border-slate-500 bg-slate-400/80',     dot: 'bg-slate-400',   hex: '#64748b' },
  cancelada:  { label: 'Cancelada',   chip: 'bg-gray-100 text-gray-500',     bar: 'border-gray-400 bg-gray-300',          dot: 'bg-gray-300',    hex: '#9ca3af' },
  // ── legado de marketplace ──
  solicitada: { label: 'Solicitada',  chip: 'bg-amber-100 text-amber-700',   bar: 'border-amber-400 bg-amber-300/70',     dot: 'bg-amber-300',   hex: '#fbbf24' },
  aprovada:   { label: 'Aprovada',    chip: 'bg-emerald-100 text-emerald-700', bar: 'border-emerald-500 bg-emerald-400/80', dot: 'bg-emerald-400', hex: '#34d399' },
  paga:       { label: 'Paga',        chip: 'bg-emerald-100 text-emerald-700', bar: 'border-emerald-600 bg-emerald-500/85', dot: 'bg-emerald-500', hex: '#10b981' },
  recusada:   { label: 'Recusada',    chip: 'bg-red-100 text-red-700',       bar: 'border-red-400 bg-red-300',            dot: 'bg-red-300',     hex: '#f87171' },
  realizada:  { label: 'Realizada',   chip: 'bg-gray-100 text-gray-600',     bar: 'border-gray-500 bg-gray-400',          dot: 'bg-gray-400',    hex: '#6b7280' },
  avaliada:   { label: 'Avaliada',    chip: 'bg-gray-100 text-gray-600',     bar: 'border-gray-500 bg-gray-400',          dot: 'bg-gray-400',    hex: '#6b7280' },
}
const STATUS_META_FALLBACK: StatusMeta = { label: '—', chip: 'bg-gray-100 text-gray-600', bar: 'border-gray-400 bg-gray-300', dot: 'bg-gray-300', hex: '#9ca3af' }
export function statusMeta(status: string): StatusMeta {
  return RESERVA_STATUS_META[status] || { ...STATUS_META_FALLBACK, label: status }
}

export const ESPACO_TIPOS: EspacoTipo[] = ['salao', 'arena', 'galpao', 'externa', 'camarote', 'estacionamento', 'palco', 'suite', 'outro']
export const ESPACO_TIPO_LABEL: Record<EspacoTipo, string> = {
  salao: 'Salão', arena: 'Arena', galpao: 'Galpão', externa: 'Área externa', camarote: 'Camarote',
  estacionamento: 'Estacionamento', palco: 'Palco', suite: 'Suíte', outro: 'Outro',
}

// ── Tempo (puro, agnóstico de lib externa) ───────────────────────────────────
export const MINUTO = 60_000
export const HORA = 60 * MINUTO
export const DIA = 24 * HORA

/** Início do dia local de uma data 'YYYY-MM-DD' (ancorado p/ evitar UTC off-by-one). */
function startOfDayLocal(ymd: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd)
  if (!m) return NaN
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 0, 0, 0, 0).getTime()
}

export type Range = { start: number; end: number }

/**
 * Faixa [start, end) de uma reserva em ms epoch. Prefere `inicio`/`fim`
 * (timestamptz); cai para os campos legados de marketplace quando ausentes.
 * Retorna null se não há data alguma. `end` nunca é menor que `start`.
 */
export function toRange(r: Partial<Reserva>): Range | null {
  if (r.inicio) {
    const s = Date.parse(r.inicio)
    if (!Number.isNaN(s)) {
      const e = r.fim ? Date.parse(r.fim) : s + HORA
      return { start: s, end: Math.max(Number.isNaN(e) ? s + HORA : e, s) }
    }
  }
  if (r.data_inicio) {
    const s = startOfDayLocal(r.data_inicio)
    if (Number.isNaN(s)) return null
    let e: number
    if (r.modo === 'hora' && r.horas) e = s + Number(r.horas) * HORA
    else if (r.modo === 'diaria' && r.data_fim) e = startOfDayLocal(r.data_fim) + DIA // fim inclusivo → +1 dia
    else e = s + DIA
    return { start: s, end: Math.max(e, s) }
  }
  return null
}

/** Há sobreposição entre [aStart,aEnd) e [bStart,bEnd), exigindo um intervalo
 *  livre de `bufferMs` entre elas (buffer de montagem/desmontagem)? */
export function overlap(aStart: number, aEnd: number, bStart: number, bEnd: number, bufferMs = 0): boolean {
  return aStart < bEnd + bufferMs && bStart < aEnd + bufferMs
}

/** Um hold venceu (passou de `hold_expira_em`)? Só se aplica a status 'hold'. */
export function holdExpirado(r: Pick<Reserva, 'status' | 'hold_expira_em'>, nowMs = Date.now()): boolean {
  if (r.status !== 'hold' || !r.hold_expira_em) return false
  const t = Date.parse(r.hold_expira_em)
  return !Number.isNaN(t) && t < nowMs
}

// Status que NÃO ocupam a agenda (não geram conflito).
const STATUS_LIVRE = new Set(['cancelada', 'recusada', 'avaliada'])
/** Esta reserva ocupa o espaço (e portanto pode gerar conflito) agora? */
export function ocupaSlot(r: Pick<Reserva, 'status' | 'hold_expira_em'>, nowMs = Date.now()): boolean {
  if (STATUS_LIVRE.has(r.status)) return false
  if (holdExpirado(r, nowMs)) return false
  return true
}

/**
 * Dois `espaco_id` referem-se ao mesmo espaço físico para fins de conflito?
 * `null` = "propriedade inteira": conflita com QUALQUER sub-espaço (e vice-versa),
 * porque reservar o local todo bloqueia cada parte. Dois sub-espaços distintos
 * só conflitam se forem o mesmo id.
 */
export function mesmoEspaco(a: number | null | undefined, b: number | null | undefined): boolean {
  if (a == null || b == null) return true
  return a === b
}

export type SlotNovo = {
  propriedade_id: number
  espaco_id: number | null
  start: number
  end: number
  ignoreId?: string  // ao mover/redimensionar, ignore a própria reserva
}

/**
 * Conflitos do slot `novo` contra `existentes`, no MESMO espaço da MESMA
 * propriedade, respeitando o `bufferMin` (montagem). Espaços distintos podem ser
 * simultâneos → não conflitam. Holds vencidos e canceladas são ignorados.
 */
export function detectarConflitos(
  novo: SlotNovo,
  existentes: Reserva[],
  opts: { bufferMin?: number; nowMs?: number } = {},
): Reserva[] {
  const bufferMs = Math.max(0, opts.bufferMin ?? 0) * MINUTO
  const now = opts.nowMs ?? Date.now()
  return existentes.filter((r) => {
    if (novo.ignoreId && r.id === novo.ignoreId) return false
    if (Number(r.propriedade_id) !== Number(novo.propriedade_id)) return false
    if (!mesmoEspaco(r.espaco_id, novo.espaco_id)) return false
    if (!ocupaSlot(r, now)) return false
    const range = toRange(r)
    if (!range) return false
    return overlap(novo.start, novo.end, range.start, range.end, bufferMs)
  })
}

// ── Ocupação ─────────────────────────────────────────────────────────────────
/** Une intervalos sobrepostos (evita contar tempo em dobro). */
export function mergeRanges(ranges: Range[]): Range[] {
  const sorted = [...ranges].filter((r) => r.end > r.start).sort((a, b) => a.start - b.start)
  const out: Range[] = []
  for (const r of sorted) {
    const last = out[out.length - 1]
    if (last && r.start <= last.end) last.end = Math.max(last.end, r.end)
    else out.push({ ...r })
  }
  return out
}

/** Minutos ocupados dentro de [fromMs,toMs), a partir das reservas que ocupam. */
export function minutosOcupados(reservas: Reserva[], fromMs: number, toMs: number, nowMs = Date.now()): number {
  const recortes: Range[] = []
  for (const r of reservas) {
    if (!ocupaSlot(r, nowMs)) continue
    const range = toRange(r)
    if (!range) continue
    const start = Math.max(range.start, fromMs)
    const end = Math.min(range.end, toMs)
    if (end > start) recortes.push({ start, end })
  }
  return mergeRanges(recortes).reduce((s, r) => s + (r.end - r.start), 0) / MINUTO
}

/** Taxa de ocupação (0–1) de uma janela, considerando `horasUteisDia` por dia. */
export function taxaOcupacao(reservas: Reserva[], fromMs: number, toMs: number, horasUteisDia = 24, nowMs = Date.now()): number {
  const dias = Math.max(1, Math.round((toMs - fromMs) / DIA))
  const capacidadeMin = dias * horasUteisDia * 60
  if (capacidadeMin <= 0) return 0
  return Math.min(1, minutosOcupados(reservas, fromMs, toMs, nowMs) / capacidadeMin)
}

// ── iCal / RFC 5545 ──────────────────────────────────────────────────────────
/** Escapa um valor de texto p/ propriedade iCal (vírgula, ponto-e-vírgula, \, quebra). */
export function icsEscape(s: string): string {
  return String(s)
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n')
}

/** Dobra linhas longas em 75 octetos (content line folding do RFC 5545). */
export function icsFold(line: string): string {
  if (line.length <= 75) return line
  const parts: string[] = []
  let rest = line
  parts.push(rest.slice(0, 75))
  rest = rest.slice(75)
  while (rest.length > 74) {
    parts.push(' ' + rest.slice(0, 74))
    rest = rest.slice(74)
  }
  if (rest.length) parts.push(' ' + rest)
  return parts.join('\r\n')
}

/** ISO/epoch → 'YYYYMMDDTHHMMSSZ' (UTC). */
export function toICSDate(value: string | number | Date): string {
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
}

export type ICSEvent = {
  uid: string
  start: string | number | Date
  end: string | number | Date
  summary: string
  description?: string
  location?: string
  status?: string  // CONFIRMED | TENTATIVE | CANCELLED
}

/** Status iCal a partir do status interno da reserva. */
export function icsStatus(status: string): 'CONFIRMED' | 'TENTATIVE' | 'CANCELLED' {
  if (status === 'hold' || status === 'solicitada') return 'TENTATIVE'
  if (status === 'cancelada' || status === 'recusada') return 'CANCELLED'
  return 'CONFIRMED'
}

/**
 * Monta um VCALENDAR válido. `dtstamp` entra por fora (determinístico/testável).
 * Linhas terminam em CRLF, como manda o RFC 5545.
 */
export function buildICS(opts: { calName: string; eventos: ICSEvent[]; dtstamp?: string | number | Date; prodId?: string }): string {
  const stamp = toICSDate(opts.dtstamp ?? new Date())
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:${icsEscape(opts.prodId || '-//Ventsy//Agenda//PT-BR')}`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    icsFold(`X-WR-CALNAME:${icsEscape(opts.calName)}`),
  ]
  for (const ev of opts.eventos) {
    const dtStart = toICSDate(ev.start)
    const dtEnd = toICSDate(ev.end)
    if (!dtStart || !dtEnd) continue
    lines.push('BEGIN:VEVENT')
    lines.push(icsFold(`UID:${icsEscape(ev.uid)}`))
    lines.push(`DTSTAMP:${stamp}`)
    lines.push(`DTSTART:${dtStart}`)
    lines.push(`DTEND:${dtEnd}`)
    lines.push(icsFold(`SUMMARY:${icsEscape(ev.summary)}`))
    if (ev.description) lines.push(icsFold(`DESCRIPTION:${icsEscape(ev.description)}`))
    if (ev.location) lines.push(icsFold(`LOCATION:${icsEscape(ev.location)}`))
    lines.push(`STATUS:${icsStatus(ev.status || 'confirmada')}`)
    lines.push('END:VEVENT')
  }
  lines.push('END:VCALENDAR')
  return lines.join('\r\n') + '\r\n'
}

// ── Util de criação de hold ──────────────────────────────────────────────────
/** Instante de expiração (ISO) de um hold criado agora por `horas`. */
export function holdExpiraEm(horas: number, nowMs = Date.now()): string {
  return new Date(nowMs + Math.max(0, horas) * HORA).toISOString()
}
