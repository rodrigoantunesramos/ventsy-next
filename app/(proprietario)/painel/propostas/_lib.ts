// _lib — vocabulário, tipos e helpers de apresentação das Propostas
// (/painel/propostas). A LÓGICA de preço NÃO mora aqui: vem da engine pura e
// compartilhada lib/pricing.ts (mesma do Simulador/Precificação). Aqui ficam:
// o modelo de status (funil), a matemática dos itens/parcelas (números crus —
// moeda via lib/format) e rótulos legíveis. Sem "R$" hardcoded.

import type { Breakdown } from '@/lib/pricing'
import type { Currency } from '@/lib/format'
import { unidadeLabel } from '../precificacao/_lib'

// ── Entidades persistidas (espelham docs/sql/propostas.sql) ──────────────────
export type PropostaStatus = 'rascunho' | 'enviada' | 'vista' | 'aceita' | 'recusada' | 'expirada'

/** Origem de uma linha do orçamento (dirige ícone/rótulo, não o cálculo). */
export type ItemTipo = 'espaco' | 'taxa' | 'pacote' | 'servico' | 'manual'

export type PropostaItem = {
  id: string
  tipo: ItemTipo
  descricao: string
  qtd: number
  valor_unit: number
  total: number
}

export type Parcela = { descricao: string; valor: number; vencimento: string | null }
export type Pagamento = { metodo?: string; parcelas: Parcela[] }

export type Proposta = {
  id: string
  usuario_id: string
  cliente_id: string | null
  evento_id: string | null
  propriedade_id: number | null
  numero: number
  titulo: string
  itens: PropostaItem[]
  subtotal_num: number
  desconto_num: number
  total_num: number
  moeda: Currency
  validade: string | null
  condicoes_pagamento: Pagamento
  observacoes: string | null
  condicoes: string | null
  status: PropostaStatus
  link_token: string
  enviada_em: string | null
  vista_em: string | null
  aceita_em: string | null
  recusada_em: string | null
  motivo_recusa: string | null
  criado_em: string
  atualizado_em?: string
}

export type PropostaTemplate = {
  id: string
  usuario_id: string
  nome: string
  tipo_evento: string | null
  titulo: string | null
  itens: PropostaItem[]
  condicoes_pagamento: Pagamento
  observacoes: string | null
  condicoes: string | null
}

/** Lead/evento de origem (subconjunto de clientes_eventos usado no construtor). */
export type Evento = {
  id: string
  nome_evento: string | null
  quem_contratou: string | null
  documento: string | null
  email: string | null
  telefones: string[] | null
  tipo_evento: string | null
  status: string | null
  data_inicio: string | null
  data_fim: string | null
  qtd_adultos: number | null
  qtd_criancas: number | null
  valor_total_num: number | null
  propriedade_id: number | null
  cliente_id: string | null
}

export type Propriedade = { id: number; nome: string | null; cidade?: string | null; estado?: string | null }

/** Marca/identidade da empresa para o cabeçalho da proposta (empresa_config). */
export type Empresa = {
  razao_social: string | null
  fantasia: string | null
  cnpj: string | null
  logo_url: string | null
  contatos: { email?: string; telefone?: string; whatsapp?: string; site?: string; instagram?: string } | null
  endereco: { cidade?: string; estado?: string; rua?: string; numero?: string; bairro?: string } | null
}

// ── Modelo de status / funil ─────────────────────────────────────────────────
export const STATUS: { v: PropostaStatus; label: string; cls: string; dot: string }[] = [
  { v: 'rascunho', label: 'Rascunho', cls: 'bg-black/[0.05] text-ink-muted', dot: 'bg-black/30' },
  { v: 'enviada', label: 'Enviada', cls: 'bg-blue-50 text-blue-700', dot: 'bg-blue-500' },
  { v: 'vista', label: 'Visualizada', cls: 'bg-violet-50 text-violet-700', dot: 'bg-violet-500' },
  { v: 'aceita', label: 'Aceita', cls: 'bg-emerald-50 text-emerald-700', dot: 'bg-emerald-500' },
  { v: 'recusada', label: 'Recusada', cls: 'bg-red-50 text-red-700', dot: 'bg-red-500' },
  { v: 'expirada', label: 'Expirada', cls: 'bg-amber-50 text-amber-700', dot: 'bg-amber-500' },
]
export const STATUS_BY = Object.fromEntries(STATUS.map((s) => [s.v, s])) as Record<PropostaStatus, (typeof STATUS)[number]>

/** Status que contam como "em negociação" (pipeline aberto). */
export const ABERTAS = new Set<PropostaStatus>(['rascunho', 'enviada', 'vista'])

export const ITEM_TIPOS: { v: ItemTipo; label: string; icon: string }[] = [
  { v: 'espaco', label: 'Espaço / locação', icon: '🏛️' },
  { v: 'taxa', label: 'Taxa / adicional', icon: '🧾' },
  { v: 'pacote', label: 'Pacote', icon: '📦' },
  { v: 'servico', label: 'Serviço', icon: '✨' },
  { v: 'manual', label: 'Item avulso', icon: '✏️' },
]
export const ITEM_TIPO_BY = Object.fromEntries(ITEM_TIPOS.map((t) => [t.v, t])) as Record<ItemTipo, (typeof ITEM_TIPOS)[number]>

export const METODOS_PAGAMENTO = ['Pix', 'Cartão de crédito', 'Boleto', 'Transferência', 'Dinheiro', 'Misto']

// ── Helpers de identidade / data ─────────────────────────────────────────────
let _seq = 0
/** id local estável para uma linha de item (não persiste em sequência). */
export function newId(prefix = 'it'): string {
  _seq += 1
  return `${prefix}_${_seq}_${performance.now().toString(36).replace('.', '')}`
}

export function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
export function addDays(base: string, days: number): string {
  const d = new Date((base || ymd(new Date())) + 'T12:00:00')
  d.setDate(d.getDate() + days)
  return ymd(d)
}
export function addMonths(base: string, months: number): string {
  const d = new Date((base || ymd(new Date())) + 'T12:00:00')
  d.setMonth(d.getMonth() + months)
  return ymd(d)
}

const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100

// ── Matemática dos itens / totais ────────────────────────────────────────────
export function itemTotal(qtd: number, valor_unit: number): number {
  return round2((Number(qtd) || 0) * (Number(valor_unit) || 0))
}
export function calcSubtotal(itens: PropostaItem[]): number {
  return round2(itens.reduce((s, it) => s + (Number(it.total) || 0), 0))
}
export function calcTotal(subtotal: number, desconto: number): number {
  return Math.max(0, round2((Number(subtotal) || 0) - (Number(desconto) || 0)))
}

/**
 * Converte um Breakdown da engine (lib/pricing) em linhas de proposta:
 * uma linha de espaço (subtotal já com ajustes embutidos) + uma linha por taxa.
 * Mantém o orçamento limpo e transparente, sem reimplementar cálculo.
 */
export function breakdownToItens(bk: Breakdown, nomeEspaco: string): PropostaItem[] {
  const out: PropostaItem[] = []
  const ajustesTxt = bk.ajustes.length
    ? ` (inclui ${bk.ajustes.map((a) => a.nome).join(', ')})`
    : ''
  out.push({
    id: newId(),
    tipo: 'espaco',
    descricao: `${nomeEspaco} — ${bk.quantidade} ${unidadeLabel(bk.unidade)}${bk.quantidade > 1 ? 's' : ''}${ajustesTxt}`,
    qtd: 1,
    valor_unit: round2(bk.subtotal),
    total: round2(bk.subtotal),
  })
  for (const t of bk.taxas) {
    out.push({
      id: newId(),
      tipo: 'taxa',
      descricao: t.nome,
      qtd: 1,
      valor_unit: round2(t.total),
      total: round2(t.total),
    })
  }
  return out
}

/**
 * Plano de pagamento padrão: entrada (% do total) + N parcelas mensais do
 * restante, vencendo a partir de `primeiraData`. Tudo em números crus.
 */
export function gerarParcelas(
  total: number,
  entradaPct: number,
  nParcelas: number,
  primeiraData: string,
): Parcela[] {
  const t = round2(total)
  if (t <= 0) return []
  const n = Math.max(1, Math.floor(nParcelas))
  const entrada = round2((t * Math.min(100, Math.max(0, entradaPct))) / 100)
  const parcelas: Parcela[] = []
  if (entrada > 0) {
    parcelas.push({ descricao: 'Entrada', valor: entrada, vencimento: primeiraData })
  }
  const restante = round2(t - entrada)
  if (restante > 0) {
    const base = Math.floor((restante / n) * 100) / 100
    let acc = 0
    for (let i = 0; i < n; i++) {
      const last = i === n - 1
      const valor = last ? round2(restante - acc) : base
      acc = round2(acc + valor)
      parcelas.push({
        descricao: `Parcela ${i + 1}/${n}`,
        valor,
        vencimento: addMonths(primeiraData, entrada > 0 ? i + 1 : i),
      })
    }
  }
  return parcelas
}

export function somaParcelas(p: Parcela[]): number {
  return round2((p || []).reduce((s, x) => s + (Number(x.valor) || 0), 0))
}

// ── Validade ─────────────────────────────────────────────────────────────────
/** A proposta está vencida? (validade no passado e ainda não aceita/recusada). */
export function estaVencida(p: Pick<Proposta, 'validade' | 'status'>): boolean {
  if (!p.validade) return false
  if (p.status === 'aceita' || p.status === 'recusada') return false
  return p.validade < ymd(new Date())
}

// ── Cláusulas / observações padrão (i18n: extrair p/ dicionário no futuro) ───
export const CLAUSULAS_PADRAO = [
  'A reserva da data só é confirmada após o aceite desta proposta e o pagamento da entrada.',
  'Os valores e condições aqui descritos são válidos até a data de validade indicada.',
  'Cancelamentos seguem a política informada no contrato; a entrada não é reembolsável.',
  'Eventuais serviços e taxas extras não listados serão orçados à parte.',
].join('\n')

// ── Tabela ainda não criada (migration pendente) ─────────────────────────────
// REST (PostgREST) devolve PGRST205; Postgres cru, 42P01 — tratamos ambos.
export { isMissingTable } from '@/lib/dbErrors'

// Classe de input reutilizada (espelha o design system do contexto-base).
export const inp =
  'w-full rounded-xl border border-black/10 px-3.5 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20'

/** Nome de exibição do cliente a partir do evento. */
export function clienteDoEvento(e: Evento | null | undefined): string {
  return (e?.quem_contratou || e?.nome_evento || 'Cliente').trim()
}

/** Rótulo "Proposta Nº 0001". */
export function numeroLabel(n: number): string {
  return `Nº ${String(n || 0).padStart(4, '0')}`
}
