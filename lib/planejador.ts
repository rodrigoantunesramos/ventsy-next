// Motor puro do Planejador de Evento do cliente. Sem I/O, sem formatação de
// moeda. Gera checklists a partir de templates por tipo de evento, mede o
// progresso e consolida o orçamento (previsto × real × pago). Determinístico.

export type CategoriaPlanejador =
  | 'local'
  | 'fornecedores'
  | 'convidados'
  | 'decoracao'
  | 'gastronomia'
  | 'financeiro'
  | 'documentos'
  | 'geral'

export const CATEGORIAS_PLANEJADOR: { key: CategoriaPlanejador; label: string; emoji: string }[] = [
  { key: 'local', label: 'Local', emoji: '📍' },
  { key: 'fornecedores', label: 'Fornecedores', emoji: '🤝' },
  { key: 'convidados', label: 'Convidados', emoji: '🧑‍🤝‍🧑' },
  { key: 'decoracao', label: 'Decoração', emoji: '🎀' },
  { key: 'gastronomia', label: 'Gastronomia', emoji: '🍽️' },
  { key: 'financeiro', label: 'Financeiro', emoji: '💳' },
  { key: 'documentos', label: 'Documentos', emoji: '📄' },
  { key: 'geral', label: 'Geral', emoji: '✅' },
]

export function categoriaLabel(key?: string | null): string {
  return CATEGORIAS_PLANEJADOR.find((c) => c.key === key)?.label ?? 'Geral'
}
export function categoriaEmoji(key?: string | null): string {
  return CATEGORIAS_PLANEJADOR.find((c) => c.key === key)?.emoji ?? '✅'
}

export type TarefaSeed = { titulo: string; categoria: CategoriaPlanejador }

// Itens comuns a praticamente todos os eventos.
const BASE: TarefaSeed[] = [
  { titulo: 'Definir a data e o horário', categoria: 'geral' },
  { titulo: 'Reservar o espaço', categoria: 'local' },
  { titulo: 'Assinar o contrato', categoria: 'documentos' },
  { titulo: 'Definir o orçamento total', categoria: 'financeiro' },
  { titulo: 'Montar a lista de convidados', categoria: 'convidados' },
  { titulo: 'Enviar os convites', categoria: 'convidados' },
  { titulo: 'Confirmar presenças (RSVP)', categoria: 'convidados' },
  { titulo: 'Contratar o buffet / catering', categoria: 'gastronomia' },
  { titulo: 'Definir a decoração', categoria: 'decoracao' },
  { titulo: 'Quitar o pagamento final', categoria: 'financeiro' },
]

// Acréscimos específicos por tipo de evento (palavra-chave no tipo).
const POR_TIPO: { match: RegExp; itens: TarefaSeed[] }[] = [
  {
    match: /casa|wedding|noiv/i,
    itens: [
      { titulo: 'Contratar fotógrafo e filmagem', categoria: 'fornecedores' },
      { titulo: 'Escolher o traje dos noivos', categoria: 'geral' },
      { titulo: 'Definir cerimonialista', categoria: 'fornecedores' },
      { titulo: 'Montar a playlist / contratar banda', categoria: 'fornecedores' },
      { titulo: 'Bolo e doces', categoria: 'gastronomia' },
    ],
  },
  {
    match: /anivers|festa|debutante|15 anos/i,
    itens: [
      { titulo: 'Contratar a animação / DJ', categoria: 'fornecedores' },
      { titulo: 'Encomendar o bolo', categoria: 'gastronomia' },
      { titulo: 'Lembrancinhas', categoria: 'decoracao' },
    ],
  },
  {
    match: /corp|empres|confer|workshop|palestr|lança/i,
    itens: [
      { titulo: 'Definir a pauta / programação', categoria: 'geral' },
      { titulo: 'Contratar equipamento de som e projeção', categoria: 'fornecedores' },
      { titulo: 'Credenciamento dos participantes', categoria: 'convidados' },
      { titulo: 'Coffee break', categoria: 'gastronomia' },
      { titulo: 'Emitir notas fiscais / reembolsos', categoria: 'financeiro' },
    ],
  },
  {
    match: /formatura/i,
    itens: [
      { titulo: 'Contratar fotógrafo', categoria: 'fornecedores' },
      { titulo: 'Definir o cerimonial de colação', categoria: 'geral' },
      { titulo: 'Reservar transporte', categoria: 'fornecedores' },
    ],
  },
  {
    match: /infantil|kids|criança/i,
    itens: [
      { titulo: 'Contratar recreação / personagens', categoria: 'fornecedores' },
      { titulo: 'Brinquedos e brincadeiras', categoria: 'decoracao' },
      { titulo: 'Cardápio infantil', categoria: 'gastronomia' },
    ],
  },
]

/** Gera a checklist-modelo para um tipo de evento (base + itens específicos). */
export function gerarChecklist(tipoEvento?: string | null): TarefaSeed[] {
  const extra = POR_TIPO.find((p) => p.match.test(String(tipoEvento ?? '')))?.itens ?? []
  return [...BASE, ...extra]
}

export type TarefaLite = { concluida?: boolean | null; categoria?: string | null }

export type ProgressoChecklist = {
  total: number
  concluidas: number
  pendentes: number
  fracao: number // 0..1
}

export function progressoChecklist(tarefas: TarefaLite[]): ProgressoChecklist {
  const total = tarefas.length
  const concluidas = tarefas.filter((t) => !!t.concluida).length
  return {
    total,
    concluidas,
    pendentes: total - concluidas,
    fracao: total > 0 ? concluidas / total : 0,
  }
}

/** Progresso agrupado por categoria (para barras por seção). */
export function progressoPorCategoria(tarefas: TarefaLite[]): Record<string, ProgressoChecklist> {
  const out: Record<string, TarefaLite[]> = {}
  for (const t of tarefas) {
    const c = String(t.categoria ?? 'geral')
    ;(out[c] ??= []).push(t)
  }
  const res: Record<string, ProgressoChecklist> = {}
  for (const [c, lista] of Object.entries(out)) res[c] = progressoChecklist(lista)
  return res
}

export type ItemOrcamento = {
  categoria?: string | null
  valor_previsto?: number | null
  valor_real?: number | null
  pago?: boolean | null
}

export type ResumoOrcamento = {
  previsto: number
  real: number
  pago: number
  aPagar: number        // real (ou previsto quando sem real) ainda não pago
  saldo: number         // previsto - real (positivo = abaixo do previsto)
}

export function resumoOrcamento(itens: ItemOrcamento[]): ResumoOrcamento {
  let previsto = 0, real = 0, pago = 0, aPagar = 0
  for (const i of itens) {
    const p = Number(i.valor_previsto) || 0
    const r = i.valor_real == null ? 0 : Number(i.valor_real) || 0
    const efetivo = i.valor_real == null ? p : r
    previsto += p
    real += r
    if (i.pago) pago += efetivo
    else aPagar += efetivo
  }
  return {
    previsto: round2(previsto),
    real: round2(real),
    pago: round2(pago),
    aPagar: round2(aPagar),
    saldo: round2(previsto - real),
  }
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}
