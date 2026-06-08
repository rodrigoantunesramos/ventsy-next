// _lib — modelo, catálogos, queries, mapeadores e chamadas de API do módulo
// Catering, Buffet & Bar. Compartilhado entre a shell (page.tsx) e as abas
// (_components/*). Regra de ouro: NADA de "R$"/percentual/data formatada aqui —
// só números/datas crus; a formatação fica em lib/format. A matemática de custo/
// dimensionamento/CMV/bar vive em lib/catering (motor puro, testado), re-exportada
// abaixo p/ um só import. O ensure 1:1, a geração de requisição (Compras) e a
// baixa de consumo (Estoque) passam pela rota AUTORITATIVA /api/catering; o
// restante (cardápios, A&B/bar do evento) é gravado pelo client via RLS.

import { authHeaders, supabaseAny as sb } from '@/lib/supabase'
import type {
  Cardapio, CardapioItem, FichaInsumo, Drink, ConsumoDrink, RestricaoLinha,
  CardapioTipo, BarTipo, LinhaDimensionada,
} from '@/lib/catering'

export type { Cardapio, CardapioItem, FichaInsumo, Drink, ConsumoDrink, RestricaoLinha, CardapioTipo, BarTipo, LinhaDimensionada }
export {
  num, round2, clampFrac,
  custoInsumoPorPessoa, custoItemPorPessoa, custoCardapioPorPessoa, precoCardapioPorPessoa,
  foodCost, margemBruta, markup,
  dimensionar, custoDimensionado, linhasComProduto,
  custoBarPrevisto, receitaBarPrevista, consumoBarReal, resultadoBar,
  custoPorPessoa, compararCMV, resumoEvento,
  parseRestricoesTexto, agregarRestricoes, restricoesPresentes, coberturaRestricoes,
  CARDAPIO_TIPOS, ITEM_CATEGORIAS, RESTRICOES, BAR_TIPOS, DRINK_CATEGORIAS,
  cardapioTipoLabel, itemCategoriaLabel, itemCategoriaCor, restricaoLabel, restricaoCor, barTipoLabel,
  TEMPLATES_CARDAPIO, isMissingTable,
} from '@/lib/catering'

// ── Linhas do banco (ver docs/sql/catering.sql) ──────────────────────────────
export type CateringEvento = {
  id: string
  usuario_id: string
  evento_id: string
  cardapio_id: string | null
  convidados: number
  fator_ajuste: number
  restricoes: RestricaoLinha[]
  custo_previsto_num: number
  receita_num: number
  custo_real_num: number
  requisicao_id: string | null
  consumo_movs: string[]
  baixado_em: string | null
  obs: string | null
}
export type BarEvento = {
  id: string
  usuario_id: string
  evento_id: string
  tipo: BarTipo
  drinks: Drink[]
  consumo: ConsumoDrink[]
  perdas_num: number
  custo_num: number
  receita_num: number
  obs: string | null
}
/** Evento contratado (clientes_eventos) — espinha dorsal. */
export type EventoLite = {
  id: string
  nome_evento: string | null
  quem_contratou: string | null
  tipo_evento: string | null
  status: string | null
  data_inicio: string | null
  qtd_adultos: number | null
  qtd_criancas: number | null
  restricoes_alimentares: string | null
  valor_total_num: number | null
}
/** Produto do Estoque (insumo) — usado na ficha técnica e na baixa de consumo. */
export type ProdutoLite = {
  id: string
  nome: string
  categoria: string
  unidade: string
  custo_medio_num: number
  estoque_atual: number
}

/** Estado compartilhado pelas abas por evento (A&B · Bar · Custo). */
export type EventoBag = {
  userId: string
  evento: EventoLite
  catering: CateringEvento
  bar: BarEvento | null
  cardapios: Cardapio[]
  produtos: ProdutoLite[]
  recarregar: () => Promise<void>
}

// ── Selects ──────────────────────────────────────────────────────────────────
export const SEL_CARDAPIO = 'id,usuario_id,nome,tipo,itens,preco_pessoa_num,ativo,obs,criado_em,atualizado_em'
export const SEL_CAT = 'id,usuario_id,evento_id,cardapio_id,convidados,fator_ajuste,restricoes,ajustes,custo_previsto_num,receita_num,custo_real_num,requisicao_id,consumo_movs,baixado_em,obs'
export const SEL_BAR = 'id,usuario_id,evento_id,tipo,drinks,consumo,perdas_num,custo_num,receita_num,obs'
export const SEL_EVENTO = 'id,nome_evento,quem_contratou,tipo_evento,status,data_inicio,qtd_adultos,qtd_criancas,restricoes_alimentares,valor_total_num'
export const SEL_PRODUTO = 'id,nome,categoria,unidade,custo_medio_num,estoque_atual'

// ── Mapeadores (coerção defensiva) ───────────────────────────────────────────
/* eslint-disable @typescript-eslint/no-explicit-any */
const n = (v: any): number => { const x = Number(v); return Number.isFinite(x) ? x : 0 }
const arr = (v: any): any[] => (Array.isArray(v) ? v : [])

export function mapFicha(r: any): FichaInsumo {
  return {
    produto_id: r?.produto_id ? String(r.produto_id) : null,
    nome: String(r?.nome || ''), unidade: String(r?.unidade || 'un'),
    qtd_por_pessoa: n(r?.qtd_por_pessoa), custo_unit_num: n(r?.custo_unit_num), perda_pct: n(r?.perda_pct),
  }
}
export function mapItem(r: any): CardapioItem {
  return {
    id: String(r?.id || cryptoId()), nome: String(r?.nome || ''), categoria: r?.categoria || 'outro',
    porcao_por_pessoa: n(r?.porcao_por_pessoa), unidade: String(r?.unidade || 'un'),
    custo_num: n(r?.custo_num), preco_num: n(r?.preco_num), incluso: r?.incluso !== false,
    restricoes: arr(r?.restricoes).map((x) => String(x)) as CardapioItem['restricoes'],
    ficha: arr(r?.ficha).map(mapFicha),
  }
}
export function mapCardapio(r: any): Cardapio {
  return {
    id: String(r.id), nome: r.nome || '', tipo: (r.tipo || 'outro') as CardapioTipo,
    itens: arr(r.itens).map(mapItem), preco_pessoa_num: n(r.preco_pessoa_num),
  }
}
export function mapCardapioRow(r: any): Cardapio & { ativo: boolean; obs: string | null } {
  return { ...mapCardapio(r), ativo: r.ativo !== false, obs: r.obs ?? null }
}
export function mapCateringEvento(r: any): CateringEvento {
  return {
    id: String(r.id), usuario_id: r.usuario_id, evento_id: String(r.evento_id),
    cardapio_id: r.cardapio_id ? String(r.cardapio_id) : null,
    convidados: n(r.convidados), fator_ajuste: n(r.fator_ajuste) || 1,
    restricoes: arr(r.restricoes).map((x) => ({ restricao: x?.restricao, quantidade: n(x?.quantidade) })) as RestricaoLinha[],
    custo_previsto_num: n(r.custo_previsto_num), receita_num: n(r.receita_num), custo_real_num: n(r.custo_real_num),
    requisicao_id: r.requisicao_id ? String(r.requisicao_id) : null,
    consumo_movs: arr(r.consumo_movs).map((x) => String(x)),
    baixado_em: r.baixado_em ?? null, obs: r.obs ?? null,
  }
}
export function mapDrink(r: any): Drink {
  return {
    id: String(r?.id || cryptoId()), nome: String(r?.nome || ''), categoria: String(r?.categoria || 'outro'),
    custo_num: n(r?.custo_num), preco_num: n(r?.preco_num), por_pessoa: n(r?.por_pessoa),
  }
}
export function mapBarEvento(r: any): BarEvento {
  return {
    id: String(r.id), usuario_id: r.usuario_id, evento_id: String(r.evento_id), tipo: (r.tipo || 'sem_bar') as BarTipo,
    drinks: arr(r.drinks).map(mapDrink),
    consumo: arr(r.consumo).map((x) => ({ drink_id: String(x?.drink_id || ''), quantidade: n(x?.quantidade), perda: n(x?.perda) })),
    perdas_num: n(r.perdas_num), custo_num: n(r.custo_num), receita_num: n(r.receita_num), obs: r.obs ?? null,
  }
}
export const mapProduto = (r: any): ProdutoLite => ({
  id: String(r.id), nome: r.nome || '', categoria: r.categoria || 'outro',
  unidade: r.unidade || 'un', custo_medio_num: n(r.custo_medio_num), estoque_atual: n(r.estoque_atual),
})
/* eslint-enable @typescript-eslint/no-explicit-any */

/** id local p/ itens/insumos/drinks no jsonb (sem dependência externa). */
export function cryptoId(): string {
  try {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  } catch { /* sem crypto — cai no fallback */ }
  return `id-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`
}

// ── Helpers de evento ────────────────────────────────────────────────────────
export function eventoLabel(ev: EventoLite | null | undefined): string {
  if (!ev) return 'Evento'
  return ev.nome_evento || ev.quem_contratou || 'Evento sem nome'
}
export function convidadosDoEvento(ev: EventoLite | null | undefined): number {
  if (!ev) return 0
  return Math.max(0, (Number(ev.qtd_adultos) || 0) + (Number(ev.qtd_criancas) || 0))
}

// ── API autoritativa (/api/catering) ─────────────────────────────────────────
/* eslint-disable @typescript-eslint/no-explicit-any */
export type ApiResult = { ok: boolean; error?: string; status?: number; data?: any; itens?: any[]; custo_real?: number }
async function call(body: Record<string, unknown>): Promise<ApiResult> {
  const res = await fetch('/api/catering', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
    body: JSON.stringify(body),
  })
  const json = await res.json().catch(() => ({}))
  return res.ok ? { ok: true, data: json.data } : { ok: false, status: res.status, ...json }
}
/* eslint-enable @typescript-eslint/no-explicit-any */
export const ensureCatering = (evento_id: string) => call({ op: 'ensure', evento_id })
export const gerarRequisicao = (evento_id: string, linhas: LinhaDimensionada[], cardapio_nome: string) =>
  call({ op: 'requisicao', evento_id, linhas, cardapio_nome })
export const consumirEstoque = (evento_id: string, linhas: LinhaDimensionada[], cardapio_nome: string, force = false) =>
  call({ op: 'consumir', evento_id, linhas, cardapio_nome, force })
export const estornarConsumo = (evento_id: string) => call({ op: 'estornar', evento_id })

// ── CRUD via RLS (client) — cardápios, A&B e bar do evento ───────────────────
export async function criarCardapio(row: Record<string, unknown>) {
  return sb.from('cardapios').insert(row).select(SEL_CARDAPIO).single()
}
export async function salvarCardapio(id: string, patch: Record<string, unknown>) {
  return sb.from('cardapios').update(patch).eq('id', id).select(SEL_CARDAPIO).single()
}
export async function excluirCardapio(id: string) {
  return sb.from('cardapios').delete().eq('id', id)
}
export async function salvarCateringEvento(id: string, patch: Record<string, unknown>) {
  return sb.from('catering_evento').update(patch).eq('id', id).select(SEL_CAT).single()
}
export async function salvarBarEvento(id: string, patch: Record<string, unknown>) {
  return sb.from('bar_evento').update(patch).eq('id', id).select(SEL_BAR).single()
}

// ── Classes de input padrão (igual ao resto do painel) ───────────────────────
export const inp = 'w-full rounded-xl border border-black/10 px-3.5 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20'
export const inpSm = 'w-full rounded-lg border border-black/10 px-2.5 py-1.5 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20'
export const selCls = 'rounded-xl border border-black/10 bg-white px-3 py-2 text-sm focus:border-brand focus:outline-none'

// ── Export CSV (genérico) ────────────────────────────────────────────────────
const esc = (s: string) => `"${(s || '').replace(/"/g, '""')}"`
export function exportCSV(name: string, header: string[], rows: (string | number)[][]): void {
  const body = rows.map((r) => r.map((c) => (typeof c === 'number' ? c : esc(String(c)))).join(',')).join('\n')
  const blob = new Blob(['﻿' + header.join(',') + '\n' + body], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = name; a.click()
  URL.revokeObjectURL(url)
}
