// Motor PURO de Expositores & Patrocínios da Ventsy.
// ─────────────────────────────────────────────────────────────────────────────
// Fonte única de verdade para monetizar feiras/expos/festivais com marcas:
//   • ESTANDES — venda/reserva/bloqueio, preço por ponto ou por m², mapa visual
//     (posição em grid), % do mapa comercializado (por contagem e por área).
//   • PATROCÍNIO — cotas (Master/Ouro/Prata/Bronze/Apoio) com entregáveis e
//     preço; pipeline de venda; CHECKLIST de entrega por patrocinador.
//   • RECEITA — estandes + patrocínio por evento, metas de comercialização.
//
// É consumida por:
//   • /painel/expositores  (mapa, expositores, patrocínio, receita)
//   • /api/expositores      (comercialização AUTORITATIVA do estande + receita
//                            no financeiro do evento, server-side)
//
// Regras de ouro (espelham lib/reservas.ts / lib/acesso.ts):
//   • SEM React, SEM Supabase, SEM "R$"/Intl aqui — só dados crus. A formatação
//     (moeda/percentual/data i18n) fica em lib/format, chamada por quem consome.
//   • Determinístico e testável: nada de relógio/aleatoriedade escondidos.

// Detecção de tabela ausente (degrade → setup-card).
export { isMissingTable } from '@/lib/dbErrors'

// ── Vocabulário do domínio ───────────────────────────────────────────────────
/** Estado comercial de um estande no mapa. */
export type EstandeStatus = 'disponivel' | 'reservado' | 'vendido' | 'bloqueado'
/** Tipo/posição do estande na planta (afeta valor e visual). */
export type EstandeTipo = 'standard' | 'esquina' | 'ilha' | 'ponta' | 'premium' | 'food' | 'patrocinio' | 'outro'
/** Estágio do expositor no funil comercial. */
export type ExpositorStatus = 'prospecto' | 'proposta' | 'confirmado' | 'faturado' | 'cancelado'
/** Estágio do patrocinador no funil comercial. */
export type PatrocinadorStatus = 'prospecto' | 'proposta' | 'confirmado' | 'faturado' | 'cancelado'

/** Posição/dimensão do estande no grid do mapa (unidades de célula). */
export type Posicao = { x: number; y: number; w: number; h: number }

/** Estande comercializável (espelha a tabela `expo_mapa`). */
export type Estande = {
  id: string
  usuario_id?: string
  evento_id: string | null
  codigo: string
  tipo: EstandeTipo | string
  area_m2: number | null
  preco_num: number | null            // preço fechado do ponto; null/0 = calcular por m²
  status: EstandeStatus | string
  expositor_id: string | null
  posicao: Partial<Posicao> | null
  cor: string | null
  obs?: string | null
  criado_em?: string
  atualizado_em?: string
}

/** Necessidades técnicas do expositor (viram tarefa de logística). */
export type Necessidades = {
  energia_kva?: number | null
  internet?: boolean
  agua?: boolean
  montagem?: boolean
  obs?: string | null
}

/** Expositor (espelha a tabela `expositores`). */
export type Expositor = {
  id: string
  usuario_id?: string
  evento_id: string | null
  empresa: string
  contato: string | null
  email: string | null
  telefone: string | null
  doc: string | null
  estande_id: string | null
  contrato_id: string | null
  credencial_id: string | null
  lancamento_id: string | null
  valor_num: number | null
  status: ExpositorStatus | string
  necessidades: Necessidades | null
  obs?: string | null
  criado_em?: string
  atualizado_em?: string
}

/** Um entregável da cota (contrapartida prometida à marca). */
export type Entregavel = { chave: string; nome: string; qtd?: number | null }
/** Estado de entrega de um entregável por patrocinador. */
export type EntregavelStatus = { entregue: boolean; data?: string | null; obs?: string | null }

/** Cota de patrocínio (espelha a tabela `patrocinio_cotas`). */
export type Cota = {
  id: string
  usuario_id?: string
  evento_id: string | null
  nome: string                         // 'Master' | 'Ouro' | ...
  preco_num: number | null
  quantidade: number | null            // vagas disponíveis (null = ilimitada)
  cor: string | null
  ordem: number
  entregaveis: Entregavel[]
  obs?: string | null
  criado_em?: string
  atualizado_em?: string
}

/** Patrocinador (espelha a tabela `patrocinadores`). */
export type Patrocinador = {
  id: string
  usuario_id?: string
  evento_id: string | null
  cota_id: string | null
  marca: string
  contato: string | null
  email: string | null
  telefone: string | null
  contrato_id: string | null
  lancamento_id: string | null
  valor_num: number | null
  status: PatrocinadorStatus | string
  entregaveis_status: Record<string, EntregavelStatus>
  obs?: string | null
  criado_em?: string
  atualizado_em?: string
}

// ── Metadados de status (rótulo PT + chip Tailwind + hex p/ SVG do mapa) ──────
// i18n: o `label` é o default PT; a UI pode reescrever via dicionário próprio.
export type StatusMeta = { label: string; chip: string; hex: string }

export const ESTANDE_STATUS_META: Record<string, StatusMeta> = {
  disponivel: { label: 'Disponível', chip: 'bg-emerald-100 text-emerald-700', hex: '#10b981' },
  reservado:  { label: 'Reservado',  chip: 'bg-amber-100 text-amber-700',     hex: '#f59e0b' },
  vendido:    { label: 'Vendido',    chip: 'bg-brand/10 text-brand',          hex: '#ff385c' },
  bloqueado:  { label: 'Bloqueado',  chip: 'bg-slate-200 text-slate-600',     hex: '#94a3b8' },
}
export function estandeStatusMeta(status: string): StatusMeta {
  return ESTANDE_STATUS_META[status] || { label: status, chip: 'bg-gray-100 text-gray-600', hex: '#9ca3af' }
}

export const EXPOSITOR_STATUS_META: Record<string, StatusMeta> = {
  prospecto:  { label: 'Prospecto',  chip: 'bg-slate-100 text-slate-600',     hex: '#64748b' },
  proposta:   { label: 'Proposta',   chip: 'bg-sky-100 text-sky-700',         hex: '#0284c7' },
  confirmado: { label: 'Confirmado', chip: 'bg-emerald-100 text-emerald-700', hex: '#10b981' },
  faturado:   { label: 'Faturado',   chip: 'bg-violet-100 text-violet-700',   hex: '#7c3aed' },
  cancelado:  { label: 'Cancelado',  chip: 'bg-gray-100 text-gray-500',       hex: '#9ca3af' },
}
export function expositorStatusMeta(status: string): StatusMeta {
  return EXPOSITOR_STATUS_META[status] || { label: status, chip: 'bg-gray-100 text-gray-600', hex: '#9ca3af' }
}
// Patrocinador compartilha o mesmo vocabulário de funil dos expositores.
export const PATROCINADOR_STATUS_META = EXPOSITOR_STATUS_META
export const patrocinadorStatusMeta = expositorStatusMeta

export const ESTANDE_TIPOS: { v: EstandeTipo; label: string }[] = [
  { v: 'standard', label: 'Standard' },
  { v: 'esquina', label: 'Esquina' },
  { v: 'ilha', label: 'Ilha' },
  { v: 'ponta', label: 'Ponta de corredor' },
  { v: 'premium', label: 'Premium' },
  { v: 'food', label: 'Praça de alimentação' },
  { v: 'patrocinio', label: 'Ativação/Patrocínio' },
  { v: 'outro', label: 'Outro' },
]
const ESTANDE_TIPO_MAP = Object.fromEntries(ESTANDE_TIPOS.map((t) => [t.v, t.label]))
export function estandeTipoLabel(tipo: string): string {
  return ESTANDE_TIPO_MAP[tipo] || tipo
}

/** Presets de cota (ponto de partida ao criar; editável). Hex p/ legenda/visual. */
export const COTA_PRESETS: { nome: string; cor: string; entregaveis: Entregavel[] }[] = [
  {
    nome: 'Master', cor: '#7c3aed',
    entregaveis: [
      { chave: 'logo_palco', nome: 'Logo no palco principal' },
      { chave: 'naming', nome: 'Naming rights do evento' },
      { chave: 'estande', nome: 'Estande premium', qtd: 1 },
      { chave: 'posts', nome: 'Posts nas redes', qtd: 8 },
      { chave: 'cortesias', nome: 'Cortesias / credenciais', qtd: 20 },
    ],
  },
  {
    nome: 'Ouro', cor: '#d97706',
    entregaveis: [
      { chave: 'logo_palco', nome: 'Logo no palco' },
      { chave: 'estande', nome: 'Estande', qtd: 1 },
      { chave: 'posts', nome: 'Posts nas redes', qtd: 4 },
      { chave: 'cortesias', nome: 'Cortesias', qtd: 10 },
    ],
  },
  {
    nome: 'Prata', cor: '#64748b',
    entregaveis: [
      { chave: 'logo_material', nome: 'Logo no material gráfico' },
      { chave: 'posts', nome: 'Posts nas redes', qtd: 2 },
      { chave: 'cortesias', nome: 'Cortesias', qtd: 4 },
    ],
  },
  {
    nome: 'Bronze', cor: '#b45309',
    entregaveis: [
      { chave: 'logo_material', nome: 'Logo no material gráfico' },
      { chave: 'cortesias', nome: 'Cortesias', qtd: 2 },
    ],
  },
  {
    nome: 'Apoio', cor: '#0d9488',
    entregaveis: [{ chave: 'logo_material', nome: 'Logo no material gráfico' }],
  },
]

// ── Coerção numérica defensiva ────────────────────────────────────────────────
const num = (v: unknown): number => {
  const x = Number(v)
  return Number.isFinite(x) ? x : 0
}

// ─────────────────────────────────────────────────────────────────────────────
// ESTANDES — preço, ocupação e mapa
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Preço de comercialização do estande. Se houver `preco_num` (> 0), ele manda;
 * senão, calcula `area_m2 × precoM2` (preço por metro quadrado da feira).
 */
export function precoEstande(e: Pick<Estande, 'preco_num' | 'area_m2'>, precoM2 = 0): number {
  const fechado = num(e.preco_num)
  if (fechado > 0) return fechado
  return num(e.area_m2) * Math.max(0, num(precoM2))
}

/** Um estande "ocupa" comercialmente o espaço (vendido ou reservado)? */
export function estandeOcupado(e: Pick<Estande, 'status'>): boolean {
  return e.status === 'vendido' || e.status === 'reservado'
}

export type MapaResumo = {
  total: number
  disponiveis: number
  reservados: number
  vendidos: number
  bloqueados: number
  areaTotal: number
  areaVendida: number
  /** Fração 0–1 de estandes vendidos sobre os COMERCIALIZÁVEIS (exclui bloqueados). */
  pctVendidoContagem: number
  /** Fração 0–1 de área vendida sobre a área comercializável. */
  pctVendidoArea: number
  /** Receita já realizada (vendidos). */
  receitaVendida: number
  /** Receita ainda em aberto (reservados — venda provável). */
  receitaReservada: number
  /** Receita potencial dos disponíveis (oportunidade no mapa). */
  receitaDisponivel: number
}

/** Resumo do mapa: contagem por status, área, % comercializado e receita. */
export function resumoMapa(estandes: Estande[], precoM2 = 0): MapaResumo {
  let disponiveis = 0, reservados = 0, vendidos = 0, bloqueados = 0
  let areaTotal = 0, areaVendida = 0
  let comercializaveis = 0, areaComercializavel = 0
  let receitaVendida = 0, receitaReservada = 0, receitaDisponivel = 0

  for (const e of estandes) {
    const area = num(e.area_m2)
    areaTotal += area
    const preco = precoEstande(e, precoM2)
    if (e.status === 'bloqueado') { bloqueados++; continue }
    comercializaveis++
    areaComercializavel += area
    if (e.status === 'vendido') {
      vendidos++; areaVendida += area; receitaVendida += preco
    } else if (e.status === 'reservado') {
      reservados++; receitaReservada += preco
    } else {
      disponiveis++; receitaDisponivel += preco
    }
  }

  return {
    total: estandes.length, disponiveis, reservados, vendidos, bloqueados,
    areaTotal, areaVendida,
    pctVendidoContagem: comercializaveis > 0 ? vendidos / comercializaveis : 0,
    pctVendidoArea: areaComercializavel > 0 ? areaVendida / areaComercializavel : 0,
    receitaVendida, receitaReservada, receitaDisponivel,
  }
}

// ── Transições de status do estande (máquina de estados comercial) ───────────
const TRANSICOES_ESTANDE: Record<EstandeStatus, EstandeStatus[]> = {
  disponivel: ['reservado', 'vendido', 'bloqueado'],
  reservado:  ['vendido', 'disponivel', 'bloqueado'],
  vendido:    ['disponivel', 'reservado', 'bloqueado'],
  bloqueado:  ['disponivel'],
}
/** A transição de status do estande é permitida? (Mesmo status sempre ok.) */
export function podeTransicionarEstande(de: string, para: string): boolean {
  if (de === para) return true
  const lista = TRANSICOES_ESTANDE[de as EstandeStatus]
  return !!lista && lista.includes(para as EstandeStatus)
}
/** Vender/reservar exige um expositor vinculado; liberar/bloquear, não. */
export function exigeExpositor(status: string): boolean {
  return status === 'vendido' || status === 'reservado'
}

// ── Mapa visual: posição em grid + auto-layout ───────────────────────────────
export const CELULA = 1   // unidade lógica de célula no grid

function posValida(p: Partial<Posicao> | null | undefined): p is Posicao {
  return !!p && Number.isFinite(Number(p.x)) && Number.isFinite(Number(p.y))
}

/** Normaliza a posição de um estande (x,y,w,h) com defaults seguros (w/h ≥ 1). */
export function normalizarPosicao(p: Partial<Posicao> | null | undefined): Posicao {
  return {
    x: Math.max(0, Math.round(num(p?.x))),
    y: Math.max(0, Math.round(num(p?.y))),
    w: Math.max(1, Math.round(num(p?.w) || 1)),
    h: Math.max(1, Math.round(num(p?.h) || 1)),
  }
}

export type Bounds = { cols: number; rows: number }
/**
 * Extensão do grid (colunas × linhas) que comporta todos os estandes
 * posicionados, com uma margem mínima. Usado p/ o viewBox do SVG.
 */
export function boundsDosEstandes(estandes: Estande[], minCols = 8, minRows = 6): Bounds {
  let maxX = 0, maxY = 0
  for (const e of estandes) {
    if (!posValida(e.posicao)) continue
    const p = normalizarPosicao(e.posicao)
    maxX = Math.max(maxX, p.x + p.w)
    maxY = Math.max(maxY, p.y + p.h)
  }
  return { cols: Math.max(minCols, maxX), rows: Math.max(minRows, maxY) }
}

/**
 * Atribui posições em grade aos estandes SEM posição (preserva os já
 * posicionados), preenchendo da esquerda p/ a direita em `cols` colunas. Pura:
 * retorna um novo array de {id, posicao} apenas para os que faltavam.
 */
export function autoLayout(estandes: Estande[], cols = 6): { id: string; posicao: Posicao }[] {
  const ocupadas = new Set<string>()
  for (const e of estandes) {
    if (!posValida(e.posicao)) continue
    const p = normalizarPosicao(e.posicao)
    for (let dx = 0; dx < p.w; dx++) for (let dy = 0; dy < p.h; dy++) ocupadas.add(`${p.x + dx},${p.y + dy}`)
  }
  const out: { id: string; posicao: Posicao }[] = []
  let cursor = 0
  for (const e of estandes) {
    if (posValida(e.posicao)) continue
    // acha a próxima célula livre na varredura row-major
    while (ocupadas.has(`${cursor % cols},${Math.floor(cursor / cols)}`)) cursor++
    const x = cursor % cols
    const y = Math.floor(cursor / cols)
    ocupadas.add(`${x},${y}`)
    out.push({ id: e.id, posicao: { x, y, w: 1, h: 1 } })
    cursor++
  }
  return out
}

// ─────────────────────────────────────────────────────────────────────────────
// PATROCÍNIO — cotas, pipeline e entregáveis (checklist)
// ─────────────────────────────────────────────────────────────────────────────

/** Patrocinadores que CONTAM como venda da cota (confirmados/faturados). */
export function patrocinadoresVendidos(patrocinadores: Patrocinador[]): Patrocinador[] {
  return patrocinadores.filter((p) => p.status === 'confirmado' || p.status === 'faturado')
}

export type CotaResumo = {
  vendidas: number
  disponiveis: number | null     // null = cota ilimitada
  esgotada: boolean
  receita: number                // realizada (confirmados/faturados)
}
/** Vendas e receita de UMA cota a partir dos seus patrocinadores. */
export function resumoCota(cota: Cota, patrocinadores: Patrocinador[]): CotaResumo {
  const daCota = patrocinadores.filter((p) => p.cota_id === cota.id)
  const vendidosList = patrocinadoresVendidos(daCota)
  const vendidas = vendidosList.length
  const receita = vendidosList.reduce((s, p) => s + (num(p.valor_num) || num(cota.preco_num)), 0)
  const qtd = cota.quantidade == null ? null : Math.max(0, Math.round(num(cota.quantidade)))
  return {
    vendidas,
    disponiveis: qtd == null ? null : Math.max(0, qtd - vendidas),
    esgotada: qtd != null && vendidas >= qtd,
    receita,
  }
}

/** A cota ainda tem vaga para mais um patrocinador? */
export function cotaTemVaga(cota: Cota, patrocinadores: Patrocinador[]): boolean {
  const r = resumoCota(cota, patrocinadores)
  return r.disponiveis == null || r.disponiveis > 0
}

export type PatrocinioResumo = {
  cotas: number
  vagasTotais: number | null     // null se alguma cota é ilimitada
  vendidas: number
  receitaRealizada: number       // confirmados/faturados
  receitaPipeline: number        // prospecto/proposta (potencial em negociação)
  receitaPotencialMapa: number   // vagas ainda abertas × preço da cota
}
/** Visão geral do patrocínio: vagas, vendas, receita realizada e potencial. */
export function resumoPatrocinio(cotas: Cota[], patrocinadores: Patrocinador[]): PatrocinioResumo {
  let vagasTotais: number | null = 0
  let vendidas = 0, receitaPotencialMapa = 0
  for (const c of cotas) {
    const r = resumoCota(c, patrocinadores)
    vendidas += r.vendidas
    if (c.quantidade == null) vagasTotais = null
    else if (vagasTotais != null) vagasTotais += Math.max(0, Math.round(num(c.quantidade)))
    const abertas = r.disponiveis == null ? 0 : r.disponiveis
    receitaPotencialMapa += abertas * num(c.preco_num)
  }
  const ativos = patrocinadores.filter((p) => p.status !== 'cancelado')
  const receitaRealizada = patrocinadoresVendidos(ativos).reduce((s, p) => s + receitaPatrocinador(p, cotas), 0)
  const receitaPipeline = ativos
    .filter((p) => p.status === 'prospecto' || p.status === 'proposta')
    .reduce((s, p) => s + receitaPatrocinador(p, cotas), 0)
  return {
    cotas: cotas.length, vagasTotais, vendidas,
    receitaRealizada, receitaPipeline, receitaPotencialMapa,
  }
}

/** Valor de um patrocinador: o próprio `valor_num` ou, na falta, o preço da cota. */
export function receitaPatrocinador(p: Patrocinador, cotas: Cota[]): number {
  const proprio = num(p.valor_num)
  if (proprio > 0) return proprio
  const cota = cotas.find((c) => c.id === p.cota_id)
  return cota ? num(cota.preco_num) : 0
}

// ── Entregáveis (checklist de contrapartidas) ────────────────────────────────
export type ProgressoEntregaveis = { total: number; entregues: number; pct: number; pendentes: Entregavel[] }
/**
 * Progresso do checklist de entregáveis de um patrocinador contra a sua cota.
 * `entregaveis_status[chave].entregue === true` conta como entregue.
 */
export function progressoEntregaveis(cota: Cota | null | undefined, patrocinador: Patrocinador): ProgressoEntregaveis {
  const itens = cota?.entregaveis || []
  const status = patrocinador.entregaveis_status || {}
  const pendentes: Entregavel[] = []
  let entregues = 0
  for (const it of itens) {
    if (status[it.chave]?.entregue) entregues++
    else pendentes.push(it)
  }
  const total = itens.length
  return { total, entregues, pct: total > 0 ? entregues / total : 0, pendentes }
}

/** Marca/atualiza um entregável no mapa de status (retorna um novo objeto). */
export function marcarEntregavel(
  status: Record<string, EntregavelStatus> | null | undefined,
  chave: string,
  patch: Partial<EntregavelStatus>,
): Record<string, EntregavelStatus> {
  const atual = status?.[chave] || { entregue: false }
  return { ...(status || {}), [chave]: { ...atual, ...patch } }
}

// ─────────────────────────────────────────────────────────────────────────────
// RECEITA & METAS — visão consolidada do evento
// ─────────────────────────────────────────────────────────────────────────────
export type ReceitaEvento = {
  estandesVendido: number
  estandesReservado: number
  estandesPotencial: number
  patrocinioRealizado: number
  patrocinioPipeline: number
  patrocinioPotencial: number
  /** Receita "no bolso" hoje: estandes vendidos + patrocínio confirmado. */
  realizado: number
  /** Realizado + reservas/pipeline (forecast). */
  forecast: number
  /** Teto de comercialização: tudo vendido + todas as cotas. */
  potencialTotal: number
}
/** Consolida a receita comercial do evento (estandes + patrocínio). */
export function receitaEvento(estandes: Estande[], cotas: Cota[], patrocinadores: Patrocinador[], precoM2 = 0): ReceitaEvento {
  const m = resumoMapa(estandes, precoM2)
  const p = resumoPatrocinio(cotas, patrocinadores)
  const realizado = m.receitaVendida + p.receitaRealizada
  const forecast = realizado + m.receitaReservada + p.receitaPipeline
  // Teto = mapa inteiro vendido + toda cota preenchida. Soma a receita já
  // realizada do patrocínio às vagas ainda abertas (receitaPotencialMapa); NÃO
  // inclui o pipeline, que representa deals mirando essas mesmas vagas (evita
  // contagem dupla). O pipeline entra só no `forecast`.
  const potencialTotal = m.receitaVendida + m.receitaReservada + m.receitaDisponivel
    + p.receitaRealizada + p.receitaPotencialMapa
  return {
    estandesVendido: m.receitaVendida,
    estandesReservado: m.receitaReservada,
    estandesPotencial: m.receitaDisponivel,
    patrocinioRealizado: p.receitaRealizada,
    patrocinioPipeline: p.receitaPipeline,
    patrocinioPotencial: p.receitaPotencialMapa,
    realizado, forecast, potencialTotal,
  }
}

/** Progresso 0–1 de uma meta de comercialização (clampado). */
export function progressoMeta(realizado: number, meta: number | null | undefined): number {
  const alvo = num(meta)
  if (alvo <= 0) return 0
  return Math.min(1, Math.max(0, num(realizado) / alvo))
}
