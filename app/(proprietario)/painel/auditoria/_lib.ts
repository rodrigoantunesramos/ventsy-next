// Dados e carga da página /painel/auditoria.
// A LÓGICA (filtros, diff, sensibilidade, agregação, CSV, logins suspeitos) vive
// em lib/audit.ts (motor puro, testado). Aqui ficam apenas o tipo de linha do
// banco, a leitura escopada por usuario_id (via RLS — a trilha é só-leitura no
// client) e helpers de UI (premium, hoje, retenção, download).

import { supabaseAny as sb } from '@/lib/supabase'
import { authHeaders } from '@/lib/supabase'
import { logsParaCSV, isMissingTable, type AuditLogLike } from '@/lib/audit'
import type { Json } from '@/types/supabase'

// ── Tipo de linha (espelha docs/sql/auditoria.sql) ───────────────────────────
export type AuditLog = AuditLogLike & {
  id: number
  usuario_id: string
  antes: Json | null
  depois: Json | null
  meta: Json | null
}

export const SEL_AUDIT =
  'id,usuario_id,ator_id,ator_nome,ator_email,acao,entidade,entidade_id,descricao,antes,depois,meta,sensivel,sucesso,ip,user_agent,criado_em'

// Teto de linhas trazidas para a tela (filtros/agregação rodam sobre elas).
export const LIMITE_TELA = 2000
// Teto para a exportação por período (busca dedicada, mais ampla).
export const LIMITE_EXPORT = 10000
export const PAGE_SIZE = 25

// ── Carga (RLS: o dono lê só as próprias linhas) ──────────────────────────────
export type CargaResultado = { ok: boolean; needsSetup: boolean; logs: AuditLog[] }

export async function carregarAuditoria(uid: string, desdeYmd?: string): Promise<CargaResultado> {
  let q = sb.from('auditoria_log').select(SEL_AUDIT).eq('usuario_id', uid)
  if (desdeYmd) q = q.gte('criado_em', `${desdeYmd}T00:00:00`)
  const { data, error } = await q.order('criado_em', { ascending: false }).order('id', { ascending: false }).limit(LIMITE_TELA)
  if (error) {
    if (isMissingTable(error)) return { ok: false, needsSetup: true, logs: [] }
    return { ok: false, needsSetup: false, logs: [] }
  }
  return { ok: true, needsSetup: false, logs: (data as AuditLog[]) || [] }
}

/** Busca dedicada (período fechado) para exportar a trilha completa do intervalo. */
export async function buscarParaExport(uid: string, deYmd: string, ateYmd: string): Promise<AuditLog[]> {
  const { data, error } = await sb.from('auditoria_log').select(SEL_AUDIT)
    .eq('usuario_id', uid)
    .gte('criado_em', `${deYmd}T00:00:00`)
    .lte('criado_em', `${ateYmd}T23:59:59`)
    .order('criado_em', { ascending: false }).order('id', { ascending: false })
    .limit(LIMITE_EXPORT)
  if (error) return []
  return (data as AuditLog[]) || []
}

// ── Premium (Pro+) ────────────────────────────────────────────────────────────
export function isPremium(plano?: string | null): boolean {
  const p = (plano || '').toLowerCase()
  return p === 'pro' || p === 'ultra'
}

// ── Hoje (YYYY-MM-DD, local) ──────────────────────────────────────────────────
export function hojeYmd(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

// ── Retenção (configurável, persistida em localStorage) ───────────────────────
export const RETENCAO_KEY = 'ventsy_auditoria_retencao_dias'
export const RETENCAO_OPCOES: { v: number; label: string }[] = [
  { v: 90, label: '90 dias' },
  { v: 180, label: '6 meses' },
  { v: 365, label: '1 ano' },
  { v: 730, label: '2 anos' },
  { v: 1825, label: '5 anos' },
]
export const RETENCAO_PADRAO = 365

export function lerRetencao(): number {
  if (typeof window === 'undefined') return RETENCAO_PADRAO
  const n = Number(window.localStorage.getItem(RETENCAO_KEY))
  return Number.isFinite(n) && n > 0 ? n : RETENCAO_PADRAO
}
export function salvarRetencao(dias: number): void {
  try { window.localStorage.setItem(RETENCAO_KEY, String(dias)) } catch { /* indisponível */ }
}

// ── Download de CSV (a serialização é pura em lib/audit) ──────────────────────
export function baixarCSV(logs: AuditLog[], sufixo = ''): void {
  const csv = logsParaCSV(logs)
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `auditoria-${sufixo || hojeYmd()}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ── POST para a rota de auditoria (expurgo de retenção) ───────────────────────
export async function expurgarRetencao(dias: number): Promise<{ ok: boolean; removidos: number }> {
  try {
    const res = await fetch('/api/auditoria', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
      body: JSON.stringify({ action: 'expurgar', dias }),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) return { ok: false, removidos: 0 }
    return { ok: true, removidos: Number(json.removidos) || 0 }
  } catch {
    return { ok: false, removidos: 0 }
  }
}

// ── Bag compartilhada entre as abas ───────────────────────────────────────────
export type Ator = { id: string; nome: string; email: string }

export type AuditBag = {
  userId: string
  hoje: string
  logs: AuditLog[]          // os logs carregados (escopo da tela)
  atores: Ator[]            // atores distintos (para o filtro)
  entidades: string[]       // entidades distintas presentes (para o filtro)
  recarregar: () => Promise<void>
}
