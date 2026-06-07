// Motor de precificação PURO e reutilizável da Ventsy.
// ─────────────────────────────────────────────────────────────────────────────
// Esta é a ÚNICA fonte de verdade do cálculo de preço de uma locação. É
// consumida por:
//   • /painel/precificacao (gestão das tabelas + Simulador)
//   • /painel/propostas    (orçamento — MESMA engine, critério de aceite)
//   • /painel/reservas      (valor estimado de um slot)
//   • o anúncio público     (preço "a partir de")
//
// Regras de ouro:
//   • SEM React, SEM Supabase, SEM "R$"/Intl aqui — só números crus. Toda a
//     formatação fica em lib/format, chamada por quem consome o Breakdown.
//   • Determinístico e testável: nada de Date.now() interno — a "data de hoje"
//     (para regras de antecedência) entra por `req.hoje`.
//
// Fluxo do cálculo:
//   base (valor unitário × quantidade)
//     → aplica regras dinâmicas por prioridade (substitui → percentual/fixo)
//     → soma taxas (obrigatórias + adicionais escolhidas)
//     → total, com breakdown transparente de cada linha.

import type { Currency } from '@/lib/format'

// ── Vocabulário do domínio ───────────────────────────────────────────────────
/** Unidade de cobrança da tabela base. */
export type Base = 'diaria' | 'periodo' | 'hora' | 'pessoa' | 'pacote'
/** Como uma regra altera o preço corrente. */
export type AjusteTipo = 'percentual' | 'fixo' | 'substitui'
/** Dimensão sobre a qual uma regra dinâmica decide. */
export type RegraTipo =
  | 'temporada'
  | 'dia_semana'
  | 'feriado'
  | 'tipo_evento'
  | 'antecedencia'
  | 'duracao'
  | 'qtd_convidados'
/** Como uma taxa/adicional é cobrada. */
export type TaxaTipo = 'fixo' | 'percentual' | 'por_pessoa' | 'por_hora'

// ── Entidades persistidas (espelham docs/sql/precificacao.sql) ───────────────
export type PrecoTabela = {
  id: string
  usuario_id: string
  propriedade_id: number | null
  espaco_id: number | null
  nome: string
  base: Base
  valor_base_num: number
  moeda: Currency
  custo_num: number | null         // custo de referência do dono (p/ margem no Simulador)
  concorrencia_num: number | null  // preço de referência da concorrência (manual)
  ativo: boolean
  criado_em?: string
  atualizado_em?: string
}

/**
 * Condição de uma regra (jsonb). Cada `RegraTipo` usa um subconjunto:
 *   temporada       → { de, ate }            datas 'MM-DD' (anual) ou 'YYYY-MM-DD'
 *   dia_semana      → { dias: number[] }     0=Dom … 6=Sáb
 *   feriado         → { datas: string[] }    ['MM-DD' | 'YYYY-MM-DD']
 *   tipo_evento     → { tipos: string[] }    ex.: ['Corporativo']
 *   antecedencia    → { operador, dias_ant } 'menos' = última hora, 'mais' = planejado
 *   duracao         → { operador, horas }
 *   qtd_convidados  → { min?, max? }
 */
export type Condicao = {
  de?: string
  ate?: string
  dias?: number[]
  datas?: string[]
  tipos?: string[]
  operador?: 'menos' | 'mais'
  dias_ant?: number
  horas?: number
  min?: number | null
  max?: number | null
}

export type PrecoRegra = {
  id: string
  usuario_id?: string
  tabela_id: string
  nome: string | null
  tipo: RegraTipo
  condicao: Condicao
  ajuste_tipo: AjusteTipo
  ajuste_valor: number
  prioridade: number
  ativo: boolean
}

export type Taxa = {
  id: string
  usuario_id?: string
  propriedade_id: number | null
  nome: string
  tipo: TaxaTipo
  valor: number
  obrigatoria: boolean
  reembolsavel: boolean
  ativo?: boolean
}

// ── Entrada do cálculo (o "pedido") ──────────────────────────────────────────
export type QuoteRequest = {
  data?: string            // início do evento (YYYY-MM-DD)
  dataFim?: string         // fim (YYYY-MM-DD) — usado p/ nº de diárias
  convidados?: number
  horas?: number
  dias?: number            // sobrepõe o cálculo data→dataFim, se informado
  tipoEvento?: string
  hoje?: string            // referência p/ regras de antecedência (YYYY-MM-DD)
  taxasSelecionadas?: string[] // ids das taxas NÃO obrigatórias a incluir
}

// ── Saída do cálculo (o "breakdown") ─────────────────────────────────────────
export type AjusteAplicado = {
  id: string
  nome: string
  tipo: RegraTipo
  ajuste_tipo: AjusteTipo
  ajuste_valor: number
  delta: number            // efeito (com sinal) sobre o preço corrente
}
export type TaxaAplicada = {
  id: string
  nome: string
  tipo: TaxaTipo
  valor: number
  obrigatoria: boolean
  total: number            // valor já calculado em moeda
}
export type Breakdown = {
  moeda: Currency
  unitario: number         // valor_base_num
  quantidade: number
  unidade: Base            // unidade da base (a UI traduz p/ i18n)
  base: number             // unitario × quantidade (antes das regras)
  ajustes: AjusteAplicado[]
  subtotal: number         // base + Σ ajustes (nunca negativo)
  taxas: TaxaAplicada[]
  totalTaxas: number
  total: number            // subtotal + totalTaxas
}

// ── Helpers de data (puros, agnósticos de fuso) ──────────────────────────────
const num = (v: unknown): number => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}
/** Ancora 'YYYY-MM-DD' ao meio-dia local (evita off-by-one por UTC). */
function parseYMD(s?: string | null): Date | null {
  if (!s) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s)
  if (!m) return null
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0, 0)
}
function mmdd(d: Date): string {
  return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
/** Diferença em dias (b − a), arredondada. Positivo se b é depois de a. */
function diasDelta(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86_400_000)
}
/** Nº de diárias de um intervalo (inclusivo): 1 dia = 1, fim de semana = 2, … */
export function numeroDeDiarias(data?: string, dataFim?: string): number {
  const a = parseYMD(data)
  const b = parseYMD(dataFim)
  if (!a) return 1
  if (!b) return 1
  return Math.max(1, diasDelta(a, b) + 1)
}
/**
 * `alvo` (MM-DD do evento) está dentro de [de, ate]? Aceita tanto datas anuais
 * 'MM-DD' quanto absolutas 'YYYY-MM-DD' (reduzidas a MM-DD), e trata a virada de
 * ano (ex.: alta temporada 12-15 → 02-28).
 */
function dentroIntervalo(alvo: string, de?: string, ate?: string): boolean {
  const norm = (s?: string) => (s && s.length >= 5 ? s.slice(-5) : s) // pega 'MM-DD'
  const d = norm(de)
  const a = norm(ate)
  if (!d || !a) return false
  if (d <= a) return alvo >= d && alvo <= a        // intervalo normal no mesmo ano
  return alvo >= d || alvo <= a                    // intervalo que vira o ano
}

// ── Quantidade conforme a unidade da base ────────────────────────────────────
function quantidadeDe(base: Base, req: QuoteRequest): number {
  switch (base) {
    case 'diaria':
      return Math.max(1, req.dias ?? numeroDeDiarias(req.data, req.dataFim))
    case 'hora':
      return Math.max(1, num(req.horas) || 1)
    case 'pessoa':
      return Math.max(1, num(req.convidados) || 1)
    case 'periodo':
    case 'pacote':
    default:
      return 1
  }
}

// ── Uma regra casa com o pedido? ─────────────────────────────────────────────
export function regraCasa(regra: PrecoRegra, req: QuoteRequest): boolean {
  if (regra.ativo === false) return false
  const c = regra.condicao || {}
  const d = parseYMD(req.data)
  switch (regra.tipo) {
    case 'temporada':
      return !!d && dentroIntervalo(mmdd(d), c.de, c.ate)
    case 'dia_semana':
      return !!d && Array.isArray(c.dias) && c.dias.includes(d.getDay())
    case 'feriado': {
      if (!d || !Array.isArray(c.datas)) return false
      const md = mmdd(d)
      return c.datas.some((x) => x === md || x === req.data || (x.length >= 5 && x.slice(-5) === md))
    }
    case 'tipo_evento': {
      if (!req.tipoEvento || !Array.isArray(c.tipos)) return false
      const alvo = req.tipoEvento.trim().toLowerCase()
      return c.tipos.some((t) => t.trim().toLowerCase() === alvo)
    }
    case 'antecedencia': {
      const hoje = parseYMD(req.hoje)
      if (!d || !hoje || c.dias_ant == null) return false
      const ant = Math.max(0, diasDelta(hoje, d)) // dias entre hoje e o evento
      return c.operador === 'menos' ? ant <= c.dias_ant : ant >= c.dias_ant
    }
    case 'duracao': {
      if (c.horas == null) return false
      const h = num(req.horas)
      return c.operador === 'menos' ? h <= c.horas : h >= c.horas
    }
    case 'qtd_convidados': {
      const g = num(req.convidados)
      if (g <= 0) return false
      if (c.min != null && g < c.min) return false
      if (c.max != null && g > c.max) return false
      return c.min != null || c.max != null
    }
    default:
      return false
  }
}

// Maior prioridade primeiro; empate → ordem estável por id.
function porPrioridade(a: PrecoRegra, b: PrecoRegra): number {
  return b.prioridade - a.prioridade || String(a.id).localeCompare(String(b.id))
}

const mapAjuste = (r: PrecoRegra, delta: number): AjusteAplicado => ({
  id: r.id,
  nome: r.nome || tituloPadraoRegra(r),
  tipo: r.tipo,
  ajuste_tipo: r.ajuste_tipo,
  ajuste_valor: num(r.ajuste_valor),
  delta,
})

/** Rótulo neutro de uma regra sem nome (a UI pode i18n-izar). */
export function tituloPadraoRegra(r: Pick<PrecoRegra, 'tipo'>): string {
  return {
    temporada: 'Temporada',
    dia_semana: 'Dia da semana',
    feriado: 'Feriado',
    tipo_evento: 'Tipo de evento',
    antecedencia: 'Antecedência',
    duracao: 'Duração',
    qtd_convidados: 'Nº de convidados',
  }[r.tipo]
}

// ── CÁLCULO PRINCIPAL ────────────────────────────────────────────────────────
/**
 * Calcula o preço de uma locação a partir de uma tabela base, suas regras
 * dinâmicas e o catálogo de taxas, para um pedido específico.
 *
 * Semântica das regras (transparente e previsível):
 *   1. Só entram regras ATIVAS cuja condição casa com o pedido.
 *   2. `substitui` — a de MAIOR prioridade vira o novo preço base (as demais
 *      `substitui` são ignoradas). Pense "tarifa fixa de feriado".
 *   3. `percentual`/`fixo` — empilham sobre o valor corrente, em ordem de
 *      prioridade (maior primeiro). Percentual incide sobre o valor corrente.
 *   4. Taxas: todas as obrigatórias + as adicionais escolhidas em
 *      `req.taxasSelecionadas`. Percentual de taxa incide sobre o subtotal.
 */
export function calcularPreco(args: {
  tabela: Pick<PrecoTabela, 'base' | 'valor_base_num' | 'moeda'>
  regras?: PrecoRegra[]
  taxas?: Taxa[]
  req: QuoteRequest
}): Breakdown {
  const { tabela, regras = [], taxas = [], req } = args
  const moeda = tabela.moeda
  const unitario = num(tabela.valor_base_num)
  const quantidade = quantidadeDe(tabela.base, req)
  const base = unitario * quantidade

  const casadas = regras.filter((r) => regraCasa(r, req))
  const substituis = casadas.filter((r) => r.ajuste_tipo === 'substitui').sort(porPrioridade)
  const incrementais = casadas.filter((r) => r.ajuste_tipo !== 'substitui').sort(porPrioridade)

  const ajustes: AjusteAplicado[] = []
  let corrente = base

  if (substituis[0]) {
    const r = substituis[0]
    const novo = num(r.ajuste_valor)
    ajustes.push(mapAjuste(r, novo - corrente))
    corrente = novo
  }
  for (const r of incrementais) {
    const v = num(r.ajuste_valor)
    const delta = r.ajuste_tipo === 'percentual' ? corrente * (v / 100) : v
    ajustes.push(mapAjuste(r, delta))
    corrente += delta
  }

  const subtotal = Math.max(0, corrente)

  // ── Taxas ──
  const obrig = taxas.filter((t) => t.ativo !== false && t.obrigatoria)
  const sel = taxas.filter(
    (t) => t.ativo !== false && !t.obrigatoria && (req.taxasSelecionadas?.includes(t.id) ?? false),
  )
  const taxasAplicadas: TaxaAplicada[] = [...obrig, ...sel].map((t) => {
    const v = num(t.valor)
    let total = 0
    if (t.tipo === 'fixo') total = v
    else if (t.tipo === 'percentual') total = subtotal * (v / 100)
    else if (t.tipo === 'por_pessoa') total = v * num(req.convidados)
    else if (t.tipo === 'por_hora') total = v * num(req.horas)
    return { id: t.id, nome: t.nome, tipo: t.tipo, valor: v, obrigatoria: t.obrigatoria, total }
  })
  const totalTaxas = taxasAplicadas.reduce((s, t) => s + t.total, 0)

  return {
    moeda,
    unitario,
    quantidade,
    unidade: tabela.base,
    base,
    ajustes,
    subtotal,
    taxas: taxasAplicadas,
    totalTaxas,
    total: subtotal + totalTaxas,
  }
}

/**
 * Preço "cheio" (base + ajustes, sem taxas) de um único dia — usado pelo
 * calendário de tarifas para colorir alta/baixa temporada. Quantidade neutra
 * (1 unidade), só as regras dependentes de data entram em jogo.
 */
export function precoDoDia(
  tabela: Pick<PrecoTabela, 'base' | 'valor_base_num' | 'moeda'>,
  regras: PrecoRegra[],
  dia: string,
  hoje?: string,
): number {
  return calcularPreco({ tabela, regras, taxas: [], req: { data: dia, dias: 1, hoje } }).subtotal
}

/** Margem (0–1) de um total sobre um custo de referência; null se sem custo. */
export function margem(total: number, custo: number | null | undefined): number | null {
  if (custo == null || total <= 0) return null
  return (total - custo) / total
}
