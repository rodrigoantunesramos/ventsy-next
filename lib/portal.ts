// Motor puro do Portal do Cliente — sem I/O, sem formatação de moeda.
// Decide quais módulos o contratante enxerga, resume o financeiro do evento,
// gera as notificações (parcela vencendo, contrato pendente, evento próximo) e
// consolida o RSVP da lista de convidados. Tudo determinístico (recebe `agora`
// por parâmetro) para ser testável e reusado por API + página do cliente.
//
// Regra de ouro do projeto: NUNCA formate "R$" aqui — só números crus. A camada
// de UI usa lib/format (formatMoney/formatDate) com o locale do usuário.

// ── Catálogo de módulos ──────────────────────────────────────────────────────
export type ModuloKey =
  | 'resumo'
  | 'financeiro'
  | 'contrato'
  | 'briefing'
  | 'cronograma'
  | 'convidados'
  | 'documentos'
  | 'mensagens'
  | 'avaliacao'

export type ModuloDef = {
  key: ModuloKey
  label: string
  descricao: string
  /** sempre visível (não pode ser desligado pelo dono) — é a porta de entrada */
  fixo?: boolean
}

// Ordem de exibição das abas no portal do contratante.
export const MODULOS_PORTAL: ModuloDef[] = [
  { key: 'resumo', label: 'Resumo', descricao: 'Visão geral do evento (data, espaço, status).', fixo: true },
  { key: 'financeiro', label: 'Financeiro', descricao: 'Parcelas, vencimentos e pagamento online.' },
  { key: 'contrato', label: 'Contrato', descricao: 'Ver e assinar o contrato do evento.' },
  { key: 'briefing', label: 'Briefing', descricao: 'Detalhes e necessidades informados do evento.' },
  { key: 'cronograma', label: 'Cronograma', descricao: 'Horários de montagem, início, fim e desmontagem.' },
  { key: 'convidados', label: 'Convidados', descricao: 'Lista de convidados e confirmações (RSVP).' },
  { key: 'documentos', label: 'Documentos', descricao: 'Arquivos compartilhados do evento.' },
  { key: 'mensagens', label: 'Mensagens', descricao: 'Conversa direta com o organizador.' },
  { key: 'avaliacao', label: 'Avaliação', descricao: 'Avalie o evento depois que ele acontecer.' },
]

export const MODULO_KEYS: ModuloKey[] = MODULOS_PORTAL.map((m) => m.key)

// ── Tipos "lite" (subconjuntos das tabelas-âncora usados pelo motor) ─────────
export type ModulosMap = Partial<Record<ModuloKey, boolean>>

export type PortalConfigLite = {
  ativo?: boolean | null
  cor?: string | null
  boas_vindas?: string | null
  modulos?: ModulosMap | null
}

export type AcessoLite = {
  status?: string | null
  modulos?: ModulosMap | null
  boas_vindas?: string | null
}

export type ParcelaLite = {
  id: number | string
  numero?: number | null
  descricao?: string | null
  valor: number | null
  vencimento?: string | null
  status?: string | null
  pago_em?: string | null
}

export type ContratoLite = {
  status?: string | null
  assinado_em?: string | null
  link_token?: string | null
} | null

export type ConvidadoLite = {
  status?: string | null
  acompanhantes?: number | null
}

export type EventoLite = {
  data_inicio?: string | null
  data_fim?: string | null
  status?: string | null
}

// ── Datas (determinístico; `agora` sempre injetado) ──────────────────────────
/** Converte 'YYYY-MM-DD'/ISO/Date em Date. Datas só-data são ancoradas ao
 *  meio-dia local para evitar o off-by-one de fuso. Retorna null se inválida. */
export function parseData(value: string | number | Date | null | undefined): Date | null {
  if (value == null || value === '') return null
  const v = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value + 'T12:00:00' : value
  const d = v instanceof Date ? v : new Date(v)
  return Number.isNaN(d.getTime()) ? null : d
}

const DIA_MS = 86_400_000

/** Dias inteiros de `agora` até `value` (negativo = no passado). null se sem data. */
export function diasAte(value: string | Date | null | undefined, agora: Date): number | null {
  const d = parseData(value ?? null)
  if (!d) return null
  const a = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate()).getTime()
  const b = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  return Math.round((b - a) / DIA_MS)
}

// ── Status de parcela ─────────────────────────────────────────────────────────
const STATUS_PAGO = new Set(['pago', 'paga', 'quitada', 'quitado', 'recebido', 'recebida'])
const STATUS_CANCELADO = new Set(['cancelada', 'cancelado'])

export function parcelaPaga(status?: string | null): boolean {
  return STATUS_PAGO.has(String(status ?? '').toLowerCase())
}

export function parcelaCancelada(status?: string | null): boolean {
  return STATUS_CANCELADO.has(String(status ?? '').toLowerCase())
}

/** Em aberto = nem paga, nem cancelada. */
export function parcelaEmAberto(p: ParcelaLite): boolean {
  return !parcelaPaga(p.status) && !parcelaCancelada(p.status)
}

// ── Módulos visíveis ─────────────────────────────────────────────────────────
/** Resolve a visibilidade de cada módulo: override do acesso > config global >
 *  default (true). O módulo `fixo` (resumo) é sempre visível. */
export function modulosVisiveis(config?: PortalConfigLite | null, acesso?: AcessoLite | null): Record<ModuloKey, boolean> {
  const base = config?.modulos ?? {}
  const over = acesso?.modulos ?? null
  const out = {} as Record<ModuloKey, boolean>
  for (const m of MODULOS_PORTAL) {
    if (m.fixo) { out[m.key] = true; continue }
    const fromOver = over && typeof over[m.key] === 'boolean' ? over[m.key]! : undefined
    const fromBase = typeof base[m.key] === 'boolean' ? base[m.key]! : undefined
    out[m.key] = fromOver ?? fromBase ?? true
  }
  return out
}

/** Catálogo filtrado e ordenado pelos módulos efetivamente visíveis. */
export function modulosVisiveisLista(config?: PortalConfigLite | null, acesso?: AcessoLite | null): ModuloDef[] {
  const vis = modulosVisiveis(config, acesso)
  return MODULOS_PORTAL.filter((m) => vis[m.key])
}

/** Mensagem de boas-vindas efetiva (override do evento > config global). */
export function boasVindasEfetiva(config?: PortalConfigLite | null, acesso?: AcessoLite | null): string {
  return (acesso?.boas_vindas?.trim() || config?.boas_vindas?.trim() || '') as string
}

// ── Resumo financeiro ─────────────────────────────────────────────────────────
export type ResumoFinanceiro = {
  total: number
  pago: number
  aberto: number
  vencido: number
  qtdParcelas: number
  qtdAberto: number
  qtdVencido: number
  progresso: number // fração 0..1 do valor já pago
  proxima: ParcelaLite | null // próxima parcela em aberto (por vencimento)
}

export function resumoFinanceiro(parcelas: ParcelaLite[], agora: Date): ResumoFinanceiro {
  let total = 0, pago = 0, aberto = 0, vencido = 0, qtdAberto = 0, qtdVencido = 0
  let proxima: ParcelaLite | null = null
  let qtdParcelas = 0

  for (const p of parcelas) {
    if (parcelaCancelada(p.status)) continue
    const valor = Number(p.valor) || 0
    qtdParcelas++
    total += valor
    if (parcelaPaga(p.status)) {
      pago += valor
      continue
    }
    // em aberto
    aberto += valor
    qtdAberto++
    const dias = diasAte(p.vencimento, agora)
    if (dias != null && dias < 0) { vencido += valor; qtdVencido++ }
    // próxima = menor vencimento entre as em aberto (datas nulas vão por último)
    if (!proxima) proxima = p
    else {
      const cur = parseData(proxima.vencimento ?? null)?.getTime() ?? Infinity
      const cand = parseData(p.vencimento ?? null)?.getTime() ?? Infinity
      if (cand < cur) proxima = p
    }
  }

  const progresso = total > 0 ? Math.min(1, pago / total) : (qtdParcelas > 0 ? 1 : 0)
  return { total, pago, aberto, vencido, qtdParcelas, qtdAberto, qtdVencido, progresso, proxima }
}

// ── Contrato ──────────────────────────────────────────────────────────────────
export function contratoAssinado(c: ContratoLite): boolean {
  if (!c) return false
  return String(c.status ?? '').toLowerCase() === 'assinado' || !!c.assinado_em
}

/** Pendente de assinatura = enviado ao cliente e ainda não assinado. */
export function contratoPendente(c: ContratoLite): boolean {
  if (!c) return false
  return String(c.status ?? '').toLowerCase() === 'enviado' && !contratoAssinado(c)
}

// ── Notificações do evento ────────────────────────────────────────────────────
export type Notificacao = {
  tipo: 'parcela' | 'contrato' | 'evento'
  nivel: 'info' | 'warn' | 'urgent'
  titulo: string
  /** parcela relacionada (quando tipo='parcela'), para a UI montar o valor/link */
  parcela?: ParcelaLite
  dias?: number
}

/** Avisos acionáveis para o cliente: parcela vencida/vencendo, contrato pendente
 *  de assinatura e evento se aproximando (≤ janelaDias). Não formata moeda/data. */
export function notificacoesEvento(input: {
  evento: EventoLite
  parcelas: ParcelaLite[]
  contrato: ContratoLite
  agora: Date
  janelaDias?: number
}): Notificacao[] {
  const { evento, parcelas, contrato, agora, janelaDias = 7 } = input
  const out: Notificacao[] = []

  // Parcelas em aberto
  for (const p of parcelas) {
    if (!parcelaEmAberto(p)) continue
    const dias = diasAte(p.vencimento, agora)
    if (dias == null) continue
    if (dias < 0) {
      out.push({ tipo: 'parcela', nivel: 'urgent', titulo: 'Parcela vencida', parcela: p, dias })
    } else if (dias <= janelaDias) {
      out.push({ tipo: 'parcela', nivel: 'warn', titulo: 'Parcela vencendo', parcela: p, dias })
    }
  }

  // Contrato pendente de assinatura
  if (contratoPendente(contrato)) {
    out.push({ tipo: 'contrato', nivel: 'warn', titulo: 'Contrato aguardando sua assinatura' })
  }

  // Evento se aproximando
  const diasEvento = diasAte(evento.data_inicio, agora)
  if (diasEvento != null && diasEvento >= 0 && diasEvento <= janelaDias) {
    out.push({ tipo: 'evento', nivel: 'info', titulo: diasEvento === 0 ? 'Seu evento é hoje!' : 'Seu evento está chegando', dias: diasEvento })
  }

  // Mais urgente primeiro
  const peso = { urgent: 0, warn: 1, info: 2 } as const
  return out.sort((a, b) => peso[a.nivel] - peso[b.nivel])
}

// ── RSVP / convidados ─────────────────────────────────────────────────────────
export type RsvpResumo = {
  total: number
  confirmados: number
  recusados: number
  pendentes: number
  checkin: number
  /** total de pessoas esperadas = confirmados/checkin + seus acompanhantes */
  pessoas: number
}

export function rsvpResumo(convidados: ConvidadoLite[]): RsvpResumo {
  let confirmados = 0, recusados = 0, pendentes = 0, checkin = 0, pessoas = 0
  for (const c of convidados) {
    const s = String(c.status ?? 'convidado').toLowerCase()
    const acomp = Math.max(0, Number(c.acompanhantes) || 0)
    if (s === 'confirmado') { confirmados++; pessoas += 1 + acomp }
    else if (s === 'checkin') { checkin++; pessoas += 1 + acomp }
    else if (s === 'recusado') recusados++
    else pendentes++
  }
  return { total: convidados.length, confirmados, recusados, pendentes, checkin, pessoas }
}

// ── Evento ─────────────────────────────────────────────────────────────────────
/** O evento já aconteceu? (passou a data de fim, ou a de início se não houver fim) */
export function eventoJaOcorreu(evento: EventoLite, agora: Date): boolean {
  const ref = diasAte(evento.data_fim || evento.data_inicio, agora)
  return ref != null && ref < 0
}

// ── Erros ───────────────────────────────────────────────────────────────────────
/** PGRST205/42P01 = tabela inexistente (módulo ainda não migrado → needsSetup).
 *  Nunca use probe com head:true: HEAD sem corpo mascara o PGRST205. */
export function isMissingTable(error: { code?: string | null } | null | undefined): boolean {
  const code = error?.code
  return code === '42P01' || code === 'PGRST205'
}
