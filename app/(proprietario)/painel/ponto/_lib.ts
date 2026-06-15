// _lib — modelo, queries, mapeadores e chamadas de API do módulo Ponto & Escala.
// Compartilhado entre a shell (page.tsx) e as abas (_components/*).
// Regra de ouro: NADA de "R$"/percentual/data formatada aqui — só números/datas
// crus; a formatação fica em lib/format. A matemática de horas/cobertura/custo
// vive em lib/ponto (motor puro, testado), re-exportado abaixo p/ um só import.

import { authHeaders } from '@/lib/supabase'
import type { Escala, EscalaAlocacao, Freelancer, PontoRegistro } from '@/lib/ponto'

export type { Escala, EscalaAlocacao, Freelancer, PontoRegistro }

// ── Linhas auxiliares (de outros módulos) ────────────────────────────────────
export type EventoLite = {
  id: string
  nome_evento: string | null
  quem_contratou: string | null
  tipo_evento: string | null
  status: string | null
  data_inicio: string | null
  data_fim: string | null
  propriedade_id: string | null
}
/** Pessoa fixa (tabela `equipe`) — só o necessário p/ escalar e custear. */
export type EquipeLite = {
  id: number
  nome: string
  cargo: string | null
  departamento: string | null
  salario: number
  contrato: string
  status: string
}

// ── Selects (campos exatos pedidos ao Supabase) ──────────────────────────────
export const SEL_FREELANCER = 'id,usuario_id,nome,funcao,contato,email,valor_diaria_num,avaliacao,doc,chave_pix,ativo,obs,criado_em,atualizado_em'
export const SEL_ESCALA = 'id,usuario_id,evento_id,reserva_id,propriedade_id,data,turno,funcao,necessario,valor_diaria_ref_num,status,obs,criado_em,atualizado_em'
export const SEL_ALOC = 'id,usuario_id,escala_id,equipe_id,freelancer_id,inicio_previsto,fim_previsto,valor_diaria_num,status,pago,conta_pagar_id,obs,criado_em,atualizado_em'
export const SEL_PONTO = 'id,usuario_id,alocacao_id,equipe_id,freelancer_id,evento_id,data,entrada,saida,intervalo_min,jornada_min,trabalhado_min,extras_min,noturno_min,atraso_min,saldo_min,origem,local,obs,criado_em'
export const SEL_EVENTO = 'id,nome_evento,quem_contratou,tipo_evento,status,data_inicio,data_fim,propriedade_id'
export const SEL_EQUIPE = 'id,nome,cargo,departamento,salario,contrato,status'

// ── Mapeadores (coerção numérica defensiva) ──────────────────────────────────
/* eslint-disable @typescript-eslint/no-explicit-any */
const n = (v: any): number => { const x = Number(v); return Number.isFinite(x) ? x : 0 }
const nn = (v: any): number | null => { if (v == null || v === '') return null; const x = Number(v); return Number.isFinite(x) ? x : null }

export function mapFreelancer(r: any): Freelancer {
  return {
    id: String(r.id), usuario_id: r.usuario_id, nome: r.nome || '', funcao: r.funcao || 'outro',
    contato: r.contato ?? null, email: r.email ?? null, valor_diaria_num: n(r.valor_diaria_num),
    avaliacao: nn(r.avaliacao), doc: r.doc ?? null, chave_pix: r.chave_pix ?? null,
    ativo: r.ativo !== false, obs: r.obs ?? null, criado_em: r.criado_em ?? undefined, atualizado_em: r.atualizado_em ?? undefined,
  }
}
export function mapEscala(r: any): Escala {
  return {
    id: String(r.id), usuario_id: r.usuario_id, evento_id: r.evento_id ?? null, reserva_id: r.reserva_id ?? null,
    propriedade_id: r.propriedade_id ?? null, data: r.data, turno: r.turno || 'integral', funcao: r.funcao || 'outro',
    necessario: n(r.necessario), valor_diaria_ref_num: n(r.valor_diaria_ref_num), status: r.status || 'planejada',
    obs: r.obs ?? null, criado_em: r.criado_em ?? undefined, atualizado_em: r.atualizado_em ?? undefined,
  }
}
export function mapAloc(r: any): EscalaAlocacao {
  return {
    id: String(r.id), usuario_id: r.usuario_id, escala_id: String(r.escala_id),
    equipe_id: r.equipe_id != null ? Number(r.equipe_id) : null, freelancer_id: r.freelancer_id ?? null,
    inicio_previsto: r.inicio_previsto ?? null, fim_previsto: r.fim_previsto ?? null,
    valor_diaria_num: n(r.valor_diaria_num), status: r.status || 'convocado', pago: !!r.pago,
    conta_pagar_id: r.conta_pagar_id ?? null, obs: r.obs ?? null,
    criado_em: r.criado_em ?? undefined, atualizado_em: r.atualizado_em ?? undefined,
  }
}
export function mapPonto(r: any): PontoRegistro {
  return {
    id: String(r.id), usuario_id: r.usuario_id, alocacao_id: r.alocacao_id ?? null,
    equipe_id: r.equipe_id != null ? Number(r.equipe_id) : null, freelancer_id: r.freelancer_id ?? null,
    evento_id: r.evento_id ?? null, data: r.data, entrada: r.entrada ?? null, saida: r.saida ?? null,
    intervalo_min: n(r.intervalo_min), jornada_min: n(r.jornada_min), trabalhado_min: n(r.trabalhado_min),
    extras_min: n(r.extras_min), noturno_min: n(r.noturno_min), atraso_min: n(r.atraso_min), saldo_min: n(r.saldo_min),
    origem: r.origem || 'manual', local: r.local ?? null, obs: r.obs ?? null, criado_em: r.criado_em ?? undefined,
  }
}
export function mapEquipe(r: any): EquipeLite {
  return {
    id: Number(r.id), nome: r.nome || '', cargo: r.cargo ?? null, departamento: r.departamento ?? null,
    salario: n(r.salario), contrato: r.contrato || 'clt', status: r.status || 'ativo',
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// ── Bag de estado compartilhado entre a shell e as abas ──────────────────────
export type PontoBag = {
  userId: string
  escalas: Escala[]
  alocacoes: EscalaAlocacao[]
  freelancers: Freelancer[]
  registros: PontoRegistro[]
  eventos: EventoLite[]
  equipe: EquipeLite[]
  /** Mapas derivados (montados na shell, memoizados). */
  equipeById: Map<number, EquipeLite>
  freelaById: Map<string, Freelancer>
  eventoById: Map<string, EventoLite>
  /** alocações agrupadas por escala_id. */
  alocsPorEscala: Map<string, EscalaAlocacao[]>
  recarregar: () => Promise<void>
}

// ── Identidade da pessoa numa alocação (fixo × freelancer) ───────────────────
export type Pessoa = { tipo: 'fixo' | 'freelancer'; id: string; nome: string; funcao?: string }
/** Resolve nome/função de uma alocação a partir dos bancos de fixos/freelas. */
export function pessoaDaAloc(
  a: Pick<EscalaAlocacao, 'equipe_id' | 'freelancer_id'>,
  equipeById: Map<number, EquipeLite>,
  freelaById: Map<string, Freelancer>,
): Pessoa {
  if (a.freelancer_id) {
    const f = freelaById.get(a.freelancer_id)
    return { tipo: 'freelancer', id: a.freelancer_id, nome: f?.nome || 'Freelancer', funcao: f?.funcao }
  }
  const e = a.equipe_id != null ? equipeById.get(a.equipe_id) : undefined
  return { tipo: 'fixo', id: String(a.equipe_id ?? ''), nome: e?.nome || 'Colaborador', funcao: e?.cargo || undefined }
}

// ── Helpers de evento ────────────────────────────────────────────────────────
export function eventoLabel(ev: EventoLite | null | undefined): string {
  if (!ev) return 'Evento'
  return ev.nome_evento || ev.quem_contratou || 'Evento sem nome'
}

// ── Detecção de "tabela ainda não criada" (rodar o SQL) ──────────────────────
export { isMissingTable } from '@/lib/dbErrors'

// ── API de alocação (autoritativa: /api/ponto) ───────────────────────────────
export type AlocPayload = {
  escala_id: string
  equipe_id?: number | null
  freelancer_id?: string | null
  inicio_previsto?: string | null
  fim_previsto?: string | null
  valor_diaria_num?: number
  status?: string
  obs?: string | null
  force?: boolean
}
/* eslint-disable @typescript-eslint/no-explicit-any */
export type ApiResult = { ok: boolean; error?: string; status?: number; data?: any; preenchidas?: number; necessario?: number; alocacao_id?: string }
async function call(method: string, body?: unknown, qs = ''): Promise<ApiResult> {
  const res = await fetch(`/api/ponto${qs}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  const json = await res.json().catch(() => ({}))
  return res.ok ? { ok: true, data: json.data } : { ok: false, status: res.status, ...json }
}
export const postAloc = (p: AlocPayload) => call('POST', p)
export const patchAloc = (p: Record<string, unknown>) => call('PATCH', p)
export const deleteAloc = (id: string, hard = false) => call('DELETE', undefined, `?id=${encodeURIComponent(id)}${hard ? '&hard=1' : ''}`)
/* eslint-enable @typescript-eslint/no-explicit-any */

// ── Classe de input padrão (igual ao resto do painel) ────────────────────────
export const inp = 'w-full rounded-xl border border-black/10 px-3.5 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20'
export const selCls = 'rounded-xl border border-black/10 bg-white px-3 py-2 text-sm focus:border-brand focus:outline-none'

// ── Helpers de data ──────────────────────────────────────────────────────────
export function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
/** Combina 'YYYY-MM-DD' + 'HH:MM' num ISO local 'YYYY-MM-DDTHH:MM:00' (sem Z). */
export function combinarDataHora(data: string, hora: string): string | null {
  if (!data || !hora) return null
  return `${data}T${hora.length === 5 ? hora : '00:00'}:00`
}

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
