// _lib — modelo, queries, mapeadores e chamadas de API do módulo Layouts.
// Compartilhado entre a shell (page.tsx) e as abas (_components/*).
// Regra de ouro: NADA de "R$"/percentual/data formatada aqui — só números/datas
// crus; a formatação fica em lib/format. A lógica de capacidade/arranjo/ocupação
// vive em lib/layouts (motor puro, testado), re-exportada abaixo p/ um só import.
// O "aplicar layout ao evento" e o "publicar capacidade no Acesso" passam pela
// rota AUTORITATIVA /api/layouts; o CRUD de layouts e a edição do mapa de mesas
// são feitos pelo client via RLS.

import { supabase as sb, authHeaders } from '@/lib/supabase'
import type { TablesInsert } from '@/types/supabase'
import {
  type Planta, type MapaMesas, type Elemento, type Convidado,
  type SetupKey, type ElementoTipo,
  mesclarPlanta, mesclarMapa,
} from '@/lib/layouts'

export type { Planta, MapaMesas, Elemento, Convidado, SetupKey, ElementoTipo }
export {
  CANVAS_PADRAO,
  SETUPS, setupMeta, setupLabel,
  ELEMENTOS, elementoMeta, paletaElementos,
  mesclarPlanta, mesclarMapa, normalizarElemento,
  isAssento, mesasDaPlanta, lugaresDaPlanta, lugaresDosElementos, clampElemento,
  capacidadePorSetup, capacidadesPorArea, densidade, nivelDensidade, checarCapacidade,
  gerarArranjo, ocupacaoMesas, distribuirConvidados, convidadosAnonimos,
  isMissingTable,
} from '@/lib/layouts'

// ── Linhas auxiliares (de outros módulos) ────────────────────────────────────
export type PropLite = { id: number; nome: string | null; cidade: string | null }
export type EspacoLite = { id: number; propriedade_id: number; nome: string; tipo: string; capacidade: number | null; area_m2: number | null }
export type EventoLite = {
  id: string
  nome_evento: string | null
  quem_contratou: string | null
  tipo_evento: string | null
  data_inicio: string | null
  propriedade_id: number | null
  qtd_adultos: number | null
  qtd_criancas: number | null
}

/** Layout (planta/arranjo) — `elementos` já parseado em `planta`. */
export type Layout = {
  id: string
  usuario_id?: string
  propriedade_id: number | null
  espaco_id: number | null
  nome: string
  tipo_setup: string
  capacidade: number | null
  area_m2: number | null
  planta_url: string | null
  planta: Planta
  obs: string | null
  criado_em?: string
  atualizado_em?: string
}
/** Vínculo evento→layout — `mapa_mesas` já parseado em `mapa`. */
export type EventoLayout = {
  id: string
  usuario_id?: string
  evento_id: string
  layout_id: string | null
  mapa: MapaMesas
  criado_em?: string
  atualizado_em?: string
}

// ── Selects ──────────────────────────────────────────────────────────────────
export const SEL_LAYOUT = 'id,usuario_id,propriedade_id,espaco_id,nome,tipo_setup,capacidade,area_m2,planta_url,elementos,obs,criado_em,atualizado_em'
export const SEL_EVL = 'id,usuario_id,evento_id,layout_id,mapa_mesas,criado_em,atualizado_em'
export const SEL_EVENTO = 'id,nome_evento,quem_contratou,tipo_evento,data_inicio,propriedade_id,qtd_adultos,qtd_criancas'

// ── Mapeadores (coerção defensiva) ───────────────────────────────────────────
/* eslint-disable @typescript-eslint/no-explicit-any */
const n = (v: any): number | null => { if (v == null || v === '') return null; const x = Number(v); return Number.isFinite(x) ? x : null }
export function mapLayout(r: any): Layout {
  return {
    id: String(r.id), usuario_id: r.usuario_id,
    propriedade_id: r.propriedade_id != null ? Number(r.propriedade_id) : null,
    espaco_id: r.espaco_id != null ? Number(r.espaco_id) : null,
    nome: r.nome || 'Layout', tipo_setup: r.tipo_setup || 'banquete',
    capacidade: n(r.capacidade), area_m2: n(r.area_m2), planta_url: r.planta_url ?? null,
    planta: mesclarPlanta(r.elementos), obs: r.obs ?? null,
    criado_em: r.criado_em ?? undefined, atualizado_em: r.atualizado_em ?? undefined,
  }
}
export function mapEventoLayout(r: any): EventoLayout {
  return {
    id: String(r.id), usuario_id: r.usuario_id, evento_id: String(r.evento_id),
    layout_id: r.layout_id ? String(r.layout_id) : null, mapa: mesclarMapa(r.mapa_mesas),
    criado_em: r.criado_em ?? undefined, atualizado_em: r.atualizado_em ?? undefined,
  }
}
export const mapProp = (r: any): PropLite => ({ id: Number(r.id), nome: r.nome ?? null, cidade: r.cidade ?? null })
export const mapEspaco = (r: any): EspacoLite => ({ id: Number(r.id), propriedade_id: Number(r.propriedade_id), nome: r.nome || '', tipo: r.tipo || 'salao', capacidade: n(r.capacidade), area_m2: n(r.area_m2) })
export const mapEvento = (r: any): EventoLite => ({ id: String(r.id), nome_evento: r.nome_evento ?? null, quem_contratou: r.quem_contratou ?? null, tipo_evento: r.tipo_evento ?? null, data_inicio: r.data_inicio ?? null, propriedade_id: r.propriedade_id != null ? Number(r.propriedade_id) : null, qtd_adultos: n(r.qtd_adultos), qtd_criancas: n(r.qtd_criancas) })
/* eslint-enable @typescript-eslint/no-explicit-any */

// ── Helpers de rótulo ─────────────────────────────────────────────────────────
export function eventoLabel(ev: EventoLite | null | undefined): string {
  if (!ev) return 'Evento'
  return ev.nome_evento || ev.quem_contratou || 'Evento sem nome'
}
export function propLabel(props: PropLite[], id: number | null): string {
  if (id == null) return '—'
  return props.find((p) => p.id === id)?.nome || `Propriedade #${id}`
}
export function espacoLabel(espacos: EspacoLite[], id: number | null): string {
  if (id == null) return ''
  return espacos.find((e) => e.id === id)?.nome || ''
}

// ── API autoritativa (/api/layouts) ──────────────────────────────────────────
/* eslint-disable @typescript-eslint/no-explicit-any */
export type ApiResult = { ok: boolean; error?: string; status?: number; data?: any; publicado?: boolean; motivo?: string; capacidade?: number }
async function call(body: unknown): Promise<ApiResult> {
  const res = await fetch('/api/layouts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
    body: JSON.stringify(body),
  })
  const json = await res.json().catch(() => ({}))
  return res.ok ? { ok: true, ...json } : { ok: false, status: res.status, ...json }
}
/** Aplica um layout ao evento (get-or-create do evento_layout). */
export const aplicarLayout = (evento_id: string, layout_id: string | null, opts: { auto_distribuir?: boolean } = {}) =>
  call({ action: 'aplicar', evento_id, layout_id, ...opts })
/** Publica a capacidade do layout na zona `geral` do Acesso. */
export const publicarCapacidade = (evento_id: string, layout_id: string) =>
  call({ action: 'publicar_capacidade', evento_id, layout_id })

// ── CRUD via RLS (client) — layouts e mapa de mesas ───────────────────────────
/** Serializa o estado de UI de um layout para a linha do banco (`elementos` = jsonb da planta). */
export function layoutParaRow(l: Partial<Layout> & { usuario_id?: string }): Record<string, unknown> {
  return {
    ...(l.usuario_id ? { usuario_id: l.usuario_id } : {}),
    propriedade_id: l.propriedade_id ?? null,
    espaco_id: l.espaco_id ?? null,
    nome: (l.nome || '').trim() || 'Layout',
    tipo_setup: l.tipo_setup || 'banquete',
    capacidade: l.capacidade ?? null,
    area_m2: l.area_m2 ?? null,
    planta_url: l.planta_url || null,
    elementos: l.planta ? { largura: l.planta.largura, altura: l.planta.altura, itens: l.planta.itens } : { largura: 1000, altura: 700, itens: [] },
    obs: l.obs || null,
  }
}
export async function criarLayout(row: Record<string, unknown>) {
  return sb.from('layouts').insert(row as TablesInsert<'layouts'>).select(SEL_LAYOUT).single()
}
export async function salvarLayout(id: string, row: Record<string, unknown>) {
  return sb.from('layouts').update(row).eq('id', id).select(SEL_LAYOUT).single()
}
export async function excluirLayout(id: string) {
  return sb.from('layouts').delete().eq('id', id)
}
/** Busca o vínculo evento→layout (via RLS). */
export async function buscarEventoLayout(eventoId: string) {
  return sb.from('evento_layout').select(SEL_EVL).eq('evento_id', eventoId).maybeSingle()
}
/** Salva o mapa de mesas no evento_layout (via RLS — a linha já existe após "aplicar"). */
export async function salvarMapa(eventoLayoutId: string, mapa: MapaMesas) {
  return sb.from('evento_layout').update({ mapa_mesas: mapa }).eq('id', eventoLayoutId).select(SEL_EVL).single()
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
