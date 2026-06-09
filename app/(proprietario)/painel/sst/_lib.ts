// _lib — modelo, queries, mapeadores e chamadas do módulo SST.
// Compartilhado entre a shell (page.tsx) e as abas (_components/*).
// Regra de ouro: NADA de "R$"/percentual/data formatada aqui — só dados crus; a
// formatação fica em lib/format. A engine (dimensionamento, cobertura,
// indicadores, validade, templates) vive em lib/sst (pura, testada), re-exportada
// abaixo p/ um só import. O dimensionamento autoritativo passa por /api/sst; o
// restante do CRUD é feito pelo client via RLS.

import { supabaseAny as sb, authHeaders } from '@/lib/supabase'
import {
  type PlanoTipo, type PlanoStatus, type RecursoTipo, type RecursoStatus,
  type OcorrenciaTipo, type Gravidade, type SimuladoTipo, type Risco,
  type PlanoConteudo, type RecursoExigido, type RecursoEventoLite,
  normalizarConteudo, gerarConteudoPlano,
} from '@/lib/sst'

export type {
  PlanoTipo, PlanoStatus, RecursoTipo, RecursoStatus, OcorrenciaTipo, Gravidade,
  SimuladoTipo, Risco, PlanoConteudo, RecursoExigido, RecursoEventoLite,
}
export {
  // catálogos / engine reusados pelas abas (um só import)
  PLANO_TIPOS, PLANO_TIPO_META, planoTipoMeta, PLANO_STATUS_META, planoStatusMeta,
  RECURSO_TIPOS, RECURSO_META, recursoMeta, RECURSO_STATUS_META, recursoStatusMeta, STATUS_GARANTIDO,
  OCORRENCIA_TIPOS, ocorrenciaTipoMeta, GRAVIDADES, GRAVIDADE_META, gravidadeMeta, exigeCAT,
  SIMULADO_TIPOS, simuladoTipoMeta, RISCOS, RISCO_META, riscoMeta,
  NR_CATALOGO, nrMeta, VALIDADE_META, validadeMeta, validadeStatus,
  NIVEL_SST_META, nivelSSTMeta, nivelGeralSST,
  dimensionarPorPublico, coberturaRecursos, prontidaoEvento, indicadoresOcorrencias,
  gerarConteudoPlano, normalizarConteudo, completudePlano, CONTATOS_EMERGENCIA,
  diaDe, addDiasYMD, diffDiasYMD, isMissingTable,
} from '@/lib/sst'

// ── Linhas auxiliares (de outros módulos) ────────────────────────────────────
export type EventoLite = {
  id: string
  nome_evento: string | null
  quem_contratou: string | null
  tipo_evento: string | null
  status: string | null
  data_inicio: string | null
  data_fim: string | null
  publico: number | null            // estimativa de público (capacidade/convidados)
  propriedade_id: number | null
}
export type PropriedadeLite = {
  id: number
  nome: string | null
  cidade: string | null
  estado: string | null
  capacidade: number | null
  area_m2: number | null
}
export type EquipeLite = { id: number; nome: string; cargo: string | null }
export type FornecedorLite = { id: string; nome: string }

/** Feedback ao usuário (mesma API de components/Toast). */
export type Toast = { success: (m: string) => void; error: (m: string) => void; info: (m: string) => void }

/** Contexto compartilhado pela shell com as abas (catálogos + identidade + hoje). */
export type SstCtx = {
  userId: string
  hoje: string
  eventos: EventoLite[]
  propriedades: PropriedadeLite[]
  equipe: EquipeLite[]
  fornecedores: FornecedorLite[]
}

// ── Selects ──────────────────────────────────────────────────────────────────
export const SEL_EVENTO = 'id,nome_evento,quem_contratou,tipo_evento,status,data_inicio,data_fim,qtd_adultos,qtd_criancas,propriedade_id'
export const SEL_PROP = 'id,nome,cidade,estado,capacidade'
export const SEL_PLANO = 'id,usuario_id,propriedade_id,evento_id,tipo,nome,conteudo,responsavel,validade,status,obs,criado_em,atualizado_em'
export const SEL_RECURSO = 'id,usuario_id,evento_id,tipo,exigido,quantidade,obrigatorio,status,origem,fornecedor_id,base,obs,criado_em,atualizado_em'
export const SEL_OCORR = 'id,usuario_id,evento_id,propriedade_id,tipo,gravidade,descricao,pessoa,local,atendimento,data,cat_emitida,anexos,criado_em'
export const SEL_EPI = 'id,usuario_id,nome,ca,quantidade,funcao,validade_ca,obs,criado_em,atualizado_em'
export const SEL_TREIN = 'id,usuario_id,equipe_id,pessoa,nr,instituicao,emissao,validade,certificado_url,obs,criado_em,atualizado_em'
export const SEL_SIM = 'id,usuario_id,propriedade_id,evento_id,tipo,data,participantes,tempo_seg,resultado,responsavel,observacoes,proxima_data,criado_em,atualizado_em'

// ── Linhas das tabelas SST ────────────────────────────────────────────────────
export type PlanoRow = {
  id: string; usuario_id: string; propriedade_id: number | null; evento_id: string | null
  tipo: PlanoTipo | string; nome: string; conteudo: PlanoConteudo
  responsavel: string | null; validade: string | null; status: PlanoStatus | string; obs: string | null
  criado_em?: string; atualizado_em?: string
}
export type RecursoRow = {
  id: string; usuario_id: string; evento_id: string
  tipo: RecursoTipo | string; exigido: number; quantidade: number; obrigatorio: boolean
  status: RecursoStatus | string; origem: 'dimensionamento' | 'manual' | string
  fornecedor_id: string | null; base: string | null; obs: string | null
  criado_em?: string; atualizado_em?: string
}
export type OcorrenciaRow = {
  id: string; usuario_id: string; evento_id: string | null; propriedade_id: number | null
  tipo: OcorrenciaTipo | string; gravidade: Gravidade | string; descricao: string
  pessoa: string | null; local: string | null; atendimento: string | null
  data: string; cat_emitida: boolean; anexos: unknown[]; criado_em?: string
}
export type EpiRow = {
  id: string; usuario_id: string; nome: string; ca: string | null; quantidade: number
  funcao: string | null; validade_ca: string | null; obs: string | null
  criado_em?: string; atualizado_em?: string
}
export type TreinamentoRow = {
  id: string; usuario_id: string; equipe_id: number | null; pessoa: string | null
  nr: string; instituicao: string | null; emissao: string | null; validade: string | null
  certificado_url: string | null; obs: string | null; criado_em?: string; atualizado_em?: string
}
export type SimuladoRow = {
  id: string; usuario_id: string; propriedade_id: number | null; evento_id: string | null
  tipo: SimuladoTipo | string; data: string; participantes: number; tempo_seg: number | null
  resultado: 'satisfatorio' | 'parcial' | 'insatisfatorio' | string; responsavel: string | null
  observacoes: string | null; proxima_data: string | null; criado_em?: string; atualizado_em?: string
}

// ── Mapeadores (coerção defensiva) ───────────────────────────────────────────
/* eslint-disable @typescript-eslint/no-explicit-any */
const num = (v: any): number => { const x = Number(v); return Number.isFinite(x) ? x : 0 }
const numN = (v: any): number | null => { if (v == null || v === '') return null; const x = Number(v); return Number.isFinite(x) ? x : null }

export const mapEvento = (r: any): EventoLite => {
  // clientes_eventos não tem coluna única de público — somamos adultos+crianças.
  const ad = numN(r.qtd_adultos); const cr = numN(r.qtd_criancas)
  const publico = ad == null && cr == null ? null : (ad || 0) + (cr || 0)
  return {
    id: String(r.id), nome_evento: r.nome_evento ?? null, quem_contratou: r.quem_contratou ?? null,
    tipo_evento: r.tipo_evento ?? null, status: r.status ?? null,
    data_inicio: r.data_inicio ?? null, data_fim: r.data_fim ?? null,
    publico, propriedade_id: r.propriedade_id != null ? Number(r.propriedade_id) : null,
  }
}
export const mapProp = (r: any): PropriedadeLite => ({
  // propriedades tem `capacidade`, mas não `area_m2` (essa vive em `espacos`).
  id: Number(r.id), nome: r.nome ?? null, cidade: r.cidade ?? null, estado: r.estado ?? null,
  capacidade: numN(r.capacidade), area_m2: null,
})
export const mapEquipe = (r: any): EquipeLite => ({ id: Number(r.id), nome: r.nome || '', cargo: r.cargo ?? null })

export const mapPlano = (r: any): PlanoRow => ({
  id: String(r.id), usuario_id: r.usuario_id, propriedade_id: r.propriedade_id != null ? Number(r.propriedade_id) : null,
  evento_id: r.evento_id != null ? String(r.evento_id) : null,
  tipo: r.tipo || 'emergencia', nome: r.nome || '', conteudo: normalizarConteudo(r.conteudo),
  responsavel: r.responsavel ?? null, validade: r.validade ?? null, status: r.status || 'rascunho', obs: r.obs ?? null,
  criado_em: r.criado_em, atualizado_em: r.atualizado_em,
})
export const mapRecurso = (r: any): RecursoRow => ({
  id: String(r.id), usuario_id: r.usuario_id, evento_id: String(r.evento_id),
  tipo: r.tipo, exigido: num(r.exigido), quantidade: num(r.quantidade), obrigatorio: !!r.obrigatorio,
  status: r.status || 'previsto', origem: r.origem || 'manual',
  fornecedor_id: r.fornecedor_id ?? null, base: r.base ?? null, obs: r.obs ?? null,
  criado_em: r.criado_em, atualizado_em: r.atualizado_em,
})
export const mapOcorrencia = (r: any): OcorrenciaRow => ({
  id: String(r.id), usuario_id: r.usuario_id, evento_id: r.evento_id != null ? String(r.evento_id) : null,
  propriedade_id: r.propriedade_id != null ? Number(r.propriedade_id) : null,
  tipo: r.tipo || 'incidente', gravidade: r.gravidade || 'leve', descricao: r.descricao || '',
  pessoa: r.pessoa ?? null, local: r.local ?? null, atendimento: r.atendimento ?? null,
  data: r.data || r.criado_em || '', cat_emitida: !!r.cat_emitida,
  anexos: Array.isArray(r.anexos) ? r.anexos : [], criado_em: r.criado_em,
})
export const mapEpi = (r: any): EpiRow => ({
  id: String(r.id), usuario_id: r.usuario_id, nome: r.nome || '', ca: r.ca ?? null, quantidade: num(r.quantidade),
  funcao: r.funcao ?? null, validade_ca: r.validade_ca ?? null, obs: r.obs ?? null,
  criado_em: r.criado_em, atualizado_em: r.atualizado_em,
})
export const mapTreinamento = (r: any): TreinamentoRow => ({
  id: String(r.id), usuario_id: r.usuario_id, equipe_id: r.equipe_id != null ? Number(r.equipe_id) : null,
  pessoa: r.pessoa ?? null, nr: r.nr || 'outro', instituicao: r.instituicao ?? null,
  emissao: r.emissao ?? null, validade: r.validade ?? null, certificado_url: r.certificado_url ?? null, obs: r.obs ?? null,
  criado_em: r.criado_em, atualizado_em: r.atualizado_em,
})
export const mapSimulado = (r: any): SimuladoRow => ({
  id: String(r.id), usuario_id: r.usuario_id, propriedade_id: r.propriedade_id != null ? Number(r.propriedade_id) : null,
  evento_id: r.evento_id != null ? String(r.evento_id) : null,
  tipo: r.tipo || 'evacuacao', data: r.data || '', participantes: num(r.participantes), tempo_seg: numN(r.tempo_seg),
  resultado: r.resultado || 'satisfatorio', responsavel: r.responsavel ?? null,
  observacoes: r.observacoes ?? null, proxima_data: r.proxima_data ?? null,
  criado_em: r.criado_em, atualizado_em: r.atualizado_em,
})
/* eslint-enable @typescript-eslint/no-explicit-any */

// ── Helpers de evento ────────────────────────────────────────────────────────
export function eventoLabel(ev: EventoLite | null | undefined): string {
  if (!ev) return 'Evento'
  return ev.nome_evento || ev.quem_contratou || 'Evento sem nome'
}

// ── Carga de catálogos (eventos / propriedades / equipe / fornecedores) ──────
export async function carregarCatalogos(uid: string): Promise<{
  eventos: EventoLite[]; propriedades: PropriedadeLite[]; equipe: EquipeLite[]; fornecedores: FornecedorLite[]
}> {
  const [evRes, propRes, eqRes, foRes] = await Promise.all([
    sb.from('clientes_eventos').select(SEL_EVENTO).eq('usuario_id', uid).order('data_inicio', { ascending: false, nullsFirst: false }),
    sb.from('propriedades').select(SEL_PROP).eq('usuario_id', uid).order('nome'),
    sb.from('equipe').select('id,nome,cargo').eq('usuario_id', uid).order('nome'),
    sb.from('fornecedores').select('id,nome').eq('usuario_id', uid).order('nome'),
  ])
  return {
    eventos: (evRes.data || []).map(mapEvento),
    propriedades: propRes.error ? [] : (propRes.data || []).map(mapProp),
    equipe: eqRes.error ? [] : (eqRes.data || []).map(mapEquipe),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    fornecedores: foRes.error ? [] : (foRes.data || []).map((r: any) => ({ id: String(r.id), nome: r.nome || '' })),
  }
}

// ── CRUD via RLS (client) ─────────────────────────────────────────────────────
/* eslint-disable @typescript-eslint/no-explicit-any */
// Planos
export const listarPlanos = (uid: string) =>
  sb.from('sst_planos').select(SEL_PLANO).eq('usuario_id', uid).order('atualizado_em', { ascending: false })
export const criarPlano = (row: Record<string, unknown>) => sb.from('sst_planos').insert(row).select(SEL_PLANO).single()
export const salvarPlano = (id: string, patch: Record<string, unknown>) => sb.from('sst_planos').update(patch).eq('id', id).select(SEL_PLANO).single()
export const excluirPlano = (id: string) => sb.from('sst_planos').delete().eq('id', id)

// Recursos por evento
export const listarRecursos = (uid: string, eventoId: string) =>
  sb.from('sst_recursos_evento').select(SEL_RECURSO).eq('usuario_id', uid).eq('evento_id', eventoId).order('criado_em')
// Todos os recursos do dono (Painel: prontidão por evento numa só query)
export const listarRecursosTodos = (uid: string) =>
  sb.from('sst_recursos_evento').select(SEL_RECURSO).eq('usuario_id', uid)
export const salvarRecurso = (id: string, patch: Record<string, unknown>) => sb.from('sst_recursos_evento').update(patch).eq('id', id).select(SEL_RECURSO).single()
export const criarRecurso = (row: Record<string, unknown>) => sb.from('sst_recursos_evento').insert(row).select(SEL_RECURSO).single()
export const excluirRecurso = (id: string) => sb.from('sst_recursos_evento').delete().eq('id', id)

// Ocorrências
export const listarOcorrencias = (uid: string) =>
  sb.from('sst_ocorrencias').select(SEL_OCORR).eq('usuario_id', uid).order('data', { ascending: false })
export const criarOcorrencia = (row: Record<string, unknown>) => sb.from('sst_ocorrencias').insert(row).select(SEL_OCORR).single()
export const salvarOcorrencia = (id: string, patch: Record<string, unknown>) => sb.from('sst_ocorrencias').update(patch).eq('id', id).select(SEL_OCORR).single()
export const excluirOcorrencia = (id: string) => sb.from('sst_ocorrencias').delete().eq('id', id)

// EPIs
export const listarEpis = (uid: string) => sb.from('sst_epis').select(SEL_EPI).eq('usuario_id', uid).order('nome')
export const criarEpi = (row: Record<string, unknown>) => sb.from('sst_epis').insert(row).select(SEL_EPI).single()
export const salvarEpi = (id: string, patch: Record<string, unknown>) => sb.from('sst_epis').update(patch).eq('id', id).select(SEL_EPI).single()
export const excluirEpi = (id: string) => sb.from('sst_epis').delete().eq('id', id)

// Treinamentos / NRs
export const listarTreinamentos = (uid: string) => sb.from('sst_treinamentos').select(SEL_TREIN).eq('usuario_id', uid).order('validade', { ascending: true, nullsFirst: false })
export const criarTreinamento = (row: Record<string, unknown>) => sb.from('sst_treinamentos').insert(row).select(SEL_TREIN).single()
export const salvarTreinamento = (id: string, patch: Record<string, unknown>) => sb.from('sst_treinamentos').update(patch).eq('id', id).select(SEL_TREIN).single()
export const excluirTreinamento = (id: string) => sb.from('sst_treinamentos').delete().eq('id', id)

// Simulados / inspeções
export const listarSimulados = (uid: string) => sb.from('sst_simulados').select(SEL_SIM).eq('usuario_id', uid).order('data', { ascending: false })
export const criarSimulado = (row: Record<string, unknown>) => sb.from('sst_simulados').insert(row).select(SEL_SIM).single()
export const salvarSimulado = (id: string, patch: Record<string, unknown>) => sb.from('sst_simulados').update(patch).eq('id', id).select(SEL_SIM).single()
export const excluirSimulado = (id: string) => sb.from('sst_simulados').delete().eq('id', id)
/* eslint-enable @typescript-eslint/no-explicit-any */

// ── API autoritativa de dimensionamento (/api/sst) ───────────────────────────
export type DimensionarResult = {
  ok: boolean
  recursos?: RecursoRow[]
  error?: string
  status?: number
}
/**
 * Aplica o dimensionamento por público a um evento: a /api/sst calcula os
 * recursos exigidos (lib/sst) e faz upsert idempotente das linhas com
 * origem='dimensionamento'. Retorna as linhas resultantes do evento.
 */
export async function aplicarDimensionamento(input: {
  evento_id: string
  publico: number
  area_m2?: number | null
  risco?: Risco
  alcool?: boolean
  palco?: boolean
}): Promise<DimensionarResult> {
  try {
    const res = await fetch('/api/sst', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
      body: JSON.stringify({ op: 'aplicar_dimensionamento', ...input }),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) return { ok: false, error: json.error, status: res.status }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return { ok: true, recursos: (json.data?.recursos || []).map((r: any) => mapRecurso(r)) }
  } catch (e) {
    return { ok: false, error: (e as Error)?.message }
  }
}

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
