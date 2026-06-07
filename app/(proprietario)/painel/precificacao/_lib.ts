// _lib — vocabulário de UI, rótulos i18n-ready e descritores da Precificação
// (/painel/precificacao). A LÓGICA de cálculo NÃO mora aqui: ela é a engine pura
// e compartilhada em lib/pricing.ts. Aqui só ficam listas para formulários,
// rótulos legíveis e helpers de apresentação (números crus; moeda via lib/format).

import { formatMoney, formatPercent, getFormatPrefs, type Currency } from '@/lib/format'
import { MOEDAS } from '@/lib/prefs'
import type { Base, AjusteTipo, RegraTipo, TaxaTipo, PrecoRegra, Condicao } from '@/lib/pricing'

// ── Entidades só de UI (não usadas pela engine) ──────────────────────────────
export type Propriedade = { id: number; nome: string | null }
export type PacoteItem = { descricao: string; valor_num?: number }
export type Pacote = {
  id: string
  usuario_id: string
  propriedade_id: number | null
  nome: string
  descricao: string | null
  itens: PacoteItem[]
  valor_num: number
  ativo: boolean
  criado_em?: string
  atualizado_em?: string
}

// ── Símbolo da moeda ativa (sem "R$" hardcoded — vem da tabela de MOEDAS) ─────
const SIMBOLO: Record<Currency, string> = Object.fromEntries(
  MOEDAS.map((m) => [m.v, m.simbolo]),
) as Record<Currency, string>
export function simboloMoeda(c?: Currency): string {
  return SIMBOLO[c ?? getFormatPrefs().currency] ?? ''
}

// ── Unidade da tabela base ────────────────────────────────────────────────────
export const BASES: { v: Base; label: string; sufixo: string; hint: string }[] = [
  { v: 'diaria', label: 'Por diária', sufixo: '/ diária', hint: 'Cobra por dia de uso (fim de semana = 2 diárias).' },
  { v: 'periodo', label: 'Por período', sufixo: '/ período', hint: 'Valor fechado do evento, independente da duração.' },
  { v: 'hora', label: 'Por hora', sufixo: '/ hora', hint: 'Multiplica pelas horas locadas.' },
  { v: 'pessoa', label: 'Por pessoa', sufixo: '/ convidado', hint: 'Multiplica pelo nº de convidados (open bar, buffet…).' },
  { v: 'pacote', label: 'Pacote fechado', sufixo: '/ pacote', hint: 'Combo com preço único (use a aba Pacotes).' },
]
export const BASE_BY = Object.fromEntries(BASES.map((b) => [b.v, b])) as Record<Base, (typeof BASES)[number]>
export function unidadeLabel(base: Base): string {
  return { diaria: 'diária', periodo: 'período', hora: 'hora', pessoa: 'convidado', pacote: 'pacote' }[base]
}

// ── Tipos de regra dinâmica ───────────────────────────────────────────────────
export const REGRA_TIPOS: { v: RegraTipo; label: string; icon: string; hint: string }[] = [
  { v: 'temporada', label: 'Temporada', icon: '🗓️', hint: 'Alta/baixa por faixa de datas (ex.: dez–fev).' },
  { v: 'dia_semana', label: 'Dia da semana', icon: '📅', hint: 'Fim de semana, sexta à noite…' },
  { v: 'feriado', label: 'Feriado', icon: '🎉', hint: 'Datas específicas com tarifa diferenciada.' },
  { v: 'tipo_evento', label: 'Tipo de evento', icon: '🏷️', hint: 'Corporativo paga mais, social menos…' },
  { v: 'antecedencia', label: 'Antecedência', icon: '⏳', hint: 'Last-minute ou reserva planejada.' },
  { v: 'duracao', label: 'Duração', icon: '⏱️', hint: 'Faixas por nº de horas.' },
  { v: 'qtd_convidados', label: 'Nº de convidados', icon: '👥', hint: 'Faixas por tamanho do evento.' },
]
export const REGRA_TIPO_BY = Object.fromEntries(REGRA_TIPOS.map((r) => [r.v, r])) as Record<RegraTipo, (typeof REGRA_TIPOS)[number]>

export const AJUSTES: { v: AjusteTipo; label: string; hint: string }[] = [
  { v: 'percentual', label: 'Percentual (%)', hint: 'Acresce/desconta uma % sobre o valor corrente.' },
  { v: 'fixo', label: 'Valor fixo', hint: 'Soma/subtrai um valor fixo.' },
  { v: 'substitui', label: 'Substitui o preço', hint: 'Define um preço fixo (a maior prioridade vence).' },
]

export const TAXAS_TIPOS: { v: TaxaTipo; label: string; sufixo: string }[] = [
  { v: 'fixo', label: 'Valor fixo', sufixo: '' },
  { v: 'percentual', label: 'Percentual do subtotal', sufixo: '%' },
  { v: 'por_pessoa', label: 'Por convidado', sufixo: '/ convidado' },
  { v: 'por_hora', label: 'Por hora', sufixo: '/ hora' },
]
export const TAXA_TIPO_BY = Object.fromEntries(TAXAS_TIPOS.map((t) => [t.v, t])) as Record<TaxaTipo, (typeof TAXAS_TIPOS)[number]>

// Sugestões de catálogo (chips de criação rápida).
export const TAXAS_SUGESTOES = ['Limpeza', 'Segurança', 'Energia', 'Caução', 'Taxa de som', 'Hora extra', 'Gerador', 'Brigadista']
export const TIPOS_EVENTO = ['Casamento', 'Aniversário', 'Formatura', 'Corporativo', 'Confraternização', 'Debutante', 'Show', 'Feira', 'Outro']
export const DIAS_SEMANA = [
  { v: 0, curto: 'Dom', label: 'Domingo' },
  { v: 1, curto: 'Seg', label: 'Segunda' },
  { v: 2, curto: 'Ter', label: 'Terça' },
  { v: 3, curto: 'Qua', label: 'Quarta' },
  { v: 4, curto: 'Qui', label: 'Quinta' },
  { v: 5, curto: 'Sex', label: 'Sexta' },
  { v: 6, curto: 'Sáb', label: 'Sábado' },
]
export const MESES_PT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

// ── Descritores legíveis (para listar regras sem abrir o modal) ───────────────
/** Descreve o ajuste de uma regra: "+30%", "−R$ 200", "= R$ 2.000". */
export function descreveAjuste(ajuste_tipo: AjusteTipo, valor: number, moeda: Currency): string {
  if (ajuste_tipo === 'percentual') {
    const s = valor >= 0 ? '+' : '−'
    return s + formatPercent(Math.abs(valor) / 100, { maximumFractionDigits: 1 })
  }
  if (ajuste_tipo === 'substitui') return '= ' + formatMoney(valor, { currency: moeda })
  const s = valor >= 0 ? '+' : '−'
  return s + ' ' + formatMoney(Math.abs(valor), { currency: moeda })
}

const ddmm = (s?: string) => {
  if (!s) return '—'
  const p = s.length >= 5 ? s.slice(-5).split('-') : []
  return p.length === 2 ? `${p[1]}/${p[0]}` : s
}

/** Descreve a condição de uma regra em uma linha curta em PT. */
export function descreveCondicao(r: Pick<PrecoRegra, 'tipo' | 'condicao'>): string {
  const c: Condicao = r.condicao || {}
  switch (r.tipo) {
    case 'temporada':
      return `${ddmm(c.de)} → ${ddmm(c.ate)}`
    case 'dia_semana':
      return (c.dias || []).map((d) => DIAS_SEMANA[d]?.curto).filter(Boolean).join(', ') || 'nenhum dia'
    case 'feriado':
      return `${(c.datas || []).length} data(s)`
    case 'tipo_evento':
      return (c.tipos || []).join(', ') || 'nenhum tipo'
    case 'antecedencia':
      return `${c.operador === 'menos' ? 'até' : 'a partir de'} ${c.dias_ant ?? 0} dias`
    case 'duracao':
      return `${c.operador === 'menos' ? 'até' : 'a partir de'} ${c.horas ?? 0}h`
    case 'qtd_convidados':
      return c.min != null && c.max != null
        ? `${c.min}–${c.max} convidados`
        : c.min != null
          ? `≥ ${c.min} convidados`
          : c.max != null
            ? `≤ ${c.max} convidados`
            : 'qualquer nº'
    default:
      return ''
  }
}

/** Condição inicial coerente ao trocar o tipo de regra no formulário. */
export function condicaoPadrao(tipo: RegraTipo): Condicao {
  switch (tipo) {
    case 'temporada':
      return { de: '12-15', ate: '02-28' }
    case 'dia_semana':
      return { dias: [5, 6] }
    case 'feriado':
      return { datas: [] }
    case 'tipo_evento':
      return { tipos: [] }
    case 'antecedencia':
      return { operador: 'menos', dias_ant: 15 }
    case 'duracao':
      return { operador: 'mais', horas: 8 }
    case 'qtd_convidados':
      return { min: 100, max: null }
    default:
      return {}
  }
}

export function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Classe de input reutilizada (espelha o design system do contexto-base).
export const inp =
  'w-full rounded-xl border border-black/10 px-3.5 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20'
