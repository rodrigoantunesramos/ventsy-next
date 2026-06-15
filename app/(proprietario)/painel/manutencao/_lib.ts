// _lib — modelo, catálogos, queries e storage do módulo Manutenção & OS.
// Compartilhado entre a shell (page.tsx) e as abas (_components/*).
// Regra de ouro: NADA de "R$"/percentual/data formatada aqui — só números/datas
// crus; a formatação fica em lib/format, chamada nas páginas. A matemática (custo,
// MTTR, agenda preventiva, custo por ativo) vive em lib/manutencao (motor puro,
// testado) e é re-exportada abaixo para um import único nas abas.

import { supabase as sb, authHeaders } from '@/lib/supabase';
import type {
  OSTipo, OSStatus, Prioridade, ResponsavelTipo, Periodicidade, ChecklistItem, Peca,
} from '@/lib/manutencao';

// Re-export do motor puro (as abas importam tudo daqui).
export * from '@/lib/manutencao';
export type { OSTipo, OSStatus, Prioridade, ResponsavelTipo, Periodicidade, ChecklistItem, Peca };

// ── Linhas do banco (ver docs/sql/manutencao.sql) ────────────────────────────
export type Anexo = { url: string; nome: string; tipo: string | null; tamanho: number | null };

export type OS = {
  id: string;
  propriedade_id: number | null;
  espaco_id: number | null;
  ativo_id: string | null;
  ativo_nome: string | null;
  tipo: OSTipo;
  titulo: string;
  descricao: string | null;
  prioridade: Prioridade;
  status: OSStatus;
  solicitante: string | null;
  responsavel_tipo: ResponsavelTipo | null;
  responsavel_id: string | null;
  responsavel_nome: string | null;
  abertura: string;
  prazo: string | null;
  conclusao: string | null;
  custo_mao_obra_num: number;
  custo_pecas_num: number;
  custo_total_num: number;
  plano_id: string | null;
  evento_id: string | null;
  checklist: ChecklistItem[];
  pecas: Peca[];
  anexos: Anexo[];
  lancamento_id: number | null;
  obs: string | null;
  criado_em: string | null;
};

export type Plano = {
  id: string;
  propriedade_id: number | null;
  espaco_id: number | null;
  ativo_id: string | null;
  ativo_nome: string | null;
  titulo: string;
  descricao: string | null;
  tipo: 'preventiva' | 'inspecao';
  prioridade: Prioridade;
  periodicidade: Periodicidade;
  intervalo: number;
  proxima_data: string | null;
  responsavel_tipo: ResponsavelTipo | null;
  responsavel_id: string | null;
  responsavel_nome: string | null;
  custo_estimado_num: number;
  checklist: ChecklistItem[];
  ativo: boolean;
  ultima_geracao: string | null;
  obs: string | null;
  criado_em: string | null;
};

// Vínculos (carregados em paralelo na shell).
export type PropriedadeLite = { id: number; nome: string };
export type EspacoLite = { id: number; propriedade_id: number; nome: string };
export type FornecedorLite = { id: string; nome: string; fantasia: string | null };
export type EquipeLite = { id: string; nome: string; cargo: string | null };
export type EventoLite = { id: string; nome_evento: string | null; quem_contratou: string | null; data_inicio: string | null; propriedade_id: number | null };

// ── Selects (campos exatos pedidos ao Supabase) ──────────────────────────────
export const SEL_OS = 'id,propriedade_id,espaco_id,ativo_id,ativo_nome,tipo,titulo,descricao,prioridade,status,solicitante,responsavel_tipo,responsavel_id,responsavel_nome,abertura,prazo,conclusao,custo_mao_obra_num,custo_pecas_num,custo_total_num,plano_id,evento_id,checklist,pecas,anexos,lancamento_id,obs,criado_em';
export const SEL_PLANO = 'id,propriedade_id,espaco_id,ativo_id,ativo_nome,titulo,descricao,tipo,prioridade,periodicidade,intervalo,proxima_data,responsavel_tipo,responsavel_id,responsavel_nome,custo_estimado_num,checklist,ativo,ultima_geracao,obs,criado_em';

// ── Mapeadores (coerção numérica/array defensiva) ────────────────────────────
/* eslint-disable @typescript-eslint/no-explicit-any */
const n = (v: any): number => { const x = Number(v); return Number.isFinite(x) ? x : 0; };
const arr = <T,>(v: any): T[] => (Array.isArray(v) ? v : []);
const nullableId = (v: any): number | null => (v == null ? null : n(v));

export function mapOS(r: any): OS {
  return {
    id: String(r.id),
    propriedade_id: nullableId(r.propriedade_id),
    espaco_id: nullableId(r.espaco_id),
    ativo_id: r.ativo_id ?? null,
    ativo_nome: r.ativo_nome ?? null,
    tipo: (r.tipo || 'corretiva') as OSTipo,
    titulo: r.titulo || '',
    descricao: r.descricao ?? null,
    prioridade: (r.prioridade || 'media') as Prioridade,
    status: (r.status || 'aberta') as OSStatus,
    solicitante: r.solicitante ?? null,
    responsavel_tipo: (r.responsavel_tipo ?? null) as ResponsavelTipo | null,
    responsavel_id: r.responsavel_id ?? null,
    responsavel_nome: r.responsavel_nome ?? null,
    abertura: r.abertura,
    prazo: r.prazo ?? null,
    conclusao: r.conclusao ?? null,
    custo_mao_obra_num: n(r.custo_mao_obra_num),
    custo_pecas_num: n(r.custo_pecas_num),
    custo_total_num: n(r.custo_total_num),
    plano_id: r.plano_id ?? null,
    evento_id: r.evento_id ?? null,
    checklist: arr<ChecklistItem>(r.checklist),
    pecas: arr<Peca>(r.pecas),
    anexos: arr<Anexo>(r.anexos),
    lancamento_id: r.lancamento_id != null ? n(r.lancamento_id) : null,
    obs: r.obs ?? null,
    criado_em: r.criado_em ?? null,
  };
}

export function mapPlano(r: any): Plano {
  return {
    id: String(r.id),
    propriedade_id: nullableId(r.propriedade_id),
    espaco_id: nullableId(r.espaco_id),
    ativo_id: r.ativo_id ?? null,
    ativo_nome: r.ativo_nome ?? null,
    titulo: r.titulo || '',
    descricao: r.descricao ?? null,
    tipo: (r.tipo || 'preventiva') as 'preventiva' | 'inspecao',
    prioridade: (r.prioridade || 'media') as Prioridade,
    periodicidade: (r.periodicidade || 'mensal') as Periodicidade,
    intervalo: Math.max(1, n(r.intervalo) || 1),
    proxima_data: r.proxima_data ?? null,
    responsavel_tipo: (r.responsavel_tipo ?? null) as ResponsavelTipo | null,
    responsavel_id: r.responsavel_id ?? null,
    responsavel_nome: r.responsavel_nome ?? null,
    custo_estimado_num: n(r.custo_estimado_num),
    checklist: arr<ChecklistItem>(r.checklist),
    ativo: r.ativo !== false,
    ultima_geracao: r.ultima_geracao ?? null,
    obs: r.obs ?? null,
    criado_em: r.criado_em ?? null,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// ── Catálogos (rótulos PT; i18n: extrair p/ dicionário) ──────────────────────
// Tipo de OS — cor alimenta legendas/etiquetas.
export const TIPOS: { v: OSTipo; label: string; cor: string; icon: string }[] = [
  { v: 'corretiva',  label: 'Corretiva',  cor: '#dc2626', icon: '🔧' },
  { v: 'preventiva', label: 'Preventiva', cor: '#16a34a', icon: '🛡️' },
  { v: 'inspecao',   label: 'Inspeção',   cor: '#1a73e8', icon: '🔍' },
  { v: 'melhoria',   label: 'Melhoria',   cor: '#8b5cf6', icon: '✨' },
];
export const TIPO_BY = Object.fromEntries(TIPOS.map((t) => [t.v, t])) as Record<OSTipo, (typeof TIPOS)[number]>;
export const tipoLabel = (v: string | null): string => TIPO_BY[(v || 'corretiva') as OSTipo]?.label || v || '—';
export const tipoCor = (v: string | null): string => TIPO_BY[(v || 'corretiva') as OSTipo]?.cor || '#94a3b8';

// Status — rótulo, classe (chip) e cor da coluna do Kanban.
export const STATUS: { v: OSStatus; label: string; cls: string; cor: string }[] = [
  { v: 'aberta',          label: 'Aberta',          cls: 'bg-sky-50 text-sky-700',         cor: '#0ea5e9' },
  { v: 'planejada',       label: 'Planejada',       cls: 'bg-indigo-50 text-indigo-700',   cor: '#6366f1' },
  { v: 'em_andamento',    label: 'Em andamento',    cls: 'bg-amber-50 text-amber-700',     cor: '#f59e0b' },
  { v: 'aguardando_peca', label: 'Aguardando peça', cls: 'bg-orange-50 text-orange-700',   cor: '#f97316' },
  { v: 'concluida',       label: 'Concluída',       cls: 'bg-emerald-50 text-emerald-700', cor: '#10b981' },
  { v: 'cancelada',       label: 'Cancelada',       cls: 'bg-gray-100 text-gray-500',      cor: '#94a3b8' },
];
export const STATUS_BY = Object.fromEntries(STATUS.map((s) => [s.v, s])) as Record<OSStatus, (typeof STATUS)[number]>;
export const statusLabel = (v: string | null): string => STATUS_BY[(v || 'aberta') as OSStatus]?.label || v || '—';

// Prioridade — rótulo, classe e peso (ordenação).
export const PRIORIDADES: { v: Prioridade; label: string; cls: string; peso: number }[] = [
  { v: 'urgente', label: 'Urgente', cls: 'bg-red-50 text-red-700',       peso: 3 },
  { v: 'alta',    label: 'Alta',    cls: 'bg-orange-50 text-orange-700', peso: 2 },
  { v: 'media',   label: 'Média',   cls: 'bg-amber-50 text-amber-700',   peso: 1 },
  { v: 'baixa',   label: 'Baixa',   cls: 'bg-gray-100 text-gray-600',    peso: 0 },
];
export const PRIO_BY = Object.fromEntries(PRIORIDADES.map((p) => [p.v, p])) as Record<Prioridade, (typeof PRIORIDADES)[number]>;
export const prioLabel = (v: string | null): string => PRIO_BY[(v || 'media') as Prioridade]?.label || v || '—';
export const prioPeso = (v: string | null): number => PRIO_BY[(v || 'media') as Prioridade]?.peso ?? 1;

// Periodicidade das preventivas.
export const PERIODICIDADES: { v: Periodicidade; label: string }[] = [
  { v: 'diaria',     label: 'Diária' },
  { v: 'semanal',    label: 'Semanal' },
  { v: 'quinzenal',  label: 'Quinzenal' },
  { v: 'mensal',     label: 'Mensal' },
  { v: 'bimestral',  label: 'Bimestral' },
  { v: 'trimestral', label: 'Trimestral' },
  { v: 'semestral',  label: 'Semestral' },
  { v: 'anual',      label: 'Anual' },
  { v: 'horas_uso',  label: 'Por horas de uso' },
];
export const PERIOD_BY = Object.fromEntries(PERIODICIDADES.map((p) => [p.v, p])) as Record<Periodicidade, (typeof PERIODICIDADES)[number]>;
export const periodLabel = (v: string | null): string => PERIOD_BY[(v || 'mensal') as Periodicidade]?.label || v || '—';

export const RESP_TIPOS: { v: ResponsavelTipo; label: string }[] = [
  { v: 'equipe',     label: 'Equipe interna' },
  { v: 'fornecedor', label: 'Fornecedor' },
];

// Categoria de despesa usada ao lançar o custo da OS no caixa (Financeiro).
export const CATEGORIA_DESPESA = 'manutencao';

// Classe de input padrão (igual ao resto do painel).
export const inp = 'w-full rounded-xl border border-black/10 bg-white px-3.5 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20';
export const selCls = 'rounded-xl border border-black/10 bg-white px-3 py-2 text-sm focus:border-brand focus:outline-none';

// ── Detecção de "tabela ainda não criada" (rodar o SQL) ──────────────────────
// PGRST205 = REST não encontrou a tabela; 42P01 = undefined_table (SQL direto).
export function isMissingTable(err: { code?: string | null } | null | undefined): boolean {
  return err?.code === 'PGRST205' || err?.code === '42P01';
}

// ── Rótulo do alvo (ativo › espaço › propriedade) ────────────────────────────
export function alvoLabel(
  x: { ativo_nome: string | null; espaco_id: number | null; propriedade_id: number | null },
  props: Map<number, string>,
  espacos: Map<number, string>,
): string {
  if (x.ativo_nome && x.ativo_nome.trim()) return x.ativo_nome.trim();
  if (x.espaco_id != null && espacos.has(x.espaco_id)) return espacos.get(x.espaco_id)!;
  if (x.propriedade_id != null && props.has(x.propriedade_id)) return props.get(x.propriedade_id)!;
  return '—';
}

// ── Storage: anexos da OS (reutiliza o bucket `documentos`) ──────────────────
export const BUCKET = 'documentos';
export async function uploadAnexo(uid: string, file: File): Promise<Anexo> {
  const ext = file.name.includes('.') ? '.' + file.name.split('.').pop() : '';
  const path = `${uid}/manutencao/${crypto.randomUUID()}${ext}`;
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

// ── Lançamento da despesa no caixa (custo da OS no Financeiro/Contábil) ───────
// Mesma estratégia do módulo Contas a pagar: tenta com fornecedor_id e cai para
// sem ele se a coluna não existir (migração de Fornecedores ainda não aplicada).
export type DespesaPayload = {
  usuario_id: string;
  categoria: string;
  descricao: string;
  valor: number;
  data: string;
  fornecedor_id?: string | null;
  observacao?: string | null;
};
export async function lancarDespesa(p: DespesaPayload): Promise<{ id: number } | null> {
  const base = {
    usuario_id: p.usuario_id, tipo: 'despesa', categoria: p.categoria, descricao: p.descricao,
    valor: p.valor, status: 'pago', data: p.data, observacao: p.observacao ?? null,
  };
  let r = await sb.from('lancamentos').insert({ ...base, fornecedor_id: p.fornecedor_id ?? null }).select('id').single();
  if (r.error && (r.error.code === 'PGRST204' || r.error.code === '42703' || /fornecedor_id/i.test(r.error.message || ''))) {
    r = await sb.from('lancamentos').insert(base).select('id').single();
  }
  return r.error ? null : (r.data as { id: number });
}
export async function estornarDespesa(lancamentoId: number | null): Promise<void> {
  if (lancamentoId != null) await sb.from('lancamentos').delete().eq('id', lancamentoId);
}

// authHeaders re-exportado para chamadas autenticadas (cron de teste etc.).
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
