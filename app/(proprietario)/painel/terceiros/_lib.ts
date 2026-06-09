// _lib — modelo, catálogos, queries, storage e CSV do módulo Terceiros
// (/painel/terceiros). Compartilhado entre a shell (page.tsx) e as abas
// (_components/*). Regra de ouro: NADA de "R$"/percentual/data formatada aqui —
// só números/datas crus; a formatação fica em lib/format, chamada nas páginas. A
// matemática (mensalização, ROI, SLA, decisão, alertas) vive em lib/terceiros
// (motor puro, testado) e é re-exportada para um import único nas abas.

import { supabaseAny as sb } from '@/lib/supabase';
import {
  normalizarTerceiro, normalizarResultado,
  type Terceiro, type ResultadoTerceiro, type SLA,
} from '@/lib/terceiros';

// Re-export do motor puro (as abas importam tudo daqui).
export * from '@/lib/terceiros';
export type { Terceiro, ResultadoTerceiro, SLA };

// ── Vínculos carregados em paralelo na shell ─────────────────────────────────
/** Fornecedor (subconjunto) — para vincular e reaproveitar o cadastro operacional. */
export type FornecedorLite = {
  id: string;
  nome: string;
  fantasia: string | null;
  categoria: string | null;
};
/** Despesa de Contas a pagar (lançamento) — custo REALIZADO puxado por fornecedor. */
export type DespesaLite = {
  fornecedor_id: string | null;
  valor: number;
  data: string;            // 'YYYY-MM-DD'
};
/** Evento (subconjunto de clientes_eventos) — referência de volume/receita. */
export type EventoLite = {
  id: string;
  data_inicio: string | null;
  valor_total_num: number;
};

// ── Selects (campos exatos pedidos ao Supabase) ──────────────────────────────
export const SEL_TERCEIRO = 'id,usuario_id,fornecedor_id,servico,categoria,modelo_custo,custo_num,custo_interno_mensal_num,responsavel,contrato_id,documento_url,documento_nome,vigencia_inicio,vigencia_fim,renovacao_automatica,aviso_previo_dias,multa_rescisao,sla,status,obs,criado_em,atualizado_em';
export const SEL_RESULTADO = 'id,usuario_id,terceiro_id,competencia,custo_num,receita_atribuida_num,eventos_atendidos,economia_num,sla_cumprido_pct,satisfacao,obs,criado_em';
export const SEL_FORNECEDOR = 'id,nome,fantasia,categoria';
export const SEL_DESPESA = 'fornecedor_id,valor,data';
export const SEL_EVENTO = 'id,data_inicio,valor_total_num';

// ── Mapeadores (coerção defensiva) ───────────────────────────────────────────
/* eslint-disable @typescript-eslint/no-explicit-any */
const n = (v: any): number => { const x = Number(v); return Number.isFinite(x) ? x : 0; };
export const mapTerceiro = (r: any): Terceiro => normalizarTerceiro(r);
export const mapResultado = (r: any): ResultadoTerceiro => normalizarResultado(r);
export const mapFornecedor = (r: any): FornecedorLite => ({
  id: String(r.id), nome: r.nome || 'Fornecedor', fantasia: r.fantasia ?? null, categoria: r.categoria ?? null,
});
export const mapDespesa = (r: any): DespesaLite => ({
  fornecedor_id: r.fornecedor_id ?? null, valor: n(r.valor), data: r.data ?? '',
});
export const mapEvento = (r: any): EventoLite => ({
  id: String(r.id), data_inicio: r.data_inicio ?? null, valor_total_num: n(r.valor_total_num),
});
/* eslint-enable @typescript-eslint/no-explicit-any */

export function fornecedorLabel(f: FornecedorLite | null | undefined): string {
  if (!f) return '—';
  return f.fantasia || f.nome;
}

// ── Hoje (YYYY-MM-DD) — entra no motor puro como parâmetro ───────────────────
export function hojeYmd(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ── Referências do Financeiro (para % sobre receita e mensalização) ──────────
/**
 * Receita MENSAL de referência: total de receitas dos últimos `meses` ÷ `meses`.
 * Fonte: lançamentos de receita do caixa (mesma base do Financeiro). 0 se vazio.
 */
export function receitaMensalRef(despesasReceitas: { valor: number; data: string }[], meses = 12): number {
  if (!despesasReceitas.length || meses <= 0) return 0;
  const total = despesasReceitas.reduce((s, r) => s + (Number(r.valor) || 0), 0);
  return total / meses;
}
/** Volume MENSAL de eventos de referência: nº de eventos ÷ `meses`. */
export function eventosMensalRef(eventos: EventoLite[], meses = 12): number {
  if (!eventos.length || meses <= 0) return 0;
  return eventos.length / meses;
}

// ── Custo REALIZADO por fornecedor (puxa de Contas a pagar / lançamentos) ─────
export type GastoForn = { total: number; meses: number; mensal: number; ultima: string | null };
/**
 * Agrupa as despesas por fornecedor (só as com fornecedor_id) e estima o gasto
 * mensal pela média sobre os meses distintos com lançamento. Espelha
 * gastoPorFornecedor do módulo Fornecedores.
 */
export function gastoPorFornecedor(despesas: DespesaLite[]): Map<string, GastoForn> {
  const acc = new Map<string, { total: number; comp: Set<string>; ultima: string | null }>();
  for (const d of despesas) {
    if (!d.fornecedor_id) continue;
    const g = acc.get(d.fornecedor_id) || { total: 0, comp: new Set<string>(), ultima: null };
    g.total += d.valor;
    if (d.data) { g.comp.add(d.data.slice(0, 7)); if (!g.ultima || d.data > g.ultima) g.ultima = d.data; }
    acc.set(d.fornecedor_id, g);
  }
  const out = new Map<string, GastoForn>();
  for (const [k, g] of acc) {
    const meses = Math.max(1, g.comp.size);
    out.set(k, { total: g.total, meses: g.comp.size, mensal: g.total / meses, ultima: g.ultima });
  }
  return out;
}

// ── Classes de input padrão (igual ao resto do painel) ───────────────────────
export const inp = 'w-full rounded-xl border border-black/10 bg-white px-3.5 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20';
export const selCls = 'rounded-xl border border-black/10 bg-white px-3 py-2 text-sm focus:border-brand focus:outline-none';

// ── Storage: documento do contrato (bucket `documentos`) ──────────────────────
export const BUCKET = 'documentos';
export type UploadResult = { url: string; nome: string };
export async function uploadContrato(uid: string, file: File): Promise<UploadResult> {
  const ext = file.name.includes('.') ? '.' + file.name.split('.').pop() : '';
  const path = `${uid}/terceiros/${crypto.randomUUID()}${ext}`;
  const { error } = await sb.storage.from(BUCKET).upload(path, file, { upsert: false, contentType: file.type || undefined });
  if (error) throw error;
  return { url: path, nome: file.name };
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

// ── CRUD via RLS (client) — terceiros + resultados ───────────────────────────
/* eslint-disable @typescript-eslint/no-explicit-any */
export async function criarTerceiro(row: Record<string, unknown>) {
  return sb.from('terceiros').insert(row).select(SEL_TERCEIRO).single();
}
export async function salvarTerceiro(id: string, patch: Record<string, unknown>) {
  return sb.from('terceiros').update(patch).eq('id', id).select(SEL_TERCEIRO).single();
}
export async function excluirTerceiro(id: string) {
  return sb.from('terceiros').delete().eq('id', id);
}
/** Upsert por (terceiro_id, competencia) — uma medição por mês. */
export async function salvarResultado(row: Record<string, unknown>) {
  return sb.from('terceiros_resultados').upsert(row, { onConflict: 'terceiro_id,competencia' }).select(SEL_RESULTADO).single();
}
export async function excluirResultado(id: string) {
  return sb.from('terceiros_resultados').delete().eq('id', id);
}
/* eslint-enable @typescript-eslint/no-explicit-any */

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
