// Motor PURO de Equipamentos & Locação de itens da Ventsy.
// ─────────────────────────────────────────────────────────────────────────────
// Fonte única de verdade para DISPONIBILIDADE POR DATA de itens locáveis/
// alocáveis a eventos (mesas, cadeiras, tendas, som, palco, gerador, banheiro
// químico…). Diferente de lib/reservas.ts (que trata um espaço como recurso
// binário: ocupado/livre) — aqui cada item tem QUANTIDADE e várias alocações
// podem coexistir, cada uma consumindo parte do estoque. A regra central é:
//
//     disponível(período) = quantidade_total − PICO de unidades alocadas no período
//
// O "pico" é o máximo de unidades simultaneamente fora no intervalo consultado
// (varredura de linha / sweep-line). É consumida por:
//   • /painel/equipamentos   (inventário locável, timeline, romaneio do evento)
//   • /api/equipamentos       (checagem AUTORITATIVA de superalocação server-side)
//
// Regras de ouro (espelham lib/reservas.ts e lib/pricing.ts):
//   • SEM React, SEM Supabase, SEM "R$"/Intl aqui — só dados crus. A formatação
//     fica em lib/format, chamada por quem consome.
//   • Determinístico e testável: o "agora" entra por parâmetro (nowMs). Nada de
//     relógio escondido na lógica.

import { startOfDayLocal, ymd, addDaysYmd } from '@/lib/dateYmd'
// Re-export: testes e call-sites externos importam estes helpers deste módulo.
export { startOfDayLocal, ymd, addDaysYmd }

// ── Vocabulário do domínio ───────────────────────────────────────────────────
/** Categoria do item locável (espelha docs/sql/equipamentos.sql). */
export type EquipCategoria =
  | 'mobiliario' | 'estrutura' | 'som_luz' | 'cozinha'
  | 'sanitario' | 'energia' | 'climatizacao' | 'outro'

/** Status operacional de uma alocação ao longo do seu ciclo (sai e volta). */
export type AlocStatus =
  | 'reservado' | 'separado' | 'em_uso' | 'devolvido' | 'avariado' | 'cancelado'

/** Item locável (espelha a tabela `equipamentos`). */
export type Equipamento = {
  id: string
  usuario_id?: string
  nome: string
  categoria: EquipCategoria | string
  sku: string | null
  unidade: string            // 'un' | 'jogo' | 'kit' | 'm' | 'm2' …
  quantidade_total: number
  proprio: boolean           // true = próprio; false = sublocado de fornecedor
  fornecedor_id: string | null
  custo_locacao_num: number  // custo (sublocação) por unidade
  preco_locacao_num: number  // preço cobrado do cliente por unidade (locação)
  descricao: string | null
  foto_url: string | null
  ativo: boolean
  obs: string | null
  criado_em?: string
  atualizado_em?: string
}

/** Alocação de N unidades de um item a um evento/reserva num período (espelha
 *  a tabela `equipamentos_alocacao`). `custo_unit_num`/`preco_unit_num` são
 *  fotografias do item no momento da alocação (não acompanham edições futuras). */
export type Alocacao = {
  id: string
  usuario_id?: string
  equipamento_id: string
  evento_id: string | null
  reserva_id: string | null
  quantidade: number
  inicio: string | null
  fim: string | null
  status: AlocStatus | string
  qtd_avaria: number
  custo_unit_num: number
  preco_unit_num: number
  obs: string | null
  criado_em?: string
  atualizado_em?: string
}

// ── Metadados de status (rótulo PT + classes Tailwind + hex p/ timeline) ─────
// i18n: o `label` é o default PT; a UI pode reescrever via dicionário próprio.
export type AlocStatusMeta = { label: string; chip: string; bar: string; dot: string; hex: string; ordem: number }
export const ALOC_STATUS_META: Record<string, AlocStatusMeta> = {
  reservado: { label: 'Reservado', chip: 'bg-amber-100 text-amber-700',   bar: 'border-amber-500 bg-amber-400/80',     dot: 'bg-amber-400',   hex: '#f59e0b', ordem: 0 },
  separado:  { label: 'Separado',  chip: 'bg-sky-100 text-sky-700',       bar: 'border-sky-500 bg-sky-400/80',         dot: 'bg-sky-400',     hex: '#0ea5e9', ordem: 1 },
  em_uso:    { label: 'Em uso',    chip: 'bg-blue-100 text-blue-700',     bar: 'border-blue-600 bg-blue-500/85',       dot: 'bg-blue-500',    hex: '#2563eb', ordem: 2 },
  devolvido: { label: 'Devolvido', chip: 'bg-emerald-100 text-emerald-700', bar: 'border-emerald-600 bg-emerald-500/85', dot: 'bg-emerald-500', hex: '#10b981', ordem: 3 },
  avariado:  { label: 'Avariado',  chip: 'bg-red-100 text-red-700',       bar: 'border-red-500 bg-red-400/80',         dot: 'bg-red-400',     hex: '#ef4444', ordem: 4 },
  cancelado: { label: 'Cancelado', chip: 'bg-gray-100 text-gray-500',     bar: 'border-gray-400 bg-gray-300',          dot: 'bg-gray-300',    hex: '#9ca3af', ordem: 5 },
}
const STATUS_META_FALLBACK: AlocStatusMeta = { label: '—', chip: 'bg-gray-100 text-gray-600', bar: 'border-gray-400 bg-gray-300', dot: 'bg-gray-300', hex: '#9ca3af', ordem: 9 }
export function alocStatusMeta(status: string): AlocStatusMeta {
  return ALOC_STATUS_META[status] || { ...STATUS_META_FALLBACK, label: status }
}

/** Status que mantêm unidades FORA do estoque (e portanto contam para o pico). */
const STATUS_OCUPA = new Set<string>(['reservado', 'separado', 'em_uso'])
/** Esta alocação retém estoque (entra no cálculo de disponibilidade)? */
export function ocupaAlocacao(status: string): boolean {
  return STATUS_OCUPA.has(status)
}
/** Status terminais (a alocação saiu da circulação: voltou, avariou ou foi cancelada). */
export function alocacaoEncerrada(status: string): boolean {
  return status === 'devolvido' || status === 'avariado' || status === 'cancelado'
}

// ── Categorias (filtros + donut + selects) ───────────────────────────────────
export const CATEGORIAS_EQUIP: { v: EquipCategoria; label: string; cor: string; exemplos: string }[] = [
  { v: 'mobiliario',   label: 'Mobiliário',   cor: '#ff385c', exemplos: 'mesas, cadeiras, toalhas, lounge' },
  { v: 'estrutura',    label: 'Estrutura',    cor: '#f97316', exemplos: 'tendas, palco, arquibancada, piso' },
  { v: 'som_luz',      label: 'Som & Luz',    cor: '#8b5cf6', exemplos: 'PA, caixas, mesa, moving, par led' },
  { v: 'cozinha',      label: 'Cozinha',      cor: '#10b981', exemplos: 'fogão, freezer, réchaud, utensílios' },
  { v: 'sanitario',    label: 'Sanitário',    cor: '#14b8a6', exemplos: 'banheiro químico, pia, lavatório' },
  { v: 'energia',      label: 'Energia',      cor: '#eab308', exemplos: 'gerador, cabos, quadro, no-break' },
  { v: 'climatizacao', label: 'Climatização', cor: '#0284c7', exemplos: 'climatizador, ventilador, ar' },
  { v: 'outro',        label: 'Outro',        cor: '#94a3b8', exemplos: 'itens diversos' },
]
export const CAT_EQUIP_BY: Record<string, (typeof CATEGORIAS_EQUIP)[number]> =
  Object.fromEntries(CATEGORIAS_EQUIP.map((c) => [c.v, c]))
export function catEquipLabel(v: string | null): string { return CAT_EQUIP_BY[v || 'outro']?.label || v || '—' }
export function catEquipCor(v: string | null): string { return CAT_EQUIP_BY[v || 'outro']?.cor || '#94a3b8' }

// ── Tempo (puro, agnóstico de lib externa) ───────────────────────────────────
export const MINUTO = 60_000
export const HORA = 60 * MINUTO
export const DIA = 24 * HORA

export type Range = { start: number; end: number }

/**
 * Faixa [start, end) de uma alocação em ms epoch, a partir de `inicio`/`fim`
 * (timestamptz). Aceita também 'YYYY-MM-DD' (ancorado ao dia local). Devolve
 * null se não há datas. `end` nunca é menor que `start` (mínimo de 1 dia para
 * faixas só-data sem fim).
 */
export function toRange(a: Pick<Alocacao, 'inicio' | 'fim'>): Range | null {
  if (!a.inicio) return null
  const s = parseTempo(a.inicio)
  if (s == null) return null
  let e = a.fim ? parseTempo(a.fim) : null
  if (e == null) e = s + DIA // sem fim: assume 1 dia (uso típico de evento)
  return { start: s, end: Math.max(e, s) }
}
function parseTempo(v: string): number | null {
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return startOfDayLocal(v)
  const t = Date.parse(v)
  return Number.isNaN(t) ? null : t
}

/** Há sobreposição entre [aStart,aEnd) e [bStart,bEnd)? Faixas que apenas se
 *  encostam (fim de uma = início da outra) NÃO se sobrepõem. */
export function overlap(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd
}

// ── Disponibilidade (núcleo) ──────────────────────────────────────────────────
/**
 * PICO de unidades alocadas de um item dentro de [fromMs, toMs).
 *
 * Como várias alocações podem coexistir, o que limita a disponibilidade é o
 * INSTANTE de maior concorrência no intervalo — não a soma de todas. Resolvido
 * por varredura de linha: cada alocação vira um par de eventos (+qtd no início,
 * −qtd no fim), recortados à janela consultada; varremos em ordem somando as
 * quantidades e guardando o máximo.
 *
 * Considera apenas alocações que `ocupaAlocacao` (reservado/separado/em_uso).
 * `ignoreId` ignora uma alocação (ex.: ao mover/editar a própria).
 */
export function picoAlocado(
  alocacoes: Alocacao[],
  fromMs: number,
  toMs: number,
  opts: { ignoreId?: string } = {},
): number {
  if (!(toMs > fromMs)) return 0
  const evs: { t: number; d: number }[] = []
  for (const a of alocacoes) {
    if (opts.ignoreId && a.id === opts.ignoreId) continue
    if (!ocupaAlocacao(a.status)) continue
    const r = toRange(a)
    if (!r) continue
    const s = Math.max(r.start, fromMs)
    const e = Math.min(r.end, toMs)
    if (e <= s) continue
    const q = Math.max(0, Number(a.quantidade) || 0)
    if (q <= 0) continue
    evs.push({ t: s, d: q })
    evs.push({ t: e, d: -q })
  }
  if (!evs.length) return 0
  // Empate de tempo: processa SAÍDAS (−) antes de ENTRADAS (+), para que faixas
  // adjacentes (fim==início) não sejam contadas como simultâneas.
  evs.sort((a, b) => a.t - b.t || a.d - b.d)
  let cur = 0, pico = 0
  for (const ev of evs) { cur += ev.d; if (cur > pico) pico = cur }
  return pico
}

export type Disponibilidade = { total: number; alocadoPico: number; disponivel: number }
/**
 * Disponibilidade de um item num período. `disponivel` pode ser NEGATIVO quando
 * o item está superalocado (mais unidades fora do que existem) — a UI sinaliza
 * em vermelho. `alocacoes` pode conter itens de qualquer equipamento: filtramos
 * por `equipamento.id`.
 */
export function disponibilidade(
  equip: Pick<Equipamento, 'id' | 'quantidade_total'>,
  alocacoes: Alocacao[],
  fromMs: number,
  toMs: number,
  opts: { ignoreId?: string } = {},
): Disponibilidade {
  const total = Math.max(0, Number(equip.quantidade_total) || 0)
  const doItem = alocacoes.filter((a) => a.equipamento_id === equip.id)
  const alocadoPico = picoAlocado(doItem, fromMs, toMs, opts)
  return { total, alocadoPico, disponivel: total - alocadoPico }
}

export type Checagem = Disponibilidade & { ok: boolean; faltam: number; quantidade: number }
/**
 * Checa se dá para alocar `quantidade` unidades de `equip` em [start,end).
 * `ok=false` quando excede o disponível; `faltam` é quanto precisa SUBLOCAR
 * (vira Requisição/Compra ao fornecedor). Critério de aceite: superalocação
 * bloqueada e sugere sublocação.
 */
export function checarDisponibilidade(
  equip: Pick<Equipamento, 'id' | 'quantidade_total'>,
  alocacoes: Alocacao[],
  novo: { start: number; end: number; quantidade: number; ignoreId?: string },
): Checagem {
  const d = disponibilidade(equip, alocacoes, novo.start, novo.end, { ignoreId: novo.ignoreId })
  const quantidade = Math.max(0, Number(novo.quantidade) || 0)
  const faltam = Math.max(0, quantidade - d.disponivel)
  return { ...d, quantidade, ok: faltam === 0, faltam }
}

export type PontoSerie = { dia: number; alocado: number; disponivel: number; superalocado: boolean }
/**
 * Série DIÁRIA de disponibilidade de um item entre dois dias (para a timeline):
 * para cada dia em [fromMs, toMs), o pico daquele dia. `maxDias` limita a saída.
 */
export function serieDiaria(
  equip: Pick<Equipamento, 'id' | 'quantidade_total'>,
  alocacoes: Alocacao[],
  fromMs: number,
  toMs: number,
  maxDias = 120,
): PontoSerie[] {
  const total = Math.max(0, Number(equip.quantidade_total) || 0)
  const doItem = alocacoes.filter((a) => a.equipamento_id === equip.id)
  const out: PontoSerie[] = []
  const inicioDia = new Date(fromMs); inicioDia.setHours(0, 0, 0, 0)
  let d = inicioDia.getTime()
  let guard = 0
  while (d < toMs && guard < maxDias) {
    const fimDia = d + DIA
    const alocado = picoAlocado(doItem, d, fimDia)
    out.push({ dia: d, alocado, disponivel: total - alocado, superalocado: alocado > total })
    d = fimDia
    guard++
  }
  return out
}

// ── Agregações de custo/receita (puras, em números crus) ─────────────────────
/** Alocações que contam para custo/receita do evento (tudo menos cancelado). */
function vigente(a: Alocacao): boolean { return a.status !== 'cancelado' }

/** Custo de SUBLOCAÇÃO total de uma lista de alocações (custo_unit × qtd). */
export function custoSublocacao(alocacoes: Alocacao[]): number {
  return alocacoes.filter(vigente).reduce((s, a) => s + (Number(a.custo_unit_num) || 0) * (Number(a.quantidade) || 0), 0)
}
/** Receita de LOCAÇÃO ao cliente total (preco_unit × qtd). */
export function receitaLocacao(alocacoes: Alocacao[]): number {
  return alocacoes.filter(vigente).reduce((s, a) => s + (Number(a.preco_unit_num) || 0) * (Number(a.quantidade) || 0), 0)
}
/** Margem (receita − custo) das alocações. */
export function margemLocacao(alocacoes: Alocacao[]): number {
  return receitaLocacao(alocacoes) - custoSublocacao(alocacoes)
}

/** Total de unidades atualmente FORA (ocupando estoque agora). */
export function unidadesFora(alocacoes: Alocacao[], nowMs = Date.now()): number {
  return alocacoes.reduce((s, a) => {
    if (!ocupaAlocacao(a.status)) return s
    const r = toRange(a)
    if (!r || nowMs < r.start || nowMs >= r.end) return s
    return s + (Number(a.quantidade) || 0)
  }, 0)
}
