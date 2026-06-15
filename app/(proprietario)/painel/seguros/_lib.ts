// _lib — modelo, catálogos, queries, storage e integração financeira do módulo
// Seguros. Compartilhado entre a shell (page.tsx) e as abas (_components/*).
// Regra de ouro: NADA de "R$"/percentual/data formatada aqui — só números/datas
// crus; a formatação fica em lib/format, chamada nas páginas. A matemática
// (vigência, prêmio, sinistralidade, rateio, exigências) vive em lib/seguros
// (motor puro, testado) e é re-exportada abaixo para um import único nas abas.

import { supabase as sb, authHeaders } from '@/lib/supabase';
import type { TablesInsert } from '@/types/supabase';
import type {
  Escopo, StatusAdmin, SinistroStatus, Cobertura, Anexo,
} from '@/lib/seguros';

// Re-export do motor puro (as abas importam tudo daqui).
export * from '@/lib/seguros';
export type { Escopo, StatusAdmin, SinistroStatus, Cobertura, Anexo };

// ── Linhas do banco (ver docs/sql/seguros.sql) ───────────────────────────────
export type Seguro = {
  id: string;
  escopo: Escopo;
  propriedade_id: number | null;
  evento_id: string | null;
  seguradora: string | null;
  corretor: string | null;
  apolice: string | null;
  coberturas: Cobertura[];
  franquia_num: number;
  premio_num: number;
  vigencia_inicio: string | null;
  vigencia_fim: string | null;
  status: StatusAdmin;
  documento_url: string | null;
  lancamento_id: number | null;
  obs: string | null;
  criado_em: string | null;
};

export type Sinistro = {
  id: string;
  seguro_id: string;
  evento_id: string | null;
  data: string;
  descricao: string | null;
  valor_estimado_num: number;
  valor_indenizado_num: number;
  status: SinistroStatus;
  protocolo: string | null;
  anexos: Anexo[];
  licao: string | null;
  criado_em: string | null;
};

// Vínculos (carregados em paralelo na shell).
export type PropriedadeLite = { id: number; nome: string };
export type EventoLite = {
  id: string;
  nome_evento: string | null;
  quem_contratou: string | null;
  tipo_evento: string | null;
  data_inicio: string | null;
  data_fim: string | null;
  propriedade_id: number | null;
};

// ── Selects (campos exatos pedidos ao Supabase) ──────────────────────────────
export const SEL_SEGURO = 'id,escopo,propriedade_id,evento_id,seguradora,corretor,apolice,coberturas,franquia_num,premio_num,vigencia_inicio,vigencia_fim,status,documento_url,lancamento_id,obs,criado_em';
export const SEL_SINISTRO = 'id,seguro_id,evento_id,data,descricao,valor_estimado_num,valor_indenizado_num,status,protocolo,anexos,licao,criado_em';
export const SEL_PROP = 'id,nome';
export const SEL_EVENTO = 'id,nome_evento,quem_contratou,tipo_evento,data_inicio,data_fim,propriedade_id';

// ── Mapeadores (coerção numérica/array defensiva) ────────────────────────────
/* eslint-disable @typescript-eslint/no-explicit-any */
const n = (v: any): number => { const x = Number(v); return Number.isFinite(x) ? x : 0; };
const nullableId = (v: any): number | null => (v == null ? null : n(v));
const arr = (v: any): any[] => (Array.isArray(v) ? v : []);

import { normalizarCoberturas, normalizarAnexos } from '@/lib/seguros';

export function mapSeguro(r: any): Seguro {
  return {
    id: String(r.id),
    escopo: (r.escopo || 'patrimonial') as Escopo,
    propriedade_id: nullableId(r.propriedade_id),
    evento_id: r.evento_id ?? null,
    seguradora: r.seguradora ?? null,
    corretor: r.corretor ?? null,
    apolice: r.apolice ?? null,
    coberturas: normalizarCoberturas(r.coberturas),
    franquia_num: n(r.franquia_num),
    premio_num: n(r.premio_num),
    vigencia_inicio: r.vigencia_inicio ?? null,
    vigencia_fim: r.vigencia_fim ?? null,
    status: (r.status || 'ativa') as StatusAdmin,
    documento_url: r.documento_url ?? null,
    lancamento_id: r.lancamento_id != null ? n(r.lancamento_id) : null,
    obs: r.obs ?? null,
    criado_em: r.criado_em ?? null,
  };
}

export function mapSinistro(r: any): Sinistro {
  return {
    id: String(r.id),
    seguro_id: String(r.seguro_id),
    evento_id: r.evento_id ?? null,
    data: r.data,
    descricao: r.descricao ?? null,
    valor_estimado_num: n(r.valor_estimado_num),
    valor_indenizado_num: n(r.valor_indenizado_num),
    status: (r.status || 'aberto') as SinistroStatus,
    protocolo: r.protocolo ?? null,
    anexos: normalizarAnexos(r.anexos),
    licao: r.licao ?? null,
    criado_em: r.criado_em ?? null,
  };
}

export const mapProp = (r: any): PropriedadeLite => ({ id: Number(r.id), nome: r.nome || 'Espaço' });
export const mapEvento = (r: any): EventoLite => ({
  id: String(r.id), nome_evento: r.nome_evento ?? null, quem_contratou: r.quem_contratou ?? null,
  tipo_evento: r.tipo_evento ?? null, data_inicio: r.data_inicio ?? null, data_fim: r.data_fim ?? null,
  propriedade_id: r.propriedade_id != null ? Number(r.propriedade_id) : null,
});
/* eslint-enable @typescript-eslint/no-explicit-any */

// ── Rótulos de vínculo ───────────────────────────────────────────────────────
export function eventoLabel(ev: EventoLite | null | undefined): string {
  if (!ev) return 'Evento';
  return ev.nome_evento || ev.quem_contratou || 'Evento sem nome';
}
export function alvoLabel(
  s: { propriedade_id: number | null; evento_id: string | null },
  props: Map<number, string>,
  eventos: Map<string, EventoLite>,
): string {
  if (s.evento_id && eventos.has(s.evento_id)) return eventoLabel(eventos.get(s.evento_id));
  if (s.propriedade_id != null && props.has(s.propriedade_id)) return props.get(s.propriedade_id)!;
  return '—';
}

// ── Hoje (YYYY-MM-DD) — entra no motor puro como parâmetro ───────────────────
export function hojeYmd(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

// ── Classes de input padrão (igual ao resto do painel) ───────────────────────
export const inp = 'w-full rounded-xl border border-black/10 bg-white px-3.5 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20';
export const selCls = 'rounded-xl border border-black/10 bg-white px-3 py-2 text-sm focus:border-brand focus:outline-none';

// ── Storage: documento da apólice e anexos do sinistro (bucket `documentos`) ──
export const BUCKET = 'documentos';
export async function uploadArquivo(uid: string, file: File, sub: string): Promise<Anexo> {
  const ext = file.name.includes('.') ? '.' + file.name.split('.').pop() : '';
  const path = `${uid}/seguros/${sub}${crypto.randomUUID()}${ext}`;
  const { error } = await sb.storage.from(BUCKET).upload(path, file, { upsert: false, contentType: file.type || undefined });
  if (error) throw error;
  return { url: path, nome: file.name, tipo: file.type || null, tamanho: file.size };
}
export async function signedUrl(path: string | null, expiresIn = 3600): Promise<string | null> {
  if (!path) return null;
  const { data, error } = await sb.storage.from(BUCKET).createSignedUrl(path, expiresIn);
  if (error) return null;
  return data?.signedUrl ?? null;
}
export async function removeArquivo(path: string | null): Promise<void> {
  if (!path) return;
  await sb.storage.from(BUCKET).remove([path]);
}

// ── Lançamento da despesa do prêmio (custo no Financeiro/Contábil) ────────────
// Mesma estratégia dos módulos Manutenção/Contas a pagar: tenta com as colunas
// de vínculo (prop_id/tipo_evento) e cai para o conjunto base se alguma não
// existir no schema (migração ainda não aplicada naquele ambiente).
export const CATEGORIA_DESPESA = 'Seguros';
export type DespesaPayload = {
  usuario_id: string;
  descricao: string;
  valor: number;
  data: string;
  prop_id?: number | null;
  tipo_evento?: string | null;
  observacao?: string | null;
};
export async function lancarDespesa(p: DespesaPayload): Promise<{ id: number } | null> {
  const base = {
    usuario_id: p.usuario_id, tipo: 'despesa', categoria: CATEGORIA_DESPESA,
    descricao: p.descricao, valor: p.valor, status: 'pago', data: p.data,
    observacao: p.observacao ?? null,
  };
  let r = await sb.from('lancamentos')
    .insert({ ...base, prop_id: p.prop_id ?? null, tipo_evento: p.tipo_evento ?? null })
    .select('id').single();
  if (r.error && (r.error.code === 'PGRST204' || r.error.code === '42703')) {
    r = await sb.from('lancamentos').insert(base).select('id').single();
  }
  return r.error ? null : (r.data as { id: number });
}
export async function estornarDespesa(lancamentoId: number | null): Promise<void> {
  if (lancamentoId != null) await sb.from('lancamentos').delete().eq('id', lancamentoId);
}

// ── CRUD via RLS (client) — apólices + sinistros ─────────────────────────────
/* eslint-disable @typescript-eslint/no-explicit-any */
export async function criarSeguro(row: Record<string, unknown>) {
  return sb.from('seguros').insert(row as TablesInsert<'seguros'>).select(SEL_SEGURO).single();
}
export async function salvarSeguro(id: string, patch: Record<string, unknown>) {
  return sb.from('seguros').update(patch).eq('id', id).select(SEL_SEGURO).single();
}
export async function excluirSeguro(id: string) {
  return sb.from('seguros').delete().eq('id', id);
}
export async function criarSinistro(row: Record<string, unknown>) {
  return sb.from('sinistros').insert(row as TablesInsert<'sinistros'>).select(SEL_SINISTRO).single();
}
export async function salvarSinistro(id: string, patch: Record<string, unknown>) {
  return sb.from('sinistros').update(patch).eq('id', id).select(SEL_SINISTRO).single();
}
export async function excluirSinistro(id: string) {
  return sb.from('sinistros').delete().eq('id', id);
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// authHeaders re-exportado para chamadas autenticadas eventuais.
export { authHeaders };

// ── Export CSV (genérico) ────────────────────────────────────────────────────
const esc = (s: string) => `"${(s || '').replace(/"/g, '""')}"`;
export function exportCSV(name: string, header: string[], rows: (string | number)[][]): void {
  const body = rows.map((r) => r.map((c) => (typeof c === 'number' ? c : esc(String(c)))).join(',')).join('\n');
  const blob = new Blob(['﻿' + header.join(',') + '\n' + body], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}
