// _lib — modelo, queries, mapeadores e chamadas do módulo Clima & Plano B.
// Compartilhado entre a shell (page.tsx) e as abas (_components/*).
// Regra de ouro: NADA de "R$"/percentual/data formatada aqui — só dados crus; a
// formatação fica em lib/format. A engine de avaliação de risco/parse de previsão
// vive em lib/plano-b (pura, testada), re-exportada abaixo p/ um só import. A
// BUSCA da previsão (API de meteo + cache) passa pela rota /api/plano-b; o CRUD
// de planos e a previsão MANUAL são feitos pelo client via RLS.

import { supabaseAny as sb, authHeaders } from '@/lib/supabase'
import {
  type Plano, type Gatilho, type ChecklistItem, type ClimaResumo, type ClimaHora,
  type RiscoTipo, type Metrica, type Operador, type PlanoStatus, type Avaliacao, type NivelRisco,
  mesclarResumo, gatilhoPadrao, normalizarChecklist,
} from '@/lib/plano-b'

export type { Plano, Gatilho, ChecklistItem, ClimaResumo, ClimaHora, RiscoTipo, Metrica, Operador, PlanoStatus, Avaliacao, NivelRisco }
export {
  // catálogos / helpers de domínio reusados pelas abas
  RISCOS, METRICAS, AUDIENCIAS,
  riscoMeta, riscoLabel, metricaLabel, metricaUnidade, gatilhoPadrao,
  nivelMeta, NIVEL_META, PLANO_STATUS_META, condicaoDe,
  valorDaMetrica, cruzaLimiar, avaliarPlano, avaliarPlanos, nivelGeral, avaliacoesDisparadas,
  progressoChecklist, checklistDoEvento, normalizarChecklist,
  renderComunicado, comunicadoSeed,
  listarTemplates, templateKeyParaTipo, gerarPlanosDoTemplate,
  previsaoDisponivel, diaDe, addDiasYMD, mesclarResumo, resumoVazio,
  isMissingTable,
} from '@/lib/plano-b'

// ── Linhas auxiliares (de outros módulos) ────────────────────────────────────
export type EventoLite = {
  id: string
  nome_evento: string | null
  quem_contratou: string | null
  tipo_evento: string | null
  status: string | null
  data_inicio: string | null
  data_fim: string | null
  horario_inicio: string | null
  horario_fim: string | null
  propriedade_id: number | null
  email: string | null
  telefones: string[] | null
}
export type PropriedadeLite = {
  id: number
  nome: string | null
  cidade: string | null
  estado: string | null
  latitude: number | null
  longitude: number | null
}
/** Pessoa fixa (tabela `equipe`) — sugestões de responsável. */
export type EquipeLite = { id: number; nome: string; cargo: string | null }

// ── Selects ──────────────────────────────────────────────────────────────────
export const SEL_EVENTO = 'id,nome_evento,quem_contratou,tipo_evento,status,data_inicio,data_fim,horario_inicio,horario_fim,propriedade_id,email,telefones'
export const SEL_PROP = 'id,nome,cidade,estado,latitude,longitude'
export const SEL_PLANO = 'id,usuario_id,evento_id,tipo_risco,gatilho,acao,responsavel,status,comunicado_template,checklist,ordem,criado_em,atualizado_em'
export const SEL_SNAP = 'evento_id,fonte,latitude,longitude,dia,previsao,capturado_em'

// ── Mapeadores (coerção defensiva) ───────────────────────────────────────────
/* eslint-disable @typescript-eslint/no-explicit-any */
const num = (v: any): number => { const x = Number(v); return Number.isFinite(x) ? x : 0 }

/** Normaliza o gatilho jsonb, preenchendo defaults pelo tipo de risco. */
export function mapGatilho(raw: any, tipo: string): Gatilho {
  const base = gatilhoPadrao(tipo as RiscoTipo)
  if (!raw || typeof raw !== 'object') return base
  const atencao = Number(raw.atencao)
  const critico = Number(raw.critico)
  return {
    metrica: (raw.metrica || base.metrica) as Metrica,
    operador: (raw.operador === 'abaixo' ? 'abaixo' : raw.operador === 'acima' ? 'acima' : base.operador) as Operador,
    atencao: Number.isFinite(atencao) ? atencao : base.atencao,
    critico: Number.isFinite(critico) ? critico : base.critico,
    unidade: raw.unidade || base.unidade,
  }
}
export function mapPlano(r: any): Plano {
  return {
    id: String(r.id), usuario_id: r.usuario_id, evento_id: String(r.evento_id),
    tipo_risco: r.tipo_risco || 'chuva',
    gatilho: mapGatilho(r.gatilho, r.tipo_risco || 'chuva'),
    acao: r.acao || '', responsavel: r.responsavel ?? null,
    status: r.status || 'armado', comunicado_template: r.comunicado_template ?? null,
    checklist: normalizarChecklist(r.checklist), ordem: num(r.ordem),
    criado_em: r.criado_em ?? undefined, atualizado_em: r.atualizado_em ?? undefined,
  }
}
/** Reconstrói o ClimaResumo a partir da linha de clima_snapshots. */
export function mapSnapshot(r: any): ClimaResumo {
  const resumo = mesclarResumo(r.previsao)
  if (!resumo.fonte) resumo.fonte = r.fonte || ''
  if (!resumo.capturado_em) resumo.capturado_em = r.capturado_em || null
  if (!resumo.dia) resumo.dia = r.dia || null
  return resumo
}
export const mapEvento = (r: any): EventoLite => ({
  id: String(r.id), nome_evento: r.nome_evento ?? null, quem_contratou: r.quem_contratou ?? null,
  tipo_evento: r.tipo_evento ?? null, status: r.status ?? null, data_inicio: r.data_inicio ?? null,
  data_fim: r.data_fim ?? null, horario_inicio: r.horario_inicio ?? null, horario_fim: r.horario_fim ?? null,
  propriedade_id: r.propriedade_id != null ? Number(r.propriedade_id) : null,
  email: r.email ?? null, telefones: Array.isArray(r.telefones) ? r.telefones : null,
})
export const mapProp = (r: any): PropriedadeLite => ({
  id: Number(r.id), nome: r.nome ?? null, cidade: r.cidade ?? null, estado: r.estado ?? null,
  latitude: r.latitude != null ? Number(r.latitude) : null, longitude: r.longitude != null ? Number(r.longitude) : null,
})
export const mapEquipe = (r: any): EquipeLite => ({ id: Number(r.id), nome: r.nome || '', cargo: r.cargo ?? null })
/* eslint-enable @typescript-eslint/no-explicit-any */

// ── Meta da previsão (motivo de degrade, local, frescor) ─────────────────────
export type PrevisaoMotivo = 'sem_data' | 'sem_coordenadas' | 'fora_do_horizonte' | 'falha_api' | null
export type PrevisaoMeta = { motivo: PrevisaoMotivo; local: string | null; carregando: boolean }

// ── Bag de estado compartilhado entre a shell e as abas ──────────────────────
export type PlanoBBag = {
  userId: string
  hoje: string
  empresa: string
  evento: EventoLite
  propriedade: PropriedadeLite | null
  planos: Plano[]
  resumo: ClimaResumo | null
  meta: PrevisaoMeta
  equipe: EquipeLite[]
  recarregarPlanos: () => Promise<void>
  atualizarPrevisao: () => Promise<void>
  salvarManual: (resumo: ClimaResumo) => Promise<boolean>
}

// ── Helpers de evento ────────────────────────────────────────────────────────
export function eventoLabel(ev: EventoLite | null | undefined): string {
  if (!ev) return 'Evento'
  return ev.nome_evento || ev.quem_contratou || 'Evento sem nome'
}

// ── API de previsão (/api/plano-b) ───────────────────────────────────────────
export type PrevisaoResult = {
  ok: boolean
  resumo: ClimaResumo | null
  motivo: PrevisaoMotivo
  local: string | null
  error?: string
  status?: number
}
/** Busca/atualiza a previsão do evento via rota (Open-Meteo + cache). */
export async function buscarPrevisao(evento_id: string): Promise<PrevisaoResult> {
  try {
    const res = await fetch('/api/plano-b', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
      body: JSON.stringify({ evento_id }),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) return { ok: false, resumo: null, motivo: null, local: null, status: res.status, error: json.error }
    const d = json.data || {}
    return { ok: true, resumo: d.resumo ? mesclarResumo(d.resumo) : null, motivo: (d.motivo ?? null) as PrevisaoMotivo, local: d.local ?? null }
  } catch (e) {
    return { ok: false, resumo: null, motivo: 'falha_api', local: null, error: (e as Error)?.message }
  }
}

// ── CRUD via RLS (client) — planos + previsão manual ─────────────────────────
/* eslint-disable @typescript-eslint/no-explicit-any */
export async function criarPlano(row: Record<string, unknown>) {
  return sb.from('plano_contingencia').insert(row).select(SEL_PLANO).single()
}
/** Insere vários planos de uma vez (gerar do modelo). */
export async function bulkInserirPlanos(rows: Record<string, unknown>[]) {
  return sb.from('plano_contingencia').insert(rows)
}
export async function salvarPlano(id: string, patch: Record<string, unknown>) {
  return sb.from('plano_contingencia').update(patch).eq('id', id).select(SEL_PLANO).single()
}
export async function excluirPlano(id: string) {
  return sb.from('plano_contingencia').delete().eq('id', id)
}
/** Atualiza a checklist (jsonb) de um plano — usado pelo toggle de contingência. */
export async function salvarChecklist(id: string, checklist: ChecklistItem[]) {
  return sb.from('plano_contingencia').update({ checklist }).eq('id', id).select(SEL_PLANO).single()
}
/** Lê o snapshot de previsão do evento (cache; 1 por evento). */
export async function lerSnapshot(evento_id: string) {
  return sb.from('clima_snapshots').select(SEL_SNAP).eq('evento_id', evento_id).maybeSingle()
}
/** Salva uma previsão MANUAL (degrade sem API/coordenadas). */
export async function salvarSnapshotManual(userId: string, evento_id: string, resumo: ClimaResumo) {
  return sb.from('clima_snapshots').upsert({
    usuario_id: userId, evento_id, fonte: 'manual', dia: resumo.dia,
    previsao: { ...resumo, fonte: 'manual', manual: true }, capturado_em: new Date().toISOString(),
  }, { onConflict: 'evento_id' })
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// ── Classes de input padrão (igual ao resto do painel) ───────────────────────
export const inp = 'w-full rounded-xl border border-black/10 px-3.5 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20'
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
