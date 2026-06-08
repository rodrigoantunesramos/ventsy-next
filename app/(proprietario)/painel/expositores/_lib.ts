// _lib — modelo, queries, mapeadores e chamadas de API do módulo Expositores.
// Compartilhado entre a shell (page.tsx) e as abas (_components/*).
// Regra de ouro: NADA de "R$"/percentual/data formatada aqui — só números/datas
// crus; a formatação fica em lib/format. A lógica de receita/%-vendido/
// entregáveis/transições vive em lib/expositores (motor puro, testado),
// re-exportada abaixo p/ um só import. A COMERCIALIZAÇÃO do estande e a RECEITA
// no financeiro passam pela rota AUTORITATIVA /api/expositores; o CRUD demais
// (criar estande/expositor/cota, marcar entregável) é feito pelo client via RLS.

import { supabaseAny as sb, authHeaders } from '@/lib/supabase'
import {
  type Estande, type Expositor, type Cota, type Patrocinador,
  type Posicao, type Necessidades, type Entregavel, type EntregavelStatus,
} from '@/lib/expositores'

export type { Estande, Expositor, Cota, Patrocinador, Posicao, Necessidades, Entregavel, EntregavelStatus }
export {
  // catálogos / metadados de domínio reusados pelas abas
  ESTANDE_STATUS_META, estandeStatusMeta, ESTANDE_TIPOS, estandeTipoLabel,
  EXPOSITOR_STATUS_META, expositorStatusMeta, PATROCINADOR_STATUS_META, patrocinadorStatusMeta,
  COTA_PRESETS,
  // cálculo
  precoEstande, estandeOcupado, resumoMapa, podeTransicionarEstande, exigeExpositor,
  normalizarPosicao, boundsDosEstandes, autoLayout, CELULA,
  resumoCota, cotaTemVaga, resumoPatrocinio, receitaPatrocinador, patrocinadoresVendidos,
  progressoEntregaveis, marcarEntregavel,
  receitaEvento, progressoMeta,
  isMissingTable,
} from '@/lib/expositores'

// ── Evento (feira/expo) — linha de clientes_eventos ──────────────────────────
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
}
export const SEL_EVENTO = 'id,nome_evento,quem_contratou,tipo_evento,status,data_inicio,data_fim,valor_total_num,propriedade_id'

// ── Selects ──────────────────────────────────────────────────────────────────
export const SEL_ESTANDE = 'id,usuario_id,evento_id,codigo,tipo,area_m2,preco_num,status,expositor_id,posicao,cor,obs,criado_em,atualizado_em'
export const SEL_EXPOSITOR = 'id,usuario_id,evento_id,empresa,contato,email,telefone,doc,estande_id,contrato_id,credencial_id,lancamento_id,valor_num,status,necessidades,obs,criado_em,atualizado_em'
export const SEL_COTA = 'id,usuario_id,evento_id,nome,preco_num,quantidade,cor,ordem,entregaveis,obs,criado_em,atualizado_em'
export const SEL_PATRO = 'id,usuario_id,evento_id,cota_id,marca,contato,email,telefone,contrato_id,lancamento_id,valor_num,status,entregaveis_status,obs,criado_em,atualizado_em'

// ── Mapeadores (coerção defensiva de jsonb/numéricos) ────────────────────────
/* eslint-disable @typescript-eslint/no-explicit-any */
const n = (v: any): number => { const x = Number(v); return Number.isFinite(x) ? x : 0 }
const nOrNull = (v: any): number | null => (v == null || v === '' ? null : n(v))

export function mapEstande(r: any): Estande {
  const p = r.posicao && typeof r.posicao === 'object' ? r.posicao : {}
  return {
    id: String(r.id), usuario_id: r.usuario_id, evento_id: r.evento_id ?? null,
    codigo: r.codigo || '', tipo: r.tipo || 'standard', area_m2: nOrNull(r.area_m2), preco_num: nOrNull(r.preco_num),
    status: r.status || 'disponivel', expositor_id: r.expositor_id ?? null,
    posicao: { x: n(p.x), y: n(p.y), w: n(p.w) || 1, h: n(p.h) || 1 },
    cor: r.cor ?? null, obs: r.obs ?? null,
    criado_em: r.criado_em ?? undefined, atualizado_em: r.atualizado_em ?? undefined,
  }
}
export function mapExpositor(r: any): Expositor {
  const nec = r.necessidades && typeof r.necessidades === 'object' ? r.necessidades : {}
  return {
    id: String(r.id), usuario_id: r.usuario_id, evento_id: r.evento_id ?? null,
    empresa: r.empresa || '', contato: r.contato ?? null, email: r.email ?? null, telefone: r.telefone ?? null,
    doc: r.doc ?? null, estande_id: r.estande_id ?? null, contrato_id: r.contrato_id ?? null,
    credencial_id: r.credencial_id ?? null, lancamento_id: r.lancamento_id ?? null,
    valor_num: nOrNull(r.valor_num), status: r.status || 'prospecto',
    necessidades: {
      energia_kva: nOrNull(nec.energia_kva), internet: !!nec.internet, agua: !!nec.agua,
      montagem: !!nec.montagem, obs: nec.obs ?? null,
    },
    obs: r.obs ?? null, criado_em: r.criado_em ?? undefined, atualizado_em: r.atualizado_em ?? undefined,
  }
}
export function mapCota(r: any): Cota {
  const ent: Entregavel[] = Array.isArray(r.entregaveis)
    ? r.entregaveis.filter((e: any) => e && (e.chave || e.nome)).map((e: any) => ({
        chave: String(e.chave || e.nome), nome: String(e.nome || e.chave), qtd: nOrNull(e.qtd),
      }))
    : []
  return {
    id: String(r.id), usuario_id: r.usuario_id, evento_id: r.evento_id ?? null,
    nome: r.nome || '', preco_num: nOrNull(r.preco_num), quantidade: nOrNull(r.quantidade),
    cor: r.cor ?? null, ordem: n(r.ordem), entregaveis: ent, obs: r.obs ?? null,
    criado_em: r.criado_em ?? undefined, atualizado_em: r.atualizado_em ?? undefined,
  }
}
export function mapPatrocinador(r: any): Patrocinador {
  const st = r.entregaveis_status && typeof r.entregaveis_status === 'object' ? r.entregaveis_status : {}
  const status: Record<string, EntregavelStatus> = {}
  for (const k of Object.keys(st)) {
    const v = st[k] || {}
    status[k] = { entregue: !!v.entregue, data: v.data ?? null, obs: v.obs ?? null }
  }
  return {
    id: String(r.id), usuario_id: r.usuario_id, evento_id: r.evento_id ?? null,
    cota_id: r.cota_id ?? null, marca: r.marca || '', contato: r.contato ?? null,
    email: r.email ?? null, telefone: r.telefone ?? null, contrato_id: r.contrato_id ?? null,
    lancamento_id: r.lancamento_id ?? null, valor_num: nOrNull(r.valor_num), status: r.status || 'prospecto',
    entregaveis_status: status, obs: r.obs ?? null,
    criado_em: r.criado_em ?? undefined, atualizado_em: r.atualizado_em ?? undefined,
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// ── Bag de estado compartilhado entre a shell e as abas ──────────────────────
export type ExpoBag = {
  userId: string
  evento: EventoLite
  estandes: Estande[]
  expositores: Expositor[]
  cotas: Cota[]
  patrocinadores: Patrocinador[]
  precoM2: number
  setPrecoM2: (v: number) => void
  recarregar: () => Promise<void>
}

export function eventoLabel(ev: EventoLite | null | undefined): string {
  if (!ev) return 'Evento'
  return ev.nome_evento || ev.quem_contratou || 'Evento sem nome'
}

// preço por m² é uma preferência local por evento (a feira define o ponto base).
const PRECO_M2_KEY = 'ventsy_expo_preco_m2'
export function lerPrecoM2(eventoId: string): number {
  if (typeof window === 'undefined') return 0
  try { return n(JSON.parse(window.localStorage.getItem(PRECO_M2_KEY) || '{}')[eventoId]) } catch { return 0 }
}
export function salvarPrecoM2(eventoId: string, v: number): void {
  if (typeof window === 'undefined') return
  try {
    const all = JSON.parse(window.localStorage.getItem(PRECO_M2_KEY) || '{}')
    all[eventoId] = v
    window.localStorage.setItem(PRECO_M2_KEY, JSON.stringify(all))
  } catch { /* localStorage indisponível */ }
}

// meta de comercialização por evento (também preferência local).
const META_KEY = 'ventsy_expo_meta'
export function lerMeta(eventoId: string): number {
  if (typeof window === 'undefined') return 0
  try { return n(JSON.parse(window.localStorage.getItem(META_KEY) || '{}')[eventoId]) } catch { return 0 }
}
export function salvarMeta(eventoId: string, v: number): void {
  if (typeof window === 'undefined') return
  try {
    const all = JSON.parse(window.localStorage.getItem(META_KEY) || '{}')
    all[eventoId] = v
    window.localStorage.setItem(META_KEY, JSON.stringify(all))
  } catch { /* localStorage indisponível */ }
}

// ── API autoritativa (/api/expositores) ──────────────────────────────────────
/* eslint-disable @typescript-eslint/no-explicit-any */
export type ApiResult = { ok: boolean; error?: string; status?: number; data?: any; [k: string]: any }
async function call(body: Record<string, unknown>): Promise<ApiResult> {
  const res = await fetch('/api/expositores', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
    body: JSON.stringify(body),
  })
  const json = await res.json().catch(() => ({}))
  return res.ok ? { ok: true, ...json } : { ok: false, status: res.status, ...json }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/** Comercializa um estande (vender/reservar/bloquear/liberar) — autoritativo. */
export const comercializarEstande = (estande_id: string, status: string, expositor_id?: string | null, force = false) =>
  call({ action: 'estande', estande_id, status, expositor_id: expositor_id ?? null, force })
/** Gera a receita no financeiro do evento (idempotente). */
export const faturar = (tipo: 'expositor' | 'patrocinador', id: string, metodo?: string) =>
  call({ action: 'faturar', tipo, id, ...(metodo ? { metodo } : {}) })
/** Estorna a fatura. */
export const estornar = (tipo: 'expositor' | 'patrocinador', id: string) =>
  call({ action: 'estornar', tipo, id })
/** Emite credencial de expositor (→ Acesso) — best-effort. */
export const credenciar = (expositor_id: string) => call({ action: 'credenciar', expositor_id })
/** Gera contrato rascunho (→ Contratos) — best-effort. */
export const gerarContrato = (tipo: 'expositor' | 'patrocinador', id: string) =>
  call({ action: 'contrato', tipo, id })
/** Manda necessidades técnicas p/ a checklist de Produção — best-effort. */
export const enviarLogistica = (expositor_id: string) => call({ action: 'logistica', expositor_id })

// ── CRUD via RLS (client) ─────────────────────────────────────────────────────
/* eslint-disable @typescript-eslint/no-explicit-any */
export const criarEstande = (row: Record<string, unknown>) => sb.from('expo_mapa').insert(row).select(SEL_ESTANDE).single()
export const salvarEstande = (id: string, patch: Record<string, unknown>) => sb.from('expo_mapa').update(patch).eq('id', id).select(SEL_ESTANDE).single()
export const excluirEstande = (id: string) => sb.from('expo_mapa').delete().eq('id', id)

export const criarExpositor = (row: Record<string, unknown>) => sb.from('expositores').insert(row).select(SEL_EXPOSITOR).single()
export const salvarExpositor = (id: string, patch: Record<string, unknown>) => sb.from('expositores').update(patch).eq('id', id).select(SEL_EXPOSITOR).single()
export const excluirExpositor = (id: string) => sb.from('expositores').delete().eq('id', id)

export const criarCota = (row: Record<string, unknown>) => sb.from('patrocinio_cotas').insert(row).select(SEL_COTA).single()
export const salvarCota = (id: string, patch: Record<string, unknown>) => sb.from('patrocinio_cotas').update(patch).eq('id', id).select(SEL_COTA).single()
export const excluirCota = (id: string) => sb.from('patrocinio_cotas').delete().eq('id', id)

export const criarPatrocinador = (row: Record<string, unknown>) => sb.from('patrocinadores').insert(row).select(SEL_PATRO).single()
export const salvarPatrocinador = (id: string, patch: Record<string, unknown>) => sb.from('patrocinadores').update(patch).eq('id', id).select(SEL_PATRO).single()
export const excluirPatrocinador = (id: string) => sb.from('patrocinadores').delete().eq('id', id)
/* eslint-enable @typescript-eslint/no-explicit-any */

// ── Classes de input padrão (igual ao resto do painel) ───────────────────────
export const inp = 'w-full rounded-xl border border-black/10 px-3.5 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20'
export const selCls = 'rounded-xl border border-black/10 bg-white px-3 py-2 text-sm focus:border-brand focus:outline-none'

// ── Export CSV (genérico) ─────────────────────────────────────────────────────
const esc = (s: string) => `"${(s || '').replace(/"/g, '""')}"`
export function exportCSV(name: string, header: string[], rows: (string | number)[][]): void {
  const body = rows.map((r) => r.map((c) => (typeof c === 'number' ? c : esc(String(c)))).join(',')).join('\n')
  const blob = new Blob(['﻿' + header.join(',') + '\n' + body], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = name; a.click()
  URL.revokeObjectURL(url)
}
