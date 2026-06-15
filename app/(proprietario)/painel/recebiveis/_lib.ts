// _lib — modelo, constantes e helpers do módulo Contas a Pagar/Receber.
// Compartilhado entre a shell (page.tsx) e as abas (_components/*).
// Regra de ouro: NADA de "R$"/percentual/data formatada aqui — só números/datas
// cruas; toda a formatação fica em lib/format, chamada nas páginas.
//
// "A receber" = tabela `parcelas` (parcelamento de eventos, já existia).
// "A pagar"   = tabela `contas_pagar` (ver docs/sql/contas-pagar.sql).

import { supabase as sb } from '@/lib/supabase';

// ── A receber: parcelas + eventos ─────────────────────────────────────────────
export type ParcelaStatus = 'pendente' | 'pago' | 'cancelado';
export type Parcela = {
  id: number;
  evento_id: string;
  numero: number | null;
  descricao: string | null;
  valor: number;
  vencimento: string | null;
  status: ParcelaStatus;
  pago_em: string | null;
  metodo_pagamento: string | null;
  lancamento_id: number | null;
};
export type Evento = {
  id: string;
  nome_evento: string | null;
  quem_contratou: string | null;
  tipo_evento: string | null;
  status: string | null;
  data_inicio: string | null;
  valor_total_num: number | null;
  propriedade_id: number | null;
  telefones: string[];
};
export type EfetivoReceber = 'pendente' | 'pago' | 'atrasado' | 'cancelado';

// ── A pagar: contas_pagar + fornecedores ──────────────────────────────────────
export type Freq = 'semanal' | 'quinzenal' | 'mensal' | 'bimestral' | 'trimestral' | 'semestral' | 'anual';
export type Recorrencia = { freq?: Freq; ate?: string | null };
export type ContaPagarStatus = 'pendente' | 'agendado' | 'atrasado' | 'pago' | 'cancelado';

// View em memória: `valor` é mapeado de `valor_num` no carregamento.
export type ContaPagar = {
  id: string;
  fornecedor_id: string | null;
  categoria: string;
  plano_conta: string | null;
  descricao: string;
  valor: number;
  vencimento: string | null;
  status: ContaPagarStatus;
  pago_em: string | null;
  metodo: string | null;
  recorrente: boolean;
  recorrencia: Recorrencia;
  recorrencia_pai: string | null;
  aprovado: boolean;
  anexo_url: string | null;
  anexo_nome: string | null;
  lancamento_id: number | null;
  obs: string | null;
};
export type FornecedorLite = { id: string; nome: string; fantasia: string | null; categoria: string };
// status "efetivo" para exibição/aging — deriva 'atrasado' de vencimento < hoje.
export type EfetivoPagar = ContaPagarStatus;

// ── Constantes ────────────────────────────────────────────────────────────────
export const METODOS = ['Pix', 'Boleto', 'Transferência', 'Cartão de crédito', 'Cartão de débito', 'Dinheiro', 'Débito automático', 'Outro'];
export const MESES_PT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
export const DIAS_REGRA = 30;
export const inp = 'w-full rounded-xl border border-black/10 px-3.5 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20';

// Categorias de despesa (contas a pagar). `cor` alimenta donut/legendas.
export const CAT_PAGAR: { v: string; label: string; cor: string }[] = [
  { v: 'fornecedor',  label: 'Fornecedores',        cor: '#ff385c' },
  { v: 'folha',       label: 'Folha & Encargos',    cor: '#8b5cf6' },
  { v: 'aluguel',     label: 'Aluguel',             cor: '#f97316' },
  { v: 'energia',     label: 'Energia',             cor: '#eab308' },
  { v: 'agua',        label: 'Água & Saneamento',   cor: '#0ea5e9' },
  { v: 'internet',    label: 'Internet & Telefonia', cor: '#14b8a6' },
  { v: 'software',    label: 'Software & Assinaturas', cor: '#6366f1' },
  { v: 'manutencao',  label: 'Manutenção',          cor: '#f59e0b' },
  { v: 'marketing',   label: 'Marketing',           cor: '#ec4899' },
  { v: 'transporte',  label: 'Transporte',          cor: '#64748b' },
  { v: 'impostos',    label: 'Impostos & Taxas',    cor: '#dc2626' },
  { v: 'outro',       label: 'Outro',               cor: '#94a3b8' },
];
export const CAT_PAGAR_BY: Record<string, (typeof CAT_PAGAR)[number]> = Object.fromEntries(CAT_PAGAR.map((c) => [c.v, c]));
export function catPagarLabel(v: string | null): string { return CAT_PAGAR_BY[v || 'outro']?.label || v || '—'; }
export function catPagarCor(v: string | null): string { return CAT_PAGAR_BY[v || 'outro']?.cor || '#94a3b8'; }

export const FREQS: { v: Freq; label: string }[] = [
  { v: 'semanal',    label: 'Semanal' },
  { v: 'quinzenal',  label: 'Quinzenal' },
  { v: 'mensal',     label: 'Mensal' },
  { v: 'bimestral',  label: 'Bimestral' },
  { v: 'trimestral', label: 'Trimestral' },
  { v: 'semestral',  label: 'Semestral' },
  { v: 'anual',      label: 'Anual' },
];
export const FREQ_LABEL: Record<Freq, string> = Object.fromEntries(FREQS.map((f) => [f.v, f.label])) as Record<Freq, string>;

// Classes/labels de status — mesma paleta semântica do resto do painel.
export const ST_RECEBER_CLS: Record<EfetivoReceber, string> = {
  pendente: 'bg-amber-50 text-amber-700',
  pago: 'bg-emerald-50 text-emerald-700',
  atrasado: 'bg-red-50 text-red-700',
  cancelado: 'bg-gray-100 text-gray-500',
};
export const ST_RECEBER_LABEL: Record<EfetivoReceber, string> = { pendente: 'A vencer', pago: 'Recebido', atrasado: 'Atrasado', cancelado: 'Cancelado' };

export const ST_PAGAR_CLS: Record<EfetivoPagar, string> = {
  pendente: 'bg-amber-50 text-amber-700',
  agendado: 'bg-sky-50 text-sky-700',
  pago: 'bg-emerald-50 text-emerald-700',
  atrasado: 'bg-red-50 text-red-700',
  cancelado: 'bg-gray-100 text-gray-500',
};
export const ST_PAGAR_LABEL: Record<EfetivoPagar, string> = { pendente: 'A pagar', agendado: 'Agendado', pago: 'Pago', atrasado: 'Atrasado', cancelado: 'Cancelado' };

// ── Helpers de data/contato ───────────────────────────────────────────────────
export function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function diffDias(dateStr: string, base: Date): number {
  return Math.floor((new Date(dateStr + 'T12:00:00').getTime() - base.getTime()) / 86400000);
}
export function soDigitos(s: string | null | undefined): string { return (s || '').replace(/\D/g, ''); }
export function waLink(fone: string | null | undefined, msg: string): string | null {
  const d = soDigitos(fone);
  if (!d) return null;
  return `https://wa.me/${d.length <= 11 ? '55' + d : d}?text=${encodeURIComponent(msg)}`;
}

// ── Status efetivo (deriva "atrasado" de vencimento) ──────────────────────────
export function efetivoReceber(p: Parcela, hoje: string): EfetivoReceber {
  if (p.status === 'pago') return 'pago';
  if (p.status === 'cancelado') return 'cancelado';
  if (p.vencimento && p.vencimento < hoje) return 'atrasado';
  return 'pendente';
}
export function efetivoPagar(c: ContaPagar, hoje: string): EfetivoPagar {
  if (c.status === 'pago') return 'pago';
  if (c.status === 'cancelado') return 'cancelado';
  if (c.vencimento && c.vencimento < hoje) return 'atrasado';
  if (c.status === 'agendado') return 'agendado';
  return 'pendente';
}

// ── Aging (0–30 / 31–60 / 61–90 / 90+) sobre valores em aberto ────────────────
export type Aging = { aVencer: number; d0_30: number; d31_60: number; d61_90: number; d90: number; vencido: number; total: number };
export function aging(items: { vencimento: string | null; valor: number }[], hoje: string): Aging {
  const a: Aging = { aVencer: 0, d0_30: 0, d31_60: 0, d61_90: 0, d90: 0, vencido: 0, total: 0 };
  const base = new Date(hoje + 'T12:00:00').getTime();
  for (const it of items) {
    a.total += it.valor;
    if (!it.vencimento || it.vencimento >= hoje) { a.aVencer += it.valor; continue; }
    const od = Math.floor((base - new Date(it.vencimento + 'T12:00:00').getTime()) / 86400000);
    a.vencido += it.valor;
    if (od <= 30) a.d0_30 += it.valor;
    else if (od <= 60) a.d31_60 += it.valor;
    else if (od <= 90) a.d61_90 += it.valor;
    else a.d90 += it.valor;
  }
  return a;
}
export const AGING_BUCKETS: { key: keyof Aging; label: string; cls: string }[] = [
  { key: 'aVencer', label: 'A vencer', cls: 'text-ink-soft' },
  { key: 'd0_30',   label: '0–30 dias', cls: 'text-amber-600' },
  { key: 'd31_60',  label: '31–60 dias', cls: 'text-orange-600' },
  { key: 'd61_90',  label: '61–90 dias', cls: 'text-red-500' },
  { key: 'd90',     label: '90+ dias', cls: 'text-red-700' },
];

// ── Recorrência: próxima data por frequência ──────────────────────────────────
function addMonths(d: Date, n: number): Date {
  const day = d.getDate();
  const r = new Date(d.getFullYear(), d.getMonth() + n, 1, 12, 0, 0);
  const ultimoDia = new Date(r.getFullYear(), r.getMonth() + 1, 0).getDate();
  r.setDate(Math.min(day, ultimoDia)); // 31/jan + 1 mês → 28/29 fev
  return r;
}
export function proximaData(iso: string, freq: Freq): string {
  const d = new Date(iso + 'T12:00:00');
  switch (freq) {
    case 'semanal': d.setDate(d.getDate() + 7); return ymd(d);
    case 'quinzenal': d.setDate(d.getDate() + 14); return ymd(d);
    case 'mensal': return ymd(addMonths(d, 1));
    case 'bimestral': return ymd(addMonths(d, 2));
    case 'trimestral': return ymd(addMonths(d, 3));
    case 'semestral': return ymd(addMonths(d, 6));
    case 'anual': return ymd(addMonths(d, 12));
  }
}

// ── Storage: comprovantes (reutiliza o bucket `documentos`) ───────────────────
export const BUCKET = 'documentos';
export type UploadResult = { anexo_url: string; anexo_nome: string };
export async function uploadComprovante(uid: string, file: File): Promise<UploadResult> {
  const ext = file.name.includes('.') ? '.' + file.name.split('.').pop() : '';
  const path = `${uid}/contas-pagar/${crypto.randomUUID()}${ext}`;
  const { error } = await sb.storage.from(BUCKET).upload(path, file, { upsert: false, contentType: file.type || undefined });
  if (error) throw error;
  return { anexo_url: path, anexo_nome: file.name };
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

// ── Detecção de "tabela ainda não criada" (rodar o SQL) ───────────────────────
// PGRST205 = REST não encontrou a tabela; 42P01 = undefined_table (SQL direto).
export function isMissingTable(err: { code?: string | null } | null | undefined): boolean {
  return err?.code === 'PGRST205' || err?.code === '42P01';
}

// ── Mapeamento de linha do banco → view em memória ────────────────────────────
/* eslint-disable @typescript-eslint/no-explicit-any */
export function mapContaPagar(r: any): ContaPagar {
  return {
    id: String(r.id),
    fornecedor_id: r.fornecedor_id ?? null,
    categoria: r.categoria || 'outro',
    plano_conta: r.plano_conta ?? null,
    descricao: r.descricao || '',
    valor: Number(r.valor_num) || 0,
    vencimento: r.vencimento ?? null,
    status: (r.status || 'pendente') as ContaPagarStatus,
    pago_em: r.pago_em ?? null,
    metodo: r.metodo ?? null,
    recorrente: !!r.recorrente,
    recorrencia: (r.recorrencia && typeof r.recorrencia === 'object') ? r.recorrencia : {},
    recorrencia_pai: r.recorrencia_pai ?? null,
    aprovado: r.aprovado !== false,
    anexo_url: r.anexo_url ?? null,
    anexo_nome: r.anexo_nome ?? null,
    lancamento_id: r.lancamento_id != null ? Number(r.lancamento_id) : null,
    obs: r.obs ?? null,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// ── Export CSV (contas a pagar) ───────────────────────────────────────────────
function csvDownload(name: string, header: string[], body: string): void {
  const blob = new Blob(['﻿' + header.join(',') + '\n' + body], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}
const esc = (s: string) => `"${(s || '').replace(/"/g, '""')}"`;

export function exportContasPagarCSV(contas: ContaPagar[], fornNome: (id: string | null) => string, hoje: string): void {
  const header = ['Vencimento', 'Descrição', 'Fornecedor', 'Categoria', 'Status', 'Recorrência', 'Pago em', 'Método', 'Valor'];
  const body = contas.map((c) => [
    c.vencimento || '', esc(c.descricao), esc(fornNome(c.fornecedor_id)), esc(catPagarLabel(c.categoria)),
    ST_PAGAR_LABEL[efetivoPagar(c, hoje)], c.recorrente ? FREQ_LABEL[c.recorrencia.freq || 'mensal'] : '',
    c.pago_em || '', esc(c.metodo || ''), c.valor,
  ].join(',')).join('\n');
  csvDownload(`contas-a-pagar-${hoje}.csv`, header, body);
}

// Agenda unificada (entradas + saídas) → CSV.
export function exportAgendaCSV(linhas: { data: string; tipo: 'entrada' | 'saida'; descricao: string; valor: number }[], hoje: string): void {
  const header = ['Data', 'Fluxo', 'Descrição', 'Valor'];
  const body = linhas.map((l) => [l.data, l.tipo === 'entrada' ? 'Entrada' : 'Saída', esc(l.descricao), l.valor].join(',')).join('\n');
  csvDownload(`agenda-financeira-${hoje}.csv`, header, body);
}
