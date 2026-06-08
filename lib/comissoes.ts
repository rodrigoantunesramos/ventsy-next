// Motor PURO de comissões da Ventsy.
// ─────────────────────────────────────────────────────────────────────────────
// Fonte única de verdade para: casar a regra de comissão correta com um evento,
// calcular o valor (base × % ou valor fixo), detectar quando o evento foi
// "recebido", e PLANEJAR a apuração (o que criar / atualizar / cancelar) a
// partir das atribuições de cada evento (quem vendeu / trouxe / indicou).
// É consumida por:
//   • /painel/comissoes              (preview + aplicar apuração via RLS)
//   • /api/cron/apurar-comissoes      (apuração automática + estorno, service-role)
//
// Regras de ouro (espelham lib/pricing.ts e lib/reservas.ts):
//   • SEM React, SEM Supabase, SEM "R$"/Intl aqui — só dados crus. A formatação
//     fica em lib/format, chamada por quem consome.
//   • Determinístico e testável: o "agora" entra por parâmetro (nowMs). Nada de
//     relógio escondido na lógica.

// ── Vocabulário do domínio ───────────────────────────────────────────────────
export type BeneficiarioTipo = 'equipe' | 'parceiro' | 'cliente'
export type BaseCalculo = 'valor_evento' | 'margem' | 'fixo'
export type ComissaoStatus = 'prevista' | 'apurada' | 'aprovada' | 'paga' | 'cancelada'

/** Condições que estreitam a aplicação de uma regra (todas opcionais). */
export type CondicaoRegra = {
  tipo_evento?: string | null   // só este tipo de evento (ex.: "Casamento")
  propriedade_id?: number | null // só esta propriedade
  faixa_min?: number | null      // valor do evento >= faixa_min
  faixa_max?: number | null      // valor do evento <= faixa_max
  margem_pct?: number | null     // p/ base 'margem': % do valor tratado como margem (0–100)
}

/** Regra de comissão (espelha public.comissoes_regras). */
export type Regra = {
  id: string
  nome?: string | null
  beneficiario_tipo: BeneficiarioTipo
  beneficiario_id: string | null // null = qualquer beneficiário desse tipo
  base: BaseCalculo
  percentual: number | null      // % humano (3 = 3%)
  valor_fixo_num: number | null
  condicao: CondicaoRegra
  vigencia_inicio: string | null // YYYY-MM-DD
  vigencia_fim: string | null    // YYYY-MM-DD
  prioridade: number
  ativo: boolean
}

/** Evento comissionável (subconjunto de clientes_eventos + atribuições). */
export type EventoComissionavel = {
  id: string
  tipo_evento: string | null
  status: string | null
  data_inicio: string | null
  valor_total_num: number | null
  propriedade_id: number | null
  vendedor_equipe_id: number | null
  parceiro_id: string | null
  indicado_por_id: string | null
}

/** Parcela na ótica da apuração (recebido = soma das pagas do evento). */
export type ParcelaLite = { evento_id: string; valor: number; status: string }

/** Comissão já persistida (subconjunto usado pelo planner). */
export type ComissaoExistente = {
  id: string
  beneficiario_tipo: BeneficiarioTipo
  beneficiario_id: string | null
  evento_id: string | null
  valor_num: number
  status: ComissaoStatus
  origem: string // 'auto' | 'manual'
}

/** Comissão nova a inserir (proposta pelo planner). */
export type NovaComissao = {
  regra_id: string | null
  beneficiario_tipo: BeneficiarioTipo
  beneficiario_id: string
  evento_id: string
  base_num: number
  percentual: number | null
  valor_num: number
  status: Extract<ComissaoStatus, 'prevista' | 'apurada'>
  competencia: string // YYYY-MM-01
}

/** Atualização de comissão existente (status e/ou valores). */
export type AtualizacaoComissao = {
  id: string
  status?: ComissaoStatus
  valor_num?: number
  base_num?: number
  percentual?: number | null
}

export type PlanoApuracao = {
  inserir: NovaComissao[]
  atualizar: AtualizacaoComissao[]
}

// ── Constantes de UI/domínio ─────────────────────────────────────────────────
export const TIPOS_BENEFICIARIO: { v: BeneficiarioTipo; label: string; plural: string }[] = [
  { v: 'equipe', label: 'Vendedor', plural: 'Vendedores' },
  { v: 'parceiro', label: 'Parceiro', plural: 'Parceiros' },
  { v: 'cliente', label: 'Indicação', plural: 'Indicações' },
]

export const TIPOS_PARCEIRO: { v: string; label: string }[] = [
  { v: 'cerimonial', label: 'Cerimonialista / Assessoria' },
  { v: 'agencia', label: 'Agência' },
  { v: 'promotor', label: 'Promotor / Captador' },
  { v: 'afiliado', label: 'Afiliado' },
  { v: 'outro', label: 'Outro' },
]

export const BASES: { v: BaseCalculo; label: string; hint: string }[] = [
  { v: 'valor_evento', label: '% do valor do evento', hint: 'percentual sobre o valor contratado' },
  { v: 'margem', label: '% da margem', hint: 'percentual sobre a margem estimada do evento' },
  { v: 'fixo', label: 'Valor fixo', hint: 'valor fixo por evento fechado' },
]

export const STATUS_COMISSAO: { v: ComissaoStatus; label: string }[] = [
  { v: 'prevista', label: 'Prevista' },
  { v: 'apurada', label: 'Apurada' },
  { v: 'aprovada', label: 'Aprovada' },
  { v: 'paga', label: 'Paga' },
  { v: 'cancelada', label: 'Cancelada' },
]

/** Margem padrão (% do valor do evento) quando a regra de base 'margem' não a define. */
export const MARGEM_PADRAO_PCT = 30

// ── Mapa de funil (espelha o CRM de Leads / o cockpit financeiro) ─────────────
export type GrupoFunil = 'negociando' | 'contratados' | 'finalizados' | 'perdidos'
export const GRUPO_DE: Record<string, GrupoFunil> = {
  lead: 'negociando', consultada: 'negociando', visita: 'negociando', negociacao: 'negociando', reserva: 'negociando',
  contratado: 'contratados', briefing: 'contratados', pronto: 'contratados', montagem: 'contratados',
  finalizado: 'finalizados', pos: 'finalizados',
  perdido: 'perdidos', recontactar: 'perdidos', cancelado: 'perdidos',
}
/** Status que disparam estorno (cancelamento) de comissões não pagas. */
export const ESTORNO_STATUS = new Set(['perdido', 'cancelado'])

export function grupoEvento(status: string | null | undefined): GrupoFunil {
  return GRUPO_DE[(status || 'lead').toLowerCase()] || 'negociando'
}
/** Evento "fechado" = gera comissão (contratado ou finalizado). */
export function eventoFechado(status: string | null | undefined): boolean {
  const g = grupoEvento(status)
  return g === 'contratados' || g === 'finalizados'
}
export function eventoEstornavel(status: string | null | undefined): boolean {
  return ESTORNO_STATUS.has((status || '').toLowerCase())
}

// ── Helpers numéricos/datas (crus — nada de Intl) ─────────────────────────────
export function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
/** Arredonda para centavos (evita 0.1+0.2 ruído). */
export function round2(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100
}
/** 1º dia do mês (YYYY-MM-01) de uma data só-data; cai para `nowMs` se ausente. */
export function competenciaDe(dataInicio: string | null | undefined, nowMs: number): string {
  const s = (dataInicio || '').slice(0, 7)
  if (/^\d{4}-\d{2}$/.test(s)) return `${s}-01`
  const d = new Date(nowMs)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

// ── Casamento de regra com evento/beneficiário ────────────────────────────────
/** A regra está vigente na data de referência (YYYY-MM-DD)? */
export function regraVigente(regra: Regra, dataRef: string): boolean {
  if (regra.vigencia_inicio && dataRef < regra.vigencia_inicio) return false
  if (regra.vigencia_fim && dataRef > regra.vigencia_fim) return false
  return true
}

/** A regra aplica-se a este evento, para este beneficiário? */
export function regraAplica(
  regra: Regra,
  tipo: BeneficiarioTipo,
  beneficiarioId: string,
  ev: EventoComissionavel,
  dataRef: string,
): boolean {
  if (!regra.ativo) return false
  if (regra.beneficiario_tipo !== tipo) return false
  // beneficiario_id null = genérica (todos do tipo); senão precisa bater.
  if (regra.beneficiario_id != null && regra.beneficiario_id !== beneficiarioId) return false
  if (!regraVigente(regra, dataRef)) return false
  const c = regra.condicao || {}
  if (c.tipo_evento && (ev.tipo_evento || '') !== c.tipo_evento) return false
  if (c.propriedade_id != null && Number(ev.propriedade_id) !== Number(c.propriedade_id)) return false
  const valor = Number(ev.valor_total_num) || 0
  if (c.faixa_min != null && valor < Number(c.faixa_min)) return false
  if (c.faixa_max != null && valor > Number(c.faixa_max)) return false
  return true
}

/** Especificidade da regra: mais específica vence empates de prioridade. */
function especificidade(regra: Regra): number {
  let s = 0
  if (regra.beneficiario_id != null) s += 8
  const c = regra.condicao || {}
  if (c.tipo_evento) s += 4
  if (c.propriedade_id != null) s += 2
  if (c.faixa_min != null || c.faixa_max != null) s += 1
  return s
}

/** Escolhe a melhor regra aplicável (prioridade → especificidade → maior valor). */
export function escolherRegra(
  regras: Regra[],
  tipo: BeneficiarioTipo,
  beneficiarioId: string,
  ev: EventoComissionavel,
  dataRef: string,
): Regra | null {
  const aplicaveis = regras.filter((r) => regraAplica(r, tipo, beneficiarioId, ev, dataRef))
  if (!aplicaveis.length) return null
  return aplicaveis.sort((a, b) => {
    if (b.prioridade !== a.prioridade) return b.prioridade - a.prioridade
    const ea = especificidade(a), eb = especificidade(b)
    if (eb !== ea) return eb - ea
    return valorPotencial(b, ev) - valorPotencial(a, ev)
  })[0]
}

// ── Base e valor da comissão ─────────────────────────────────────────────────
/** Base de cálculo (valor sobre o qual o % incide). 'fixo' não usa base. */
export function baseDoEvento(ev: EventoComissionavel, regra: Regra): number {
  const valor = Number(ev.valor_total_num) || 0
  if (regra.base === 'fixo') return 0
  if (regra.base === 'margem') {
    const pct = regra.condicao?.margem_pct != null ? Number(regra.condicao.margem_pct) : MARGEM_PADRAO_PCT
    return round2(valor * (pct / 100))
  }
  return valor // valor_evento
}

/** Valor da comissão dada a regra e a base. */
export function calcularValor(regra: Regra, baseNum: number): number {
  if (regra.base === 'fixo') return round2(Number(regra.valor_fixo_num) || 0)
  const pct = Number(regra.percentual) || 0
  return round2(baseNum * (pct / 100))
}

/** Atalho: valor potencial de uma regra para um evento (para desempate). */
function valorPotencial(regra: Regra, ev: EventoComissionavel): number {
  return calcularValor(regra, baseDoEvento(ev, regra))
}

// ── Recebimento do evento (prevista → apurada) ────────────────────────────────
export function recebidoDoEvento(eventoId: string, parcelas: ParcelaLite[]): number {
  return round2(
    parcelas
      .filter((p) => p.evento_id === eventoId && p.status === 'pago')
      .reduce((s, p) => s + (Number(p.valor) || 0), 0),
  )
}

/** O evento já pode ser apurado? (recebido o suficiente OU evento finalizado). */
export function eventoApuravel(ev: EventoComissionavel, parcelas: ParcelaLite[]): boolean {
  const contratado = Number(ev.valor_total_num) || 0
  const recebido = recebidoDoEvento(ev.id, parcelas)
  if (contratado > 0 && recebido + 0.01 >= contratado) return true
  // Sem parcelas registradas mas evento já finalizado: considera apurável.
  return grupoEvento(ev.status) === 'finalizados'
}

// ── Atribuições do evento ─────────────────────────────────────────────────────
/** Lista as atribuições presentes no evento como pares (tipo, beneficiarioId). */
export function atribuicoesDoEvento(ev: EventoComissionavel): { tipo: BeneficiarioTipo; id: string }[] {
  const out: { tipo: BeneficiarioTipo; id: string }[] = []
  if (ev.vendedor_equipe_id != null) out.push({ tipo: 'equipe', id: String(ev.vendedor_equipe_id) })
  if (ev.parceiro_id) out.push({ tipo: 'parceiro', id: String(ev.parceiro_id) })
  if (ev.indicado_por_id) out.push({ tipo: 'cliente', id: String(ev.indicado_por_id) })
  return out
}

function chave(eventoId: string, tipo: BeneficiarioTipo, beneficiarioId: string | null): string {
  return `${eventoId}|${tipo}|${beneficiarioId ?? ''}`
}

// ── Planner de apuração (coração do módulo) ───────────────────────────────────
// Compara o que as regras + atribuições IMPLICAM com o que está persistido e
// devolve o diff a aplicar. Só gerencia comissões de origem 'auto' e nos status
// {prevista, apurada}; nunca mexe em manual/aprovada/paga (exceto cancelar uma
// 'aprovada' quando o evento é estornado).
export function planejarApuracao(input: {
  eventos: EventoComissionavel[]
  parcelas: ParcelaLite[]
  regras: Regra[]
  existentes: ComissaoExistente[]
  nowMs: number
}): PlanoApuracao {
  const { eventos, parcelas, regras, existentes, nowMs } = input
  const hoje = ymd(new Date(nowMs))

  // Index das comissões automáticas por chave evento|tipo|beneficiario.
  const autoPorChave = new Map<string, ComissaoExistente>()
  for (const c of existentes) {
    if (c.origem !== 'auto' || !c.evento_id) continue
    autoPorChave.set(chave(c.evento_id, c.beneficiario_tipo, c.beneficiario_id), c)
  }

  const inserir: NovaComissao[] = []
  const atualizar: AtualizacaoComissao[] = []
  const vistas = new Set<string>() // chaves cobertas pelas atribuições atuais

  for (const ev of eventos) {
    const estorno = eventoEstornavel(ev.status)
    const fechado = eventoFechado(ev.status)

    for (const at of atribuicoesDoEvento(ev)) {
      const k = chave(ev.id, at.tipo, at.id)
      vistas.add(k)
      const existente = autoPorChave.get(k)
      const regra = escolherRegra(regras, at.tipo, at.id, ev, hoje)

      // Não-pagável agora: estorno, regrediu para negociação, ou sem regra.
      if (estorno || !fechado || !regra) {
        if (existente && (existente.status === 'prevista' || existente.status === 'apurada')) {
          atualizar.push({ id: existente.id, status: 'cancelada' })
        } else if (existente && existente.status === 'aprovada' && estorno) {
          atualizar.push({ id: existente.id, status: 'cancelada' })
        }
        continue
      }

      const base_num = baseDoEvento(ev, regra)
      const valor_num = calcularValor(regra, base_num)
      const desejado: 'prevista' | 'apurada' = eventoApuravel(ev, parcelas) ? 'apurada' : 'prevista'

      if (existente) {
        // Só auto-gerencia prevista/apurada; aprovada/paga ficam intactas.
        if (existente.status === 'prevista' || existente.status === 'apurada') {
          const mudouStatus = existente.status !== desejado
          const mudouValor = round2(existente.valor_num) !== valor_num
          if (mudouStatus || mudouValor) {
            atualizar.push({ id: existente.id, status: desejado, valor_num, base_num, percentual: regra.percentual })
          }
        }
      } else {
        inserir.push({
          regra_id: regra.id,
          beneficiario_tipo: at.tipo,
          beneficiario_id: at.id,
          evento_id: ev.id,
          base_num,
          percentual: regra.base === 'fixo' ? null : regra.percentual,
          valor_num,
          status: desejado,
          competencia: competenciaDe(ev.data_inicio, nowMs),
        })
      }
    }
  }

  // Comissões automáticas órfãs (atribuição removida / evento sumiu): cancela
  // as que ainda estavam previstas/apuradas.
  for (const [k, c] of autoPorChave) {
    if (vistas.has(k)) continue
    if (c.status === 'prevista' || c.status === 'apurada') {
      atualizar.push({ id: c.id, status: 'cancelada' })
    }
  }

  return { inserir, atualizar }
}

// ── Agregações (números crus; formatação fica nas páginas) ────────────────────
export type ResumoStatus = Record<ComissaoStatus, number>

export function resumoPorStatus(comissoes: { status: ComissaoStatus; valor_num: number }[]): ResumoStatus {
  const r: ResumoStatus = { prevista: 0, apurada: 0, aprovada: 0, paga: 0, cancelada: 0 }
  for (const c of comissoes) r[c.status] = round2(r[c.status] + (Number(c.valor_num) || 0))
  return r
}

/** Comissões "em aberto" = previstas + apuradas + aprovadas (a pagar). */
export function totalAPagar(resumo: ResumoStatus): number {
  return round2(resumo.prevista + resumo.apurada + resumo.aprovada)
}

/** Custo de comissão sobre a receita (fração 0–1; receita 0 → 0). */
export function custoSobreReceita(comissaoPaga: number, receita: number): number {
  if (!receita || receita <= 0) return 0
  return (Number(comissaoPaga) || 0) / receita
}

/** Nome do beneficiário a partir de mapas id→nome (puro; usado no cron/server). */
export function nomeBeneficiarioServer(
  tipo: BeneficiarioTipo,
  id: string | null,
  maps: { equipe: Map<string, string>; parceiros: Map<string, string>; clientes: Map<string, string> },
): string {
  const fallback = TIPOS_BENEFICIARIO.find((t) => t.v === tipo)?.label || 'Beneficiário'
  if (!id) return fallback
  const m = tipo === 'equipe' ? maps.equipe : tipo === 'parceiro' ? maps.parceiros : maps.clientes
  return m.get(id) || fallback
}
