// _lib — tipos e helpers só do módulo Licenças (/painel/licencas).
// A lógica de domínio (status/semáforo/prontidão/templates) vive em
// lib/licencas.ts (pura e testada). Aqui ficam: os tipos de vínculo
// (evento/propriedade/checklist), o form da licença, o upload de documentos
// (reusa o bucket `documentos`), o export CSV e os wrappers da /api/licencas.
// Regra de ouro: NADA de "R$"/percentual/data formatada para EXIBIÇÃO aqui —
// só dados crus; a formatação fica em lib/format, na página/componentes.

import { supabaseAny as sb, authHeaders } from '@/lib/supabase'
import type { ExigenciaTemplate, Licenca, TipoLicenca } from '@/lib/licencas'

// ── Contexto compartilhado passado às abas (page → seções) ───────────────────
export type LicencasCtx = {
  userId: string
  hoje: string                                  // 'YYYY-MM-DD' (injetado p/ a engine)
  licencas: Licenca[]
  propriedades: PropriedadeLite[]
  eventos: EventoLite[]
  checklists: ChecklistRow[]                     // biblioteca customizada (compliance_checklists)
  propNome: (id: number | null) => string
  eventoNome: (id: string | null) => string
  reload: () => Promise<void>                    // recarrega licencas
  reloadChecklists: () => Promise<void>          // recarrega compliance_checklists
}

// ── Vínculos (subconjuntos do schema) ────────────────────────────────────────
export type EventoLite = {
  id: string
  nome_evento: string | null
  quem_contratou: string | null
  tipo_evento: string | null
  status: string | null
  data_inicio: string | null
  propriedade_id: number | null
  qtd_adultos: number | null
  qtd_criancas: number | null
}
export const SEL_EVENTO =
  'id,nome_evento,quem_contratou,tipo_evento,status,data_inicio,propriedade_id,qtd_adultos,qtd_criancas'
export function eventoLabel(e: EventoLite | null | undefined): string {
  if (!e) return '—'
  return e.nome_evento || e.quem_contratou || e.tipo_evento || 'Evento sem nome'
}
/** Público estimado do evento (adultos + crianças). */
export function publicoEvento(e: EventoLite | null | undefined): number {
  if (!e) return 0
  return (Number(e.qtd_adultos) || 0) + (Number(e.qtd_criancas) || 0)
}

export type PropriedadeLite = { id: number; nome: string | null; cidade: string | null; estado: string | null }
export const SEL_PROP = 'id,nome,cidade,estado'
export function propriedadeLabel(p: PropriedadeLite | null | undefined): string {
  if (!p) return 'Sem propriedade'
  return p.nome || `Propriedade #${p.id}`
}

// compliance_checklists (biblioteca customizada do dono)
export type ChecklistRow = {
  id: string
  usuario_id?: string
  nome: string
  tipo_evento: string | null
  itens: ExigenciaTemplate[]
  criado_em?: string
}
export const SEL_CHECKLIST = 'id,usuario_id,nome,tipo_evento,itens,criado_em'
export function mapChecklist(r: Record<string, unknown>): ChecklistRow {
  return {
    id: String(r.id),
    nome: String(r.nome || ''),
    tipo_evento: (r.tipo_evento as string) ?? null,
    itens: Array.isArray(r.itens) ? (r.itens as ExigenciaTemplate[]) : [],
    criado_em: r.criado_em as string | undefined,
  }
}

// ── Colunas + mapper da licença ──────────────────────────────────────────────
export const SEL_LIC =
  'id,usuario_id,propriedade_id,escopo,evento_id,tipo,titulo,orgao,orgao_contato,numero,protocolo,emissao,validade,dias_aviso,custo_num,status,obrigatorio,responsavel,documento_url,documento_nome,lancamento_id,obs,criado_em,atualizado_em'

export function mapLicenca(r: Record<string, unknown>): Licenca {
  return {
    id: String(r.id),
    usuario_id: r.usuario_id as string | undefined,
    propriedade_id: r.propriedade_id == null ? null : Number(r.propriedade_id),
    escopo: String(r.escopo || 'permanente'),
    evento_id: (r.evento_id as string) ?? null,
    tipo: String(r.tipo || 'outro'),
    titulo: (r.titulo as string) ?? null,
    orgao: (r.orgao as string) ?? null,
    orgao_contato: (r.orgao_contato as string) ?? null,
    numero: (r.numero as string) ?? null,
    protocolo: (r.protocolo as string) ?? null,
    emissao: (r.emissao as string) ?? null,
    validade: (r.validade as string) ?? null,
    dias_aviso: Number(r.dias_aviso ?? 60),
    custo_num: r.custo_num == null ? null : Number(r.custo_num),
    status: String(r.status || 'em_processo'),
    obrigatorio: r.obrigatorio !== false,
    responsavel: (r.responsavel as string) ?? null,
    documento_url: (r.documento_url as string) ?? null,
    documento_nome: (r.documento_nome as string) ?? null,
    lancamento_id: r.lancamento_id == null ? null : Number(r.lancamento_id),
    obs: (r.obs as string) ?? null,
    criado_em: r.criado_em as string | undefined,
    atualizado_em: r.atualizado_em as string | undefined,
  }
}

// ── Form da licença (CRUD via RLS direto no client) ──────────────────────────
export type LicForm = {
  escopo: 'permanente' | 'evento'
  evento_id: string | null
  propriedade_id: string          // '' = nenhuma
  tipo: TipoLicenca | string
  titulo: string
  orgao: string
  orgao_contato: string
  numero: string
  protocolo: string
  emissao: string
  validade: string
  dias_aviso: string
  custo: string                   // número cru (sem moeda) — string no input
  status: string
  obrigatorio: boolean
  responsavel: string
  obs: string
}

export function emptyLicForm(escopo: 'permanente' | 'evento' = 'permanente', evento_id: string | null = null): LicForm {
  return {
    escopo, evento_id,
    propriedade_id: '', tipo: escopo === 'permanente' ? 'funcionamento' : 'evento_publico',
    titulo: '', orgao: '', orgao_contato: '', numero: '', protocolo: '',
    emissao: '', validade: '', dias_aviso: '60', custo: '',
    status: escopo === 'permanente' ? 'vigente' : 'em_processo',
    obrigatorio: escopo === 'evento', responsavel: '', obs: '',
  }
}

export function licToForm(l: Licenca): LicForm {
  return {
    escopo: (l.escopo === 'evento' ? 'evento' : 'permanente'),
    evento_id: l.evento_id,
    propriedade_id: l.propriedade_id == null ? '' : String(l.propriedade_id),
    tipo: l.tipo,
    titulo: l.titulo || '',
    orgao: l.orgao || '',
    orgao_contato: l.orgao_contato || '',
    numero: l.numero || '',
    protocolo: l.protocolo || '',
    emissao: l.emissao || '',
    validade: l.validade || '',
    dias_aviso: String(l.dias_aviso ?? 60),
    custo: l.custo_num == null ? '' : String(l.custo_num),
    status: l.status,
    obrigatorio: l.obrigatorio,
    responsavel: l.responsavel || '',
    obs: l.obs || '',
  }
}

/** Payload para insert/update em `licencas` (via RLS). Não inclui usuario_id (set no insert). */
export function formToPayload(f: LicForm): Record<string, unknown> {
  const t = (v: string) => (v.trim() ? v.trim() : null)
  return {
    escopo: f.escopo,
    evento_id: f.escopo === 'evento' ? f.evento_id : null,
    propriedade_id: f.propriedade_id ? Number(f.propriedade_id) : null,
    tipo: f.tipo,
    titulo: t(f.titulo),
    orgao: t(f.orgao),
    orgao_contato: t(f.orgao_contato),
    numero: t(f.numero),
    protocolo: t(f.protocolo),
    emissao: f.emissao || null,
    validade: f.validade || null,
    dias_aviso: Math.max(0, Number(f.dias_aviso) || 60),
    custo_num: f.custo.trim() === '' ? null : Math.max(0, Number(f.custo) || 0),
    status: f.status,
    obrigatorio: !!f.obrigatorio,
    responsavel: t(f.responsavel),
    obs: t(f.obs),
  }
}

// ── Documentos no Storage (reusa o bucket `documentos`) ──────────────────────
export const BUCKET = 'documentos'

export type UploadDocResult = { documento_url: string; documento_nome: string }
export async function uploadDocumento(uid: string, file: File): Promise<UploadDocResult> {
  const ext = file.name.includes('.') ? '.' + file.name.split('.').pop() : ''
  const path = `${uid}/licencas/${crypto.randomUUID()}${ext}`
  const { error } = await sb.storage.from(BUCKET).upload(path, file, { upsert: false, contentType: file.type || undefined })
  if (error) throw error
  return { documento_url: path, documento_nome: file.name }
}
export async function signedUrl(path: string | null, expiresIn = 3600): Promise<string | null> {
  if (!path) return null
  const { data, error } = await sb.storage.from(BUCKET).createSignedUrl(path, expiresIn)
  if (error) return null
  return data?.signedUrl ?? null
}
export async function removeDocumento(path: string | null): Promise<void> {
  if (!path) return
  await sb.storage.from(BUCKET).remove([path])
}

// ── Wrappers da /api/licencas ────────────────────────────────────────────────
type ApiResult<T> = { ok: true; data: T; extra?: Record<string, unknown> } | { ok: false; status: number; error: string; data?: unknown }

async function postApi<T = unknown>(payload: Record<string, unknown>): Promise<ApiResult<T>> {
  try {
    const res = await fetch('/api/licencas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
      body: JSON.stringify(payload),
    })
    const j = await res.json().catch(() => ({}))
    if (!res.ok) return { ok: false, status: res.status, error: j.error || 'Erro', data: j.data }
    return { ok: true, data: j.data as T, extra: j }
  } catch (e) {
    return { ok: false, status: 0, error: e instanceof Error ? e.message : 'Falha de rede' }
  }
}

export function apiAplicarChecklist(evento_id: string, itens: ExigenciaTemplate[], publico: number, force = false) {
  return postApi<Licenca[]>({ action: 'aplicar_checklist', evento_id, itens, publico, force })
}
export function apiLancarCusto(licenca_id: string) {
  return postApi<Licenca>({ action: 'lancar_custo', licenca_id })
}
export function apiEstornarCusto(licenca_id: string) {
  return postApi<Licenca>({ action: 'estornar_custo', licenca_id })
}

// ── Export CSV (datas/números crus, sem moeda formatada) ─────────────────────
import {
  type Licenca as L, tipoLabel, statusMeta, ESCOPO_META,
} from '@/lib/licencas'

export function exportLicencasCSV(
  licencas: L[],
  propNome: (id: number | null) => string,
  eventoNome: (id: string | null) => string,
): void {
  const esc = (s: string | number) => `"${String(s ?? '').replace(/"/g, '""')}"`
  const header = ['Escopo', 'Tipo', 'Título', 'Propriedade', 'Evento', 'Órgão', 'Número', 'Protocolo', 'Emissão', 'Validade', 'Custo', 'Status', 'Obrigatória', 'Responsável']
  const linhas = licencas.map((l) => [
    ESCOPO_META[(l.escopo as 'permanente' | 'evento')]?.label || l.escopo,
    tipoLabel(l.tipo),
    l.titulo || tipoLabel(l.tipo),
    propNome(l.propriedade_id),
    l.escopo === 'evento' ? eventoNome(l.evento_id) : '',
    l.orgao || '',
    l.numero || '',
    l.protocolo || '',
    l.emissao || '',
    l.validade || '',
    l.custo_num ?? '',
    statusMeta(l.status).label,
    l.obrigatorio ? 'Sim' : 'Não',
    l.responsavel || '',
  ])
  const body = linhas.map((l) => l.map(esc).join(',')).join('\n')
  const blob = new Blob(['﻿' + header.map(esc).join(',') + '\n' + body], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `licencas-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
