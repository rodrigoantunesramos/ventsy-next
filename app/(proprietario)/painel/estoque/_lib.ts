// _lib — modelo, catálogos, queries e chamadas de API do módulo Estoque.
// Compartilhado entre a shell (page.tsx) e as abas (_components/*).
// Regra de ouro: NADA de "R$"/percentual/data formatada aqui — só números/datas
// crus; a formatação fica em lib/format, chamada nas páginas. A matemática de
// saldo/custo médio/FEFO vive em lib/estoque (motor puro, testado).

import { authHeaders } from '@/lib/supabase'
import type { MovTipo, NivelEstoque, StatusValidade } from '@/lib/estoque'

// ── Linhas do banco (ver docs/sql/estoque.sql) ───────────────────────────────
export type Produto = {
  id: string
  sku: string | null
  nome: string
  categoria: string
  unidade: string
  estoque_minimo: number
  estoque_atual: number
  custo_medio_num: number
  local: string
  perecivel: boolean
  ativo: boolean
  obs: string | null
  criado_em: string | null
  atualizado_em: string | null
}
export type EstoqueMov = {
  id: string
  produto_id: string
  tipo: MovTipo
  quantidade: number
  custo_unit_num: number
  custo_total_num: number
  motivo: string | null
  evento_id: string | null
  recebimento_id: string | null
  local_origem: string | null
  local_destino: string | null
  lote: string | null
  validade: string | null
  criado_em: string | null
}
export type InvItem = { produto_id: string; contado: number; sistema: number }
export type Inventario = {
  id: string
  data: string
  local: string | null
  status: 'aberto' | 'concluido' | 'cancelado'
  itens: InvItem[]
  ajustes: number
  obs: string | null
  criado_em: string | null
}
export type EventoLite = {
  id: string
  nome_evento: string | null
  quem_contratou: string | null
  data_inicio: string | null
  status: string | null
}

// ── Selects (campos exatos pedidos ao Supabase) ──────────────────────────────
export const SEL_PRODUTO = 'id,sku,nome,categoria,unidade,estoque_minimo,estoque_atual,custo_medio_num,local,perecivel,ativo,obs,criado_em,atualizado_em'
export const SEL_MOV = 'id,produto_id,tipo,quantidade,custo_unit_num,custo_total_num,motivo,evento_id,recebimento_id,local_origem,local_destino,lote,validade,criado_em'
export const SEL_INV = 'id,data,local,status,itens,ajustes,obs,criado_em'
export const SEL_EVENTO = 'id,nome_evento,quem_contratou,data_inicio,status'

// ── Mapeadores (coerção numérica defensiva) ──────────────────────────────────
/* eslint-disable @typescript-eslint/no-explicit-any */
const n = (v: any): number => { const x = Number(v); return Number.isFinite(x) ? x : 0 }
export function mapProduto(r: any): Produto {
  return {
    id: String(r.id), sku: r.sku ?? null, nome: r.nome || '', categoria: r.categoria || 'outro',
    unidade: r.unidade || 'un', estoque_minimo: n(r.estoque_minimo), estoque_atual: n(r.estoque_atual),
    custo_medio_num: n(r.custo_medio_num), local: r.local || 'almoxarifado', perecivel: !!r.perecivel,
    ativo: r.ativo !== false, obs: r.obs ?? null, criado_em: r.criado_em ?? null, atualizado_em: r.atualizado_em ?? null,
  }
}
export function mapMov(r: any): EstoqueMov {
  return {
    id: String(r.id), produto_id: String(r.produto_id), tipo: (r.tipo || 'entrada') as MovTipo,
    quantidade: n(r.quantidade), custo_unit_num: n(r.custo_unit_num), custo_total_num: n(r.custo_total_num),
    motivo: r.motivo ?? null, evento_id: r.evento_id ?? null, recebimento_id: r.recebimento_id ?? null,
    local_origem: r.local_origem ?? null, local_destino: r.local_destino ?? null,
    lote: r.lote ?? null, validade: r.validade ?? null, criado_em: r.criado_em ?? null,
  }
}
export function mapInventario(r: any): Inventario {
  return {
    id: String(r.id), data: r.data, local: r.local ?? null, status: (r.status || 'aberto'),
    itens: Array.isArray(r.itens) ? r.itens : [], ajustes: n(r.ajustes), obs: r.obs ?? null, criado_em: r.criado_em ?? null,
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// ── Catálogos (rótulos PT; i18n: extrair p/ dicionário) ──────────────────────
export const CATEGORIAS: { v: string; label: string; cor: string }[] = [
  { v: 'bebidas',      label: 'Bebidas',            cor: '#0ea5e9' },
  { v: 'alimentos',    label: 'Alimentos',          cor: '#f97316' },
  { v: 'descartaveis', label: 'Descartáveis',       cor: '#8b5cf6' },
  { v: 'limpeza',      label: 'Material de limpeza', cor: '#14b8a6' },
  { v: 'papelaria',    label: 'Papelaria',          cor: '#6366f1' },
  { v: 'brindes',      label: 'Brindes',            cor: '#ec4899' },
  { v: 'outro',        label: 'Outro',              cor: '#94a3b8' },
]
export const CAT_BY = Object.fromEntries(CATEGORIAS.map((c) => [c.v, c])) as Record<string, (typeof CATEGORIAS)[number]>
export const catLabel = (v: string | null): string => CAT_BY[v || 'outro']?.label || v || '—'
export const catCor = (v: string | null): string => CAT_BY[v || 'outro']?.cor || '#94a3b8'

export const LOCAIS: { v: string; label: string }[] = [
  { v: 'almoxarifado', label: 'Almoxarifado' },
  { v: 'bar',          label: 'Bar' },
  { v: 'cozinha',      label: 'Cozinha' },
  { v: 'deposito',     label: 'Depósito' },
  { v: 'escritorio',   label: 'Escritório' },
  { v: 'outro',        label: 'Outro' },
]
export const LOCAL_BY = Object.fromEntries(LOCAIS.map((l) => [l.v, l])) as Record<string, (typeof LOCAIS)[number]>
export const localLabel = (v: string | null): string => LOCAL_BY[v || '']?.label || v || '—'

// Unidades de medida comuns no setor de eventos.
export const UNIDADES = ['un', 'cx', 'kg', 'g', 'l', 'ml', 'pct', 'fardo', 'dz', 'par', 'rolo', 'saco']

// Tipos de movimentação — rótulo, cor semântica e sinal exibido.
export const MOV_TIPOS: { v: MovTipo; label: string; cls: string; sinal: '+' | '−' | '±' | '↔' }[] = [
  { v: 'entrada',       label: 'Entrada',       cls: 'bg-emerald-50 text-emerald-700', sinal: '+' },
  { v: 'saida',         label: 'Saída',         cls: 'bg-blue-50 text-blue-700',       sinal: '−' },
  { v: 'perda',         label: 'Perda',         cls: 'bg-red-50 text-red-700',         sinal: '−' },
  { v: 'ajuste',        label: 'Ajuste',        cls: 'bg-amber-50 text-amber-700',     sinal: '±' },
  { v: 'transferencia', label: 'Transferência', cls: 'bg-violet-50 text-violet-700',   sinal: '↔' },
]
export const MOV_BY = Object.fromEntries(MOV_TIPOS.map((m) => [m.v, m])) as Record<MovTipo, (typeof MOV_TIPOS)[number]>

// Semáforo de nível e de validade — mesma paleta semântica do painel.
export const NIVEL_CLS: Record<NivelEstoque, string> = {
  zerado: 'bg-red-50 text-red-700',
  baixo: 'bg-amber-50 text-amber-700',
  ok: 'bg-emerald-50 text-emerald-700',
}
export const NIVEL_LABEL: Record<NivelEstoque, string> = { zerado: 'Sem estoque', baixo: 'Abaixo do mínimo', ok: 'Em dia' }
export const NIVEL_DOT: Record<NivelEstoque, string> = { zerado: 'bg-red-500', baixo: 'bg-amber-500', ok: 'bg-emerald-500' }

export const VAL_CLS: Record<StatusValidade, string> = {
  vencido: 'bg-red-50 text-red-700',
  critico: 'bg-orange-50 text-orange-700',
  atencao: 'bg-amber-50 text-amber-700',
  ok: 'bg-emerald-50 text-emerald-700',
}
export const VAL_LABEL: Record<StatusValidade, string> = { vencido: 'Vencido', critico: 'Vence em ≤7 dias', atencao: 'A vencer', ok: 'OK' }

// Classe de input padrão (igual ao resto do painel).
export const inp = 'w-full rounded-xl border border-black/10 px-3.5 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20'

// ── Helpers de data ──────────────────────────────────────────────────────────
export function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// ── Detecção de "tabela ainda não criada" (rodar o SQL) ──────────────────────
// PGRST205 = REST não encontrou a tabela; 42P01 = undefined_table (SQL direto).
export function isMissingTable(err: { code?: string | null } | null | undefined): boolean {
  return err?.code === 'PGRST205' || err?.code === '42P01'
}

// ── API de movimentação (autoritativa: /api/estoque) ─────────────────────────
export type MovPayload = {
  produto_id: string
  tipo: MovTipo
  quantidade: number
  custo_unit_num?: number
  motivo?: string
  evento_id?: string | null
  local_origem?: string | null
  local_destino?: string | null
  lote?: string | null
  validade?: string | null
  force?: boolean
}
/* eslint-disable @typescript-eslint/no-explicit-any */
export type ApiResult = { ok: boolean; error?: string; saldo?: number; solicitado?: number; data?: any }
export async function postMov(payload: MovPayload): Promise<ApiResult> {
  const res = await fetch('/api/estoque', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
    body: JSON.stringify(payload),
  })
  const json = await res.json().catch(() => ({}))
  return res.ok ? { ok: true, data: json.data } : { ok: false, ...json }
}
export async function deleteMov(id: string): Promise<ApiResult> {
  const res = await fetch(`/api/estoque?id=${encodeURIComponent(id)}`, { method: 'DELETE', headers: { ...(await authHeaders()) } })
  const json = await res.json().catch(() => ({}))
  return res.ok ? { ok: true, data: json.data } : { ok: false, ...json }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

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
