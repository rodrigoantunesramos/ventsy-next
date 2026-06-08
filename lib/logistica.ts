// Motor PURO da Logística de evento da Ventsy.
// ─────────────────────────────────────────────────────────────────────────────
// Fonte única de verdade para o FÍSICO antes/depois do evento:
//   • CRONOGRAMA FÍSICO — compõe montagem → evento → desmontagem (+ ensaio/
//     limpeza) numa única linha do tempo, com início/fim e duração de cada fase;
//   • CHOQUE DE DOCAS — detecta quando duas chegadas de fornecedor disputam a
//     mesma doca/portão no mesmo intervalo de descarga (varredura de pares);
//   • FROTA — conflito de veículo (não pode estar em duas viagens ao mesmo tempo)
//     e disponibilidade num período;
//   • CREDENCIAL de veículo de fornecedor (código curto, estável e imprimível).
//
// É consumida por:
//   • /painel/logistica   (cronograma, agenda de fornecedores, docas, frota)
//   • /api/logistica       (janelas → bloqueio em `reservas`; reusa lib/reservas)
//
// Regras de ouro (espelham lib/reservas.ts, lib/equipamentos.ts e lib/pricing.ts):
//   • SEM React, SEM Supabase, SEM "R$"/Intl aqui — só dados crus. A formatação
//     fica em lib/format, chamada por quem consome.
//   • Determinístico e testável: o "agora" entra por parâmetro (nowMs). Nada de
//     relógio escondido na lógica; credencial deriva só do id (sem Date/random).

// ── Vocabulário do domínio ───────────────────────────────────────────────────
export type JanelaTipo = 'montagem' | 'desmontagem' | 'ensaio' | 'limpeza'
export type ChegadaStatus = 'agendado' | 'chegou' | 'descarregando' | 'montado' | 'saiu' | 'cancelado'
export type FrotaTipo = 'caminhao' | 'van' | 'carro' | 'onibus' | 'moto' | 'utilitario' | 'outro'
export type FrotaStatus = 'disponivel' | 'em_viagem' | 'manutencao' | 'inativo'
export type ViagemStatus = 'planejada' | 'em_curso' | 'concluida' | 'cancelada'

/** Janela física que ocupa o espaço (espelha `logistica_janelas`). Cada janela
 *  atrela um bloqueio em `reservas` (reserva_id) para refletir na agenda. */
export type Janela = {
  id: string
  usuario_id?: string
  evento_id: string | null
  propriedade_id: number | null
  espaco_id: number | null
  reserva_id: string | null
  tipo: JanelaTipo | string
  titulo: string | null
  inicio: string | null
  fim: string | null
  obs: string | null
  criado_em?: string
  atualizado_em?: string
}

/** Chegada de fornecedor / movimento de carga e descarga (espelha
 *  `logistica_chegadas`). `previsto` + `duracao_min` definem a janela de doca. */
export type Chegada = {
  id: string
  usuario_id?: string
  evento_id: string | null
  fornecedor_id: string | null
  item: string
  previsto: string | null
  duracao_min: number
  doca: string | null
  veiculo: string | null
  placa: string | null
  responsavel: string | null
  contato: string | null
  status: ChegadaStatus | string
  checklist: ChecklistItem[]
  obs: string | null
  criado_em?: string
  atualizado_em?: string
}
export type ChecklistItem = { label: string; ok: boolean }

/** Veículo próprio (espelha `frota`). */
export type Veiculo = {
  id: string
  usuario_id?: string
  tipo: FrotaTipo | string
  nome: string
  placa: string | null
  capacidade: number | null
  capacidade_unidade: string
  motorista: string | null
  motorista_contato: string | null
  status: FrotaStatus | string
  obs: string | null
  criado_em?: string
  atualizado_em?: string
}

/** Roteiro de transporte de material (espelha `frota_viagens`). */
export type Viagem = {
  id: string
  usuario_id?: string
  frota_id: string
  evento_id: string | null
  origem: string | null
  destino: string | null
  partida: string | null
  retorno: string | null
  carga: string | null
  status: ViagemStatus | string
  obs: string | null
  criado_em?: string
}

// ── Tempo (puro, agnóstico de lib externa) ───────────────────────────────────
export const MINUTO = 60_000
export const HORA = 60 * MINUTO
export const DIA = 24 * HORA
export const DEFAULT_DESCARGA_MIN = 30   // janela padrão de descarga numa doca
export const DEFAULT_VIAGEM_MIN = 120    // duração padrão de viagem sem retorno

export type Range = { start: number; end: number }

/** 'YYYY-MM-DD' → meia-noite local em ms (ancorado p/ evitar UTC off-by-one). */
export function startOfDayLocal(ymdStr: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymdStr)
  if (!m) return NaN
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 0, 0, 0, 0).getTime()
}
/** Date → 'YYYY-MM-DD' local. */
export function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
/** Soma `n` dias a uma string 'YYYY-MM-DD' (local), devolvendo 'YYYY-MM-DD'. */
export function addDaysYmd(s: string, n: number): string {
  const t = startOfDayLocal(s)
  if (Number.isNaN(t)) return s
  return ymd(new Date(t + n * DIA))
}
/** ISO/timestamptz ou 'YYYY-MM-DD' → ms epoch (null se inválido). */
export function parseTempo(v: string | null | undefined): number | null {
  if (!v) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return startOfDayLocal(v)
  const t = Date.parse(v)
  return Number.isNaN(t) ? null : t
}

/** Há sobreposição entre [aStart,aEnd) e [bStart,bEnd)? Faixas que apenas se
 *  encostam (fim de uma = início da outra) NÃO se sobrepõem. `buffer` exige um
 *  intervalo livre extra entre elas (folga de manobra na doca, p.ex.). */
export function overlap(aStart: number, aEnd: number, bStart: number, bEnd: number, buffer = 0): boolean {
  return aStart < bEnd + buffer && bStart < aEnd + buffer
}

// ── Metadados de status (rótulo PT + classes Tailwind + hex) ─────────────────
// i18n: o `label` é o default PT; a UI pode reescrever via dicionário próprio.
export type Meta = { label: string; chip: string; bar: string; dot: string; hex: string; ordem: number }
const FALLBACK: Meta = { label: '—', chip: 'bg-gray-100 text-gray-600', bar: 'border-gray-400 bg-gray-300', dot: 'bg-gray-300', hex: '#9ca3af', ordem: 9 }

export const JANELA_TIPO_META: Record<string, Meta> = {
  montagem:    { label: 'Montagem',    chip: 'bg-sky-100 text-sky-700',       bar: 'border-sky-500 bg-sky-400/85',       dot: 'bg-sky-400',     hex: '#0ea5e9', ordem: 0 },
  ensaio:      { label: 'Ensaio',      chip: 'bg-violet-100 text-violet-700', bar: 'border-violet-500 bg-violet-400/85', dot: 'bg-violet-400',  hex: '#8b5cf6', ordem: 1 },
  evento:      { label: 'Evento',      chip: 'bg-emerald-100 text-emerald-700', bar: 'border-emerald-600 bg-emerald-500/85', dot: 'bg-emerald-500', hex: '#10b981', ordem: 2 },
  desmontagem: { label: 'Desmontagem', chip: 'bg-amber-100 text-amber-700',   bar: 'border-amber-500 bg-amber-400/85',   dot: 'bg-amber-400',   hex: '#f59e0b', ordem: 3 },
  limpeza:     { label: 'Limpeza',     chip: 'bg-teal-100 text-teal-700',     bar: 'border-teal-500 bg-teal-400/85',     dot: 'bg-teal-400',    hex: '#14b8a6', ordem: 4 },
}
export function janelaTipoMeta(tipo: string): Meta { return JANELA_TIPO_META[tipo] || { ...FALLBACK, label: tipo } }

export const CHEGADA_STATUS_META: Record<string, Meta> = {
  agendado:     { label: 'Agendado',      chip: 'bg-slate-100 text-slate-700',  bar: 'border-slate-400 bg-slate-300',     dot: 'bg-slate-400',   hex: '#64748b', ordem: 0 },
  chegou:       { label: 'Chegou',        chip: 'bg-sky-100 text-sky-700',      bar: 'border-sky-500 bg-sky-400/85',      dot: 'bg-sky-400',     hex: '#0ea5e9', ordem: 1 },
  descarregando:{ label: 'Descarregando', chip: 'bg-blue-100 text-blue-700',    bar: 'border-blue-600 bg-blue-500/85',    dot: 'bg-blue-500',    hex: '#2563eb', ordem: 2 },
  montado:      { label: 'Montado',       chip: 'bg-emerald-100 text-emerald-700', bar: 'border-emerald-600 bg-emerald-500/85', dot: 'bg-emerald-500', hex: '#10b981', ordem: 3 },
  saiu:         { label: 'Saiu',          chip: 'bg-gray-100 text-gray-600',    bar: 'border-gray-400 bg-gray-300',       dot: 'bg-gray-400',    hex: '#6b7280', ordem: 4 },
  cancelado:    { label: 'Cancelado',     chip: 'bg-red-100 text-red-700',      bar: 'border-red-400 bg-red-300',         dot: 'bg-red-300',     hex: '#ef4444', ordem: 5 },
}
export function chegadaStatusMeta(status: string): Meta { return CHEGADA_STATUS_META[status] || { ...FALLBACK, label: status } }

export const FROTA_STATUS_META: Record<string, Meta> = {
  disponivel: { label: 'Disponível', chip: 'bg-emerald-100 text-emerald-700', bar: 'border-emerald-500 bg-emerald-400', dot: 'bg-emerald-500', hex: '#10b981', ordem: 0 },
  em_viagem:  { label: 'Em viagem',  chip: 'bg-blue-100 text-blue-700',       bar: 'border-blue-500 bg-blue-400',       dot: 'bg-blue-500',    hex: '#2563eb', ordem: 1 },
  manutencao: { label: 'Manutenção', chip: 'bg-amber-100 text-amber-700',     bar: 'border-amber-500 bg-amber-400',     dot: 'bg-amber-500',   hex: '#f59e0b', ordem: 2 },
  inativo:    { label: 'Inativo',    chip: 'bg-gray-100 text-gray-500',       bar: 'border-gray-400 bg-gray-300',       dot: 'bg-gray-300',    hex: '#9ca3af', ordem: 3 },
}
export function frotaStatusMeta(status: string): Meta { return FROTA_STATUS_META[status] || { ...FALLBACK, label: status } }

export const VIAGEM_STATUS_META: Record<string, Meta> = {
  planejada: { label: 'Planejada', chip: 'bg-slate-100 text-slate-700',   bar: 'border-slate-400 bg-slate-300',     dot: 'bg-slate-400',   hex: '#64748b', ordem: 0 },
  em_curso:  { label: 'Em curso',  chip: 'bg-blue-100 text-blue-700',     bar: 'border-blue-600 bg-blue-500/85',    dot: 'bg-blue-500',    hex: '#2563eb', ordem: 1 },
  concluida: { label: 'Concluída', chip: 'bg-emerald-100 text-emerald-700', bar: 'border-emerald-600 bg-emerald-500', dot: 'bg-emerald-500', hex: '#10b981', ordem: 2 },
  cancelada: { label: 'Cancelada', chip: 'bg-gray-100 text-gray-500',     bar: 'border-gray-400 bg-gray-300',       dot: 'bg-gray-300',    hex: '#9ca3af', ordem: 3 },
}
export function viagemStatusMeta(status: string): Meta { return VIAGEM_STATUS_META[status] || { ...FALLBACK, label: status } }

export const FROTA_TIPOS: { v: FrotaTipo; label: string }[] = [
  { v: 'caminhao', label: 'Caminhão' }, { v: 'van', label: 'Van' }, { v: 'utilitario', label: 'Utilitário' },
  { v: 'carro', label: 'Carro' }, { v: 'onibus', label: 'Ônibus' }, { v: 'moto', label: 'Moto' }, { v: 'outro', label: 'Outro' },
]
export const JANELA_TIPOS: JanelaTipo[] = ['montagem', 'desmontagem', 'ensaio', 'limpeza']

// ── Cronograma físico (montagem → evento → desmontagem) ──────────────────────
/** Faixa [start,end) de uma janela (a partir de inicio/fim). */
export function janelaRange(j: Pick<Janela, 'inicio' | 'fim'>): Range | null {
  const s = parseTempo(j.inicio)
  if (s == null) return null
  const e = parseTempo(j.fim)
  if (e == null) return { start: s, end: s + HORA }
  return { start: s, end: Math.max(e, s) }
}

export type FaseFisica = {
  tipo: 'montagem' | 'evento' | 'desmontagem' | 'ensaio' | 'limpeza' | string
  label: string
  start: number
  end: number
  duracaoMin: number
  janelaId: string | null   // null para a fase 'evento'
}
export type Cronograma = {
  fases: FaseFisica[]
  inicio: number | null
  fim: number | null
  duracaoTotalMin: number
}
/**
 * Linha do tempo física de um evento: combina as JANELAS (montagem/desmontagem/
 * ensaio/limpeza) com a própria janela do EVENTO, ordenadas por início. É o
 * "montagem → evento → desmontagem" que ocupa o espaço além do evento em si.
 */
export function cronogramaFisico(
  evento: { inicio: string | null; fim: string | null } | null,
  janelas: Janela[],
): Cronograma {
  const fases: FaseFisica[] = []
  for (const j of janelas) {
    const r = janelaRange(j)
    if (!r) continue
    fases.push({
      tipo: j.tipo,
      label: janelaTipoMeta(j.tipo).label,
      start: r.start,
      end: r.end,
      duracaoMin: Math.round((r.end - r.start) / MINUTO),
      janelaId: j.id,
    })
  }
  if (evento?.inicio) {
    const s = parseTempo(evento.inicio)
    if (s != null) {
      const e = parseTempo(evento.fim) ?? s + DIA
      const end = Math.max(e, s)
      fases.push({ tipo: 'evento', label: 'Evento', start: s, end, duracaoMin: Math.round((end - s) / MINUTO), janelaId: null })
    }
  }
  fases.sort((a, b) => a.start - b.start || a.end - b.end)
  const inicio = fases.length ? Math.min(...fases.map((f) => f.start)) : null
  const fim = fases.length ? Math.max(...fases.map((f) => f.end)) : null
  const duracaoTotalMin = inicio != null && fim != null ? Math.round((fim - inicio) / MINUTO) : 0
  return { fases, inicio, fim, duracaoTotalMin }
}

// ── Carga & descarga: choque de docas ─────────────────────────────────────────
/** Faixa [previsto, previsto+duracao) de uma chegada. */
export function chegadaRange(c: Pick<Chegada, 'previsto' | 'duracao_min'>): Range | null {
  const s = parseTempo(c.previsto)
  if (s == null) return null
  const dur = Math.max(5, Number(c.duracao_min) || DEFAULT_DESCARGA_MIN)
  return { start: s, end: s + dur * MINUTO }
}
/** Normaliza o rótulo da doca (case/espacos) p/ comparação. */
export function normalizeDoca(d: string | null | undefined): string {
  return (d || '').trim().toLowerCase()
}
const CHEGADA_LIVRE = new Set<string>(['saiu', 'cancelado'])
/** A chegada ainda DISPUTA a doca (não saiu nem foi cancelada)? */
export function chegadaOcupaDoca(status: string): boolean {
  return !CHEGADA_LIVRE.has(status)
}

export type ChoqueDoca = { a: Chegada; b: Chegada; doca: string }
/**
 * Pares de chegadas que DISPUTAM a mesma doca no mesmo intervalo de descarga.
 * Só considera chegadas com doca definida que ainda ocupam (não saíram/canceladas).
 * Critério de aceite: "agenda de chegadas evita choque de docas".
 */
export function detectarChoqueDocas(chegadas: Chegada[], buffer = 0): ChoqueDoca[] {
  const ativos = chegadas.filter((c) => chegadaOcupaDoca(c.status) && normalizeDoca(c.doca))
  const out: ChoqueDoca[] = []
  for (let i = 0; i < ativos.length; i++) {
    for (let j = i + 1; j < ativos.length; j++) {
      const A = ativos[i], B = ativos[j]
      if (normalizeDoca(A.doca) !== normalizeDoca(B.doca)) continue
      const ra = chegadaRange(A), rb = chegadaRange(B)
      if (!ra || !rb) continue
      if (overlap(ra.start, ra.end, rb.start, rb.end, buffer * MINUTO)) {
        out.push({ a: A, b: B, doca: (A.doca || '').trim() })
      }
    }
  }
  return out
}
/** Conjunto de ids de chegadas envolvidas em algum choque (p/ destaque na UI). */
export function chegadasEmChoque(chegadas: Chegada[], buffer = 0): Set<string> {
  const s = new Set<string>()
  for (const c of detectarChoqueDocas(chegadas, buffer)) { s.add(c.a.id); s.add(c.b.id) }
  return s
}
/** A doca está livre no período (ignorando opcionalmente uma chegada)? */
export function docaLivre(chegadas: Chegada[], doca: string, range: Range, ignoreId?: string): boolean {
  const d = normalizeDoca(doca)
  if (!d) return true
  return !chegadas.some((c) => {
    if (ignoreId && c.id === ignoreId) return false
    if (!chegadaOcupaDoca(c.status)) return false
    if (normalizeDoca(c.doca) !== d) return false
    const r = chegadaRange(c)
    return !!r && overlap(range.start, range.end, r.start, r.end)
  })
}
/** Primeira doca livre da lista p/ o período — sugere remanejar e evitar choque. */
export function proximaDocaLivre(chegadas: Chegada[], docas: string[], range: Range, ignoreId?: string): string | null {
  for (const d of docas) if (docaLivre(chegadas, d, range, ignoreId)) return d
  return null
}
/** Ordena chegadas pela hora prevista (sem previsto vai ao fim; canceladas por último). */
export function ordenarChegadas(chegadas: Chegada[]): Chegada[] {
  return [...chegadas].sort((a, b) => {
    const ca = a.status === 'cancelado' ? 1 : 0, cb = b.status === 'cancelado' ? 1 : 0
    if (ca !== cb) return ca - cb
    const ta = parseTempo(a.previsto), tb = parseTempo(b.previsto)
    if (ta == null && tb == null) return 0
    if (ta == null) return 1
    if (tb == null) return -1
    return ta - tb
  })
}
/** Agrupa chegadas por doca (chave = rótulo cru; "" para sem doca). */
export function agruparPorDoca(chegadas: Chegada[]): Map<string, Chegada[]> {
  const m = new Map<string, Chegada[]>()
  for (const c of chegadas) {
    const k = (c.doca || '').trim()
    const arr = m.get(k) || []
    arr.push(c)
    m.set(k, arr)
  }
  return m
}

export type ProgressoRecebimento = { total: number; recebidos: number; emAndamento: number; pendentes: number; percent: number }
/** Progresso de recebimento de uma lista de chegadas (ignora canceladas).
 *  `percent` é fração 0–1 (use lib/format.formatPercent na UI). */
export function progressoRecebimento(chegadas: Chegada[]): ProgressoRecebimento {
  const vivos = chegadas.filter((c) => c.status !== 'cancelado')
  const total = vivos.length
  const recebidos = vivos.filter((c) => c.status === 'montado' || c.status === 'saiu').length
  const emAndamento = vivos.filter((c) => c.status === 'chegou' || c.status === 'descarregando').length
  const pendentes = vivos.filter((c) => c.status === 'agendado').length
  return { total, recebidos, emAndamento, pendentes, percent: total ? recebidos / total : 0 }
}
/** Progresso da checklist de recebimento de UMA chegada (fração 0–1). */
export function progressoChecklist(itens: ChecklistItem[]): number {
  if (!itens.length) return 0
  return itens.filter((i) => i.ok).length / itens.length
}

// ── Frota: conflito e disponibilidade ─────────────────────────────────────────
/** Faixa [partida, retorno) de uma viagem (retorno ausente → duração padrão). */
export function viagemRange(v: Pick<Viagem, 'partida' | 'retorno'>): Range | null {
  const s = parseTempo(v.partida)
  if (s == null) return null
  const e = parseTempo(v.retorno) ?? s + DEFAULT_VIAGEM_MIN * MINUTO
  return { start: s, end: Math.max(e, s) }
}
/** A viagem ainda conta para conflito/ocupação (não foi cancelada)? */
export function viagemAtiva(status: string): boolean {
  return status !== 'cancelada'
}
export type ConflitoViagem = { a: Viagem; b: Viagem; frota_id: string }
/** Viagens do MESMO veículo que se sobrepõem no tempo (não pode estar em duas). */
export function conflitosViagem(viagens: Viagem[]): ConflitoViagem[] {
  const ativas = viagens.filter((v) => viagemAtiva(v.status))
  const out: ConflitoViagem[] = []
  for (let i = 0; i < ativas.length; i++) {
    for (let j = i + 1; j < ativas.length; j++) {
      const A = ativas[i], B = ativas[j]
      if (A.frota_id !== B.frota_id) continue
      const ra = viagemRange(A), rb = viagemRange(B)
      if (!ra || !rb) continue
      if (overlap(ra.start, ra.end, rb.start, rb.end)) out.push({ a: A, b: B, frota_id: A.frota_id })
    }
  }
  return out
}
/** Ids de viagens envolvidas em algum conflito de frota (destaque na UI). */
export function viagensEmConflito(viagens: Viagem[]): Set<string> {
  const s = new Set<string>()
  for (const c of conflitosViagem(viagens)) { s.add(c.a.id); s.add(c.b.id) }
  return s
}
/** Um veículo está ocupado (em viagem ativa) num instante? */
export function veiculoOcupadoEm(viagens: Viagem[], frotaId: string, ms: number): boolean {
  return viagens.some((v) => {
    if (v.frota_id !== frotaId || !viagemAtiva(v.status)) return false
    const r = viagemRange(v)
    return !!r && ms >= r.start && ms < r.end
  })
}
/**
 * Veículos disponíveis para um período: status operacional 'disponivel' (fora
 * de manutenção/inativo) e SEM viagem ativa sobreposta ao período.
 */
export function veiculosDisponiveis(veiculos: Veiculo[], viagens: Viagem[], range: Range): Veiculo[] {
  return veiculos.filter((v) => {
    if (v.status === 'manutencao' || v.status === 'inativo') return false
    const ocupado = viagens.some((t) => {
      if (t.frota_id !== v.id || !viagemAtiva(t.status)) return false
      const r = viagemRange(t)
      return !!r && overlap(range.start, range.end, r.start, r.end)
    })
    return !ocupado
  })
}

// ── Credencial de veículo de fornecedor (estável, sem Date/random) ───────────
/**
 * Código curto e legível p/ crachá/credencial do veículo do fornecedor. Estável:
 * deriva apenas do id (hash determinístico) — o mesmo veículo recebe sempre o
 * mesmo código (bom p/ impressão e conferência na portaria). Critério de aceite:
 * "credencial de veículo de fornecedor".
 */
export function credencialVeiculo(c: Pick<Chegada, 'id'>): string {
  const base = String(c.id).replace(/[^a-zA-Z0-9]/g, '')
  let h = 2166136261 >>> 0 // FNV-1a
  for (let i = 0; i < base.length; i++) {
    h ^= base.charCodeAt(i)
    h = Math.imul(h, 16777619) >>> 0
  }
  return 'LOG-' + h.toString(36).toUpperCase().padStart(6, '0').slice(-6)
}

// ── Agregações simples (KPIs) ─────────────────────────────────────────────────
/** Conta itens de uma lista por uma chave de status. */
export function contarPorStatus<T extends { status: string }>(itens: T[]): Record<string, number> {
  const m: Record<string, number> = {}
  for (const it of itens) m[it.status] = (m[it.status] || 0) + 1
  return m
}
/** Janelas que começam dentro de [nowMs, nowMs + dias*DIA). */
export function janelasProximas(janelas: Janela[], dias = 7, nowMs = Date.now()): Janela[] {
  const lim = nowMs + dias * DIA
  return janelas
    .filter((j) => { const r = janelaRange(j); return !!r && r.start >= nowMs && r.start < lim })
    .sort((a, b) => (janelaRange(a)!.start) - (janelaRange(b)!.start))
}
