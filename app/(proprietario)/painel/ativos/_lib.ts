// _lib — modelo, constantes e helpers do módulo Ativos & Bens (/painel/ativos).
// Compartilhado entre o Inventário (page.tsx) e a Ficha ([id]/page.tsx).
// Regra de ouro: NADA de "R$"/percentual/data formatada aqui — só números/datas
// cruas; toda a formatação fica em lib/format, chamada nas páginas.
// A matemática de depreciação/patrimônio fica no motor PURO lib/ativos.ts, que
// re-exportamos no fim para a página importar tudo de um lugar só.

import { supabaseAny as sb } from '@/lib/supabase';

// ── Tipos (espelham docs/sql/ativos.sql) ─────────────────────────────────────
export type Categoria = 'imovel' | 'movel' | 'equipamento' | 'veiculo' | 'estrutura' | 'ti' | 'outro';
export type Estado = 'novo' | 'bom' | 'regular' | 'ruim';
export type MetodoDeprec = 'linear' | 'nenhum';

export type Ativo = {
  id: string;
  usuario_id: string;
  codigo: string | null;
  nome: string;
  categoria: string;
  descricao: string | null;
  marca: string | null;
  modelo: string | null;
  num_serie: string | null;
  propriedade_id: number | null;
  localizacao: string | null;
  responsavel: string | null;
  fornecedor_id: string | null;
  data_aquisicao: string | null;
  valor_aquisicao_num: number;
  vida_util_meses: number | null;
  metodo_deprec: MetodoDeprec;
  valor_residual_num: number;
  estado: Estado;
  placa: string | null;
  renavam: string | null;
  ano_fabricacao: number | null;
  garantia_ate: string | null;
  seguradora: string | null;
  apolice: string | null;
  seguro_ate: string | null;
  baixado_em: string | null;
  motivo_baixa: string | null;
  valor_baixa_num: number | null;
  foto_url: string | null;
  obs: string | null;
  criado_em: string;
  atualizado_em: string;
};

export type AtivoMov = {
  id: string;
  ativo_id: string;
  usuario_id: string;
  tipo: 'aquisicao' | 'transferencia' | 'manutencao' | 'baixa' | 'reavaliacao' | 'depreciacao';
  data: string;
  de_propriedade_id: number | null;
  para_propriedade_id: number | null;
  de_local: string | null;
  para_local: string | null;
  de_responsavel: string | null;
  para_responsavel: string | null;
  valor_num: number | null;
  descricao: string | null;
  criado_em: string;
};

export type ManutTipo = 'preventiva' | 'corretiva' | 'inspecao' | 'melhoria';
export type ManutStatus = 'aberta' | 'planejada' | 'em_andamento' | 'aguardando_peca' | 'concluida' | 'cancelada';
export type ManutPrioridade = 'baixa' | 'media' | 'alta' | 'urgente';

export type AtivoManutencao = {
  id: string;
  ativo_id: string;
  usuario_id: string;
  tipo: ManutTipo;
  titulo: string;
  descricao: string | null;
  status: ManutStatus;
  prioridade: ManutPrioridade;
  responsavel: string | null;
  fornecedor_id: string | null;
  os_id: string | null;
  data_abertura: string;
  prazo: string | null;
  data_conclusao: string | null;
  custo_num: number;
  obs: string | null;
  criado_em: string;
};

export type AtivoDoc = {
  id: string;
  ativo_id: string;
  usuario_id: string;
  nome: string;
  tipo: 'nota' | 'manual' | 'garantia' | 'seguro' | 'outro';
  validade: string | null;
  arquivo_url: string | null;
  arquivo_nome: string | null;
  arquivo_tipo: string | null;
  arquivo_tamanho: number | null;
  obs: string | null;
  criado_em: string;
};

// Subconjunto de `propriedades` (onde o ativo fica).
export type PropriedadeLite = { id: number; nome: string | null; cidade: string | null };
// Subconjunto de `fornecedores` (onde o ativo foi comprado).
export type FornecedorLite = { id: string; nome: string; fantasia: string | null };

// ── Categorias (filtros + donut + selects) ───────────────────────────────────
export const CATEGORIAS: { v: Categoria; label: string; cor: string; icon: string }[] = [
  { v: 'imovel',      label: 'Imóveis',                cor: '#1a73e8', icon: '🏢' },
  { v: 'movel',       label: 'Móveis & Mobiliário',    cor: '#a855f7', icon: '🪑' },
  { v: 'equipamento', label: 'Equipamentos',           cor: '#ff385c', icon: '🔊' },
  { v: 'veiculo',     label: 'Veículos',               cor: '#f97316', icon: '🚐' },
  { v: 'estrutura',   label: 'Estruturas (tendas/palcos)', cor: '#14b8a6', icon: '⛺' },
  { v: 'ti',          label: 'TI & Informática',       cor: '#0ea5e9', icon: '💻' },
  { v: 'outro',       label: 'Outro',                  cor: '#94a3b8', icon: '📦' },
];
export const CAT_BY: Record<string, (typeof CATEGORIAS)[number]> =
  Object.fromEntries(CATEGORIAS.map((c) => [c.v, c]));
export function catLabel(v: string | null): string { return CAT_BY[v || 'outro']?.label || v || '—'; }
export function catCor(v: string | null): string { return CAT_BY[v || 'outro']?.cor || '#94a3b8'; }
export function catIcon(v: string | null): string { return CAT_BY[v || 'outro']?.icon || '📦'; }

// Vida útil sugerida (meses) por categoria — pré-preenche o formulário.
// Imóvel default trata a construção (25 anos); terreno deve usar método 'nenhum'.
export const VIDA_UTIL_PADRAO: Record<Categoria, number> = {
  imovel: 300, movel: 120, equipamento: 120, veiculo: 60, estrutura: 120, ti: 60, outro: 120,
};

// ── Estado (condição física) ─────────────────────────────────────────────────
export const ESTADOS: { v: Estado; label: string; cls: string; dot: string }[] = [
  { v: 'novo',    label: 'Novo',    cls: 'bg-emerald-50 text-emerald-700', dot: 'bg-emerald-500' },
  { v: 'bom',     label: 'Bom',     cls: 'bg-blue-50 text-blue-700',       dot: 'bg-blue-500' },
  { v: 'regular', label: 'Regular', cls: 'bg-amber-50 text-amber-700',     dot: 'bg-amber-500' },
  { v: 'ruim',    label: 'Ruim',    cls: 'bg-red-50 text-red-700',         dot: 'bg-red-500' },
];
export const ESTADO_BY: Record<string, (typeof ESTADOS)[number]> =
  Object.fromEntries(ESTADOS.map((e) => [e.v, e]));

// ── Baixa ─────────────────────────────────────────────────────────────────────
export const MOTIVOS_BAIXA: { v: string; label: string }[] = [
  { v: 'venda',        label: 'Venda' },
  { v: 'perda',        label: 'Perda' },
  { v: 'sucateamento', label: 'Sucateamento' },
  { v: 'doacao',       label: 'Doação' },
  { v: 'roubo',        label: 'Roubo / Furto' },
  { v: 'outro',        label: 'Outro' },
];

// ── Manutenção (tipos, status, prioridade) ───────────────────────────────────
export const MANUT_TIPOS: { v: ManutTipo; label: string; icon: string }[] = [
  { v: 'preventiva', label: 'Preventiva', icon: '🛡️' },
  { v: 'corretiva',  label: 'Corretiva',  icon: '🔧' },
  { v: 'inspecao',   label: 'Inspeção',   icon: '🔎' },
  { v: 'melhoria',   label: 'Melhoria',   icon: '✨' },
];
export const MANUT_TIPO_BY: Record<string, (typeof MANUT_TIPOS)[number]> =
  Object.fromEntries(MANUT_TIPOS.map((t) => [t.v, t]));

export const MANUT_STATUS: { v: ManutStatus; label: string; cls: string }[] = [
  { v: 'aberta',          label: 'Aberta',          cls: 'bg-amber-50 text-amber-700' },
  { v: 'planejada',       label: 'Planejada',       cls: 'bg-blue-50 text-blue-700' },
  { v: 'em_andamento',    label: 'Em andamento',    cls: 'bg-sky-50 text-sky-700' },
  { v: 'aguardando_peca', label: 'Aguardando peça', cls: 'bg-purple-50 text-purple-700' },
  { v: 'concluida',       label: 'Concluída',       cls: 'bg-emerald-50 text-emerald-700' },
  { v: 'cancelada',       label: 'Cancelada',       cls: 'bg-black/[0.04] text-ink-muted' },
];
export const MANUT_STATUS_BY: Record<string, (typeof MANUT_STATUS)[number]> =
  Object.fromEntries(MANUT_STATUS.map((s) => [s.v, s]));

export const MANUT_PRIORIDADES: { v: ManutPrioridade; label: string; cls: string }[] = [
  { v: 'baixa',   label: 'Baixa',   cls: 'bg-black/[0.04] text-ink-muted' },
  { v: 'media',   label: 'Média',   cls: 'bg-blue-50 text-blue-700' },
  { v: 'alta',    label: 'Alta',    cls: 'bg-amber-50 text-amber-700' },
  { v: 'urgente', label: 'Urgente', cls: 'bg-red-50 text-red-700' },
];
export const MANUT_PRIORIDADE_BY: Record<string, (typeof MANUT_PRIORIDADES)[number]> =
  Object.fromEntries(MANUT_PRIORIDADES.map((p) => [p.v, p]));

// ── Documentos ────────────────────────────────────────────────────────────────
export const DOC_TIPOS: { v: string; label: string }[] = [
  { v: 'nota',     label: 'Nota fiscal' },
  { v: 'manual',   label: 'Manual' },
  { v: 'garantia', label: 'Garantia' },
  { v: 'seguro',   label: 'Apólice / Seguro' },
  { v: 'outro',    label: 'Outro' },
];
export const DOC_TIPO_LABEL: Record<string, string> =
  Object.fromEntries(DOC_TIPOS.map((d) => [d.v, d.label]));

// ── Helpers genéricos ─────────────────────────────────────────────────────────
/** Data local 'YYYY-MM-DD' (default de inputs = hoje). */
export function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function soDigitos(s: string | null | undefined): string { return (s || '').replace(/\D/g, ''); }
export function iniciais(nome: string): string {
  const partes = (nome || '?').trim().split(/\s+/).filter(Boolean);
  if (!partes.length) return '?';
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}
export function isBaixado(a: Ativo): boolean { return !!a.baixado_em; }

// Validade de documentos/garantia (reaproveita a régua de dias do motor na página).
export function diasLabel(dias: number | null): string {
  if (dias == null) return 'Sem prazo';
  if (dias < 0) return `Vencido há ${Math.abs(dias)} ${Math.abs(dias) === 1 ? 'dia' : 'dias'}`;
  if (dias === 0) return 'Vence hoje';
  if (dias === 1) return 'Vence amanhã';
  return `${dias} dias restantes`;
}
export const VENC_META: Record<string, { label: string; cls: string; cor: string }> = {
  vencido: { label: 'Vencido',  cls: 'bg-red-50 text-red-700 border-red-200',         cor: '#dc2626' },
  avencer: { label: 'A vencer', cls: 'bg-amber-50 text-amber-700 border-amber-200',   cor: '#d97706' },
  emdia:   { label: 'Em dia',   cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', cor: '#16a34a' },
  sem:     { label: 'Sem prazo', cls: 'bg-black/[0.04] text-ink-muted border-black/10', cor: '#6b7280' },
};
export function formatBytes(n: number | null): string {
  if (!n) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1048576) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1048576).toFixed(1)} MB`;
}

// ── Supabase Storage (reutiliza o bucket `documentos`) ────────────────────────
export const BUCKET = 'documentos';
export type UploadResult = { arquivo_url: string; arquivo_nome: string; arquivo_tipo: string | null; arquivo_tamanho: number };

async function upload(uid: string, file: File, sub: string): Promise<UploadResult> {
  const ext = file.name.includes('.') ? '.' + file.name.split('.').pop() : '';
  const path = `${uid}/ativos/${sub}${crypto.randomUUID()}${ext}`;
  const { error } = await sb.storage.from(BUCKET).upload(path, file, { upsert: false, contentType: file.type || undefined });
  if (error) throw error;
  return { arquivo_url: path, arquivo_nome: file.name, arquivo_tipo: file.type || null, arquivo_tamanho: file.size };
}
export function uploadDoc(uid: string, file: File): Promise<UploadResult> { return upload(uid, file, ''); }
export function uploadFoto(uid: string, file: File): Promise<UploadResult> { return upload(uid, file, 'fotos/'); }

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
export const isImagem = (tipo: string | null) => !!tipo && tipo.startsWith('image/');
export const isPdf = (tipo: string | null) => tipo === 'application/pdf';

// ── Export CSV (inventário com valor contábil já calculado) ───────────────────
export type LinhaExport = { a: Ativo; valorContabil: number; acumulada: number; propriedade: string };
export function exportAtivosCSV(rows: LinhaExport[]): void {
  const header = ['Código', 'Nome', 'Categoria', 'Marca/Modelo', 'Nº série', 'Propriedade', 'Localização', 'Responsável',
    'Aquisição', 'Valor aquisição', 'Vida útil (meses)', 'Depreciação acum.', 'Valor contábil', 'Estado', 'Garantia até', 'Seguro até', 'Situação'];
  const esc = (s: string) => `"${(s || '').replace(/"/g, '""')}"`;
  const body = rows.map(({ a, valorContabil, acumulada, propriedade }) => [
    esc(a.codigo || ''), esc(a.nome), esc(catLabel(a.categoria)), esc([a.marca, a.modelo].filter(Boolean).join(' ')),
    esc(a.num_serie || ''), esc(propriedade), esc(a.localizacao || ''), esc(a.responsavel || ''),
    a.data_aquisicao || '', a.valor_aquisicao_num || 0, a.vida_util_meses ?? '', acumulada, valorContabil,
    esc(ESTADO_BY[a.estado]?.label || a.estado), a.garantia_ate || '', a.seguro_ate || '',
    a.baixado_em ? 'Baixado' : 'Em uso',
  ].join(',')).join('\n');
  const blob = new Blob(['﻿' + header.join(',') + '\n' + body], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url; link.download = `ativos-${ymd(new Date())}.csv`; link.click();
  URL.revokeObjectURL(url);
}

// ── Re-export do motor PURO (lib/ativos.ts) ───────────────────────────────────
export {
  num, round2, clamp, parseYmdUTC, ymdUTC, addMesesYmd, mesesCompletos, diasAte,
  depreciacaoMensal, depreciar, cronogramaAnual, resumoPatrimonio, statusVencimento,
  custoManutencao, manutencaoAbertas, indiceManutencao, sugereSubstituir,
} from '@/lib/ativos';
export type { Depreciacao, LinhaAno, ResumoPatrimonio, VencStatus, AtivoDeprec } from '@/lib/ativos';
