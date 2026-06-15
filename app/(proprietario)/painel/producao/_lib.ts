// _lib — modelo, queries, mapeadores e chamadas de API do módulo Produção.
// Compartilhado entre a shell (page.tsx) e as abas (_components/*).
// Regra de ouro: NADA de "R$"/percentual/data formatada aqui — só números/datas
// crus; a formatação fica em lib/format. A lógica de prontidão/dependências/
// templates/conflitos vive em lib/producao (motor puro, testado), re-exportada
// abaixo p/ um só import. O "ensure + template" e a CONCLUSÃO de tarefa
// (dependência) passam pela rota AUTORITATIVA /api/producao; o demais (briefing,
// CRUD de tarefas/run-show) é feito pelo client via RLS.

import { supabase as sb, authHeaders } from '@/lib/supabase'
import type { TablesInsert } from '@/types/supabase'
import {
  type Producao, type Tarefa, type RunshowItem, type Briefing, type AnexoRef, type ContatoChave,
  mesclarBriefing,
} from '@/lib/producao'

export type { Producao, Tarefa, RunshowItem, Briefing, AnexoRef, ContatoChave }
export {
  // catálogos / helpers de domínio reusados pelas abas
  CATEGORIAS, RESPONSAVEIS, KANBAN_COLS, PRIORIDADE_META,
  categoriaLabel, categoriaCor, responsavelLabel,
  tarefaStatusMeta, PRODUCAO_STATUS_META,
  tarefaConcluida, tarefaAberta,
  dependenciaPendente, podeConcluir, criaCiclo,
  prontidao, tarefasCriticas, agruparPorStatus, agruparPorCategoria,
  ordenarRunshow, fimMin, duracaoTotalMin, progressoRunshow, conflitosRunshow,
  duracaoLabel, hhmmToMin, minToHHMM, addDiasYMD,
  briefingVazio, mesclarBriefing, briefingSeedDeEvento,
  listarTemplates, templateKeyParaTipo,
  isMissingTable,
} from '@/lib/producao'

// ── Linhas auxiliares (de outros módulos) ────────────────────────────────────
export type EventoLite = {
  id: string
  nome_evento: string | null
  quem_contratou: string | null
  tipo_evento: string | null
  status: string | null
  data_inicio: string | null
  data_fim: string | null
  valor_total_num: number | null
  propriedade_id: number | null
  qtd_adultos: number | null
  qtd_criancas: number | null
  horario_inicio: string | null
}
/** Pessoa fixa (tabela `equipe`). */
export type EquipeLite = { id: number; nome: string; cargo: string | null; departamento: string | null }
/** Fornecedor (tabela `fornecedores`). */
export type FornecedorLite = { id: string; nome: string; fantasia: string | null; categoria: string | null; whatsapp: string | null; email: string | null }
/** Escala e alocação do módulo Ponto (reuso p/ a aba Equipe & Fornecedores). */
export type EscalaLite = { id: string; evento_id: string | null; data: string | null; turno: string | null; funcao: string | null; necessario: number }
export type AlocLite = { id: string; escala_id: string; equipe_id: number | null; freelancer_id: string | null; status: string }
export type FreelancerLite = { id: string; nome: string; funcao: string | null; contato: string | null }

// ── Selects ──────────────────────────────────────────────────────────────────
export const SEL_EVENTO = 'id,nome_evento,quem_contratou,tipo_evento,status,data_inicio,data_fim,valor_total_num,propriedade_id,qtd_adultos,qtd_criancas,horario_inicio'
export const SEL_PROD = 'id,usuario_id,evento_id,status,briefing,observacoes,criado_em,atualizado_em'
export const SEL_TAR = 'id,usuario_id,producao_id,titulo,categoria,responsavel,responsavel_id,responsavel_nome,prazo,status,prioridade,depende_de,obs,anexos,ordem,criado_em,atualizado_em'
export const SEL_RUN = 'id,usuario_id,producao_id,data,horario,duracao_min,atividade,area,responsavel,recurso,obs,concluido,ordem,criado_em,atualizado_em'

// ── Mapeadores (coerção defensiva) ───────────────────────────────────────────
/* eslint-disable @typescript-eslint/no-explicit-any */
const n = (v: any): number => { const x = Number(v); return Number.isFinite(x) ? x : 0 }

export function mapProducao(r: any): Producao {
  return {
    id: String(r.id), usuario_id: r.usuario_id, evento_id: String(r.evento_id),
    status: r.status || 'planejamento', briefing: mesclarBriefing(r.briefing),
    observacoes: r.observacoes ?? null, criado_em: r.criado_em ?? undefined, atualizado_em: r.atualizado_em ?? undefined,
  }
}
export function mapTarefa(r: any): Tarefa {
  const anexos: AnexoRef[] = Array.isArray(r.anexos)
    ? r.anexos.filter((a: any) => a && a.url).map((a: any) => ({ nome: String(a.nome || a.url), url: String(a.url) }))
    : []
  return {
    id: String(r.id), usuario_id: r.usuario_id, producao_id: String(r.producao_id),
    titulo: r.titulo || '', categoria: r.categoria || 'outro', responsavel: r.responsavel || 'producao',
    responsavel_id: r.responsavel_id ?? null, responsavel_nome: r.responsavel_nome ?? null,
    prazo: r.prazo ?? null, status: r.status || 'pendente', prioridade: r.prioridade || 'normal',
    depende_de: r.depende_de ?? null, obs: r.obs ?? null, anexos, ordem: n(r.ordem),
    criado_em: r.criado_em ?? undefined, atualizado_em: r.atualizado_em ?? undefined,
  }
}
export function mapRunshow(r: any): RunshowItem {
  return {
    id: String(r.id), usuario_id: r.usuario_id, producao_id: String(r.producao_id),
    data: r.data ?? null, horario: (r.horario || '00:00').slice(0, 5), duracao_min: n(r.duracao_min),
    atividade: r.atividade || '', area: r.area ?? null, responsavel: r.responsavel ?? null,
    recurso: r.recurso ?? null, obs: r.obs ?? null, concluido: !!r.concluido, ordem: n(r.ordem),
    criado_em: r.criado_em ?? undefined, atualizado_em: r.atualizado_em ?? undefined,
  }
}
export const mapEquipe = (r: any): EquipeLite => ({ id: Number(r.id), nome: r.nome || '', cargo: r.cargo ?? null, departamento: r.departamento ?? null })
export const mapFornecedor = (r: any): FornecedorLite => ({ id: String(r.id), nome: r.nome || '', fantasia: r.fantasia ?? null, categoria: r.categoria ?? null, whatsapp: r.whatsapp ?? null, email: r.email ?? null })
export const mapEscala = (r: any): EscalaLite => ({ id: String(r.id), evento_id: r.evento_id ?? null, data: r.data ?? null, turno: r.turno ?? null, funcao: r.funcao ?? null, necessario: n(r.necessario) })
export const mapAloc = (r: any): AlocLite => ({ id: String(r.id), escala_id: String(r.escala_id), equipe_id: r.equipe_id != null ? Number(r.equipe_id) : null, freelancer_id: r.freelancer_id ?? null, status: r.status || 'convocado' })
export const mapFreelancer = (r: any): FreelancerLite => ({ id: String(r.id), nome: r.nome || '', funcao: r.funcao ?? null, contato: r.contato ?? null })
/* eslint-enable @typescript-eslint/no-explicit-any */

// ── Bag de estado compartilhado entre a shell e as abas ──────────────────────
export type ProducaoBag = {
  userId: string
  evento: EventoLite
  producao: Producao
  tarefas: Tarefa[]
  runshow: RunshowItem[]
  tarefaById: Map<string, Tarefa>
  // reuso de outros módulos (podem vir vazios se as tabelas não existirem)
  equipe: EquipeLite[]
  fornecedores: FornecedorLite[]
  escalas: EscalaLite[]
  alocacoes: AlocLite[]
  freelancers: FreelancerLite[]
  recarregar: () => Promise<void>
}

// ── Helpers de evento ────────────────────────────────────────────────────────
export function eventoLabel(ev: EventoLite | null | undefined): string {
  if (!ev) return 'Evento'
  return ev.nome_evento || ev.quem_contratou || 'Evento sem nome'
}

// ── API autoritativa (/api/producao) ─────────────────────────────────────────
/* eslint-disable @typescript-eslint/no-explicit-any */
export type ApiResult = { ok: boolean; error?: string; status?: number; data?: any; geradas?: { tarefas: number; runshow: number }; dependencia?: string | null }
async function call(method: string, body?: unknown): Promise<ApiResult> {
  const res = await fetch('/api/producao', {
    method,
    headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  const json = await res.json().catch(() => ({}))
  return res.ok ? { ok: true, data: json.data, geradas: json.geradas } : { ok: false, status: res.status, ...json }
}
/** Garante a produção 1:1 do evento e (opcional) aplica o template. */
export const ensureProducao = (evento_id: string, opts: { aplicar_template?: boolean; template?: string; force?: boolean } = {}) =>
  call('POST', { evento_id, ...opts })
/** Atualiza uma tarefa (conclusão respeita dependência; depende_de barra ciclo). */
export const patchTarefa = (p: Record<string, unknown> & { tarefa_id: string }) => call('PATCH', p)

// ── CRUD via RLS (client) — briefing, tarefas e run-show ──────────────────────
export async function salvarProducao(id: string, patch: Partial<{ status: string; briefing: Briefing; observacoes: string | null }>) {
  return sb.from('producao').update(patch).eq('id', id)
}
export async function criarTarefa(row: Record<string, unknown>) {
  return sb.from('producao_tarefas').insert(row as TablesInsert<'producao_tarefas'>).select(SEL_TAR).single()
}
export async function excluirTarefa(id: string) {
  return sb.from('producao_tarefas').delete().eq('id', id)
}
export async function criarRunshow(row: Record<string, unknown>) {
  return sb.from('runshow').insert(row as TablesInsert<'runshow'>).select(SEL_RUN).single()
}
export async function salvarRunshow(id: string, patch: Record<string, unknown>) {
  return sb.from('runshow').update(patch).eq('id', id).select(SEL_RUN).single()
}
export async function excluirRunshow(id: string) {
  return sb.from('runshow').delete().eq('id', id)
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// ── Classes de input padrão (igual ao resto do painel) ───────────────────────
export const inp = 'w-full rounded-xl border border-black/10 px-3.5 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20'
export const selCls = 'rounded-xl border border-black/10 bg-white px-3 py-2 text-sm focus:border-brand focus:outline-none'

// ── Helpers de data ──────────────────────────────────────────────────────────
export function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
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
