// _lib — modelo, constantes e helpers do módulo Fornecedores (/painel/fornecedores).
// Compartilhado entre a Lista (page.tsx) e a Ficha ([id]/page.tsx).
// Regra de ouro: NADA de "R$"/percentual/data formatada aqui — só números/datas
// cruas; toda a formatação fica em lib/format, chamada nas páginas.

import { supabase as sb } from '@/lib/supabase';

// ── Tipos (espelham docs/sql/fornecedores.sql) ───────────────────────────────
export type TipoForn = 'pf' | 'pj';
export type Homologacao = 'homologado' | 'em_analise' | 'bloqueado';

export type Banco = { banco?: string; agencia?: string; conta?: string; titular?: string };

export type Fornecedor = {
  id: string;
  usuario_id: string;
  tipo: TipoForn;
  nome: string;
  fantasia: string | null;
  doc: string | null;
  categoria: string;
  contato: string | null;
  email: string | null;
  telefone: string | null;
  whatsapp: string | null;
  site: string | null;
  endereco: string | null;
  cidade: string | null;
  estado: string | null;
  condicoes_pagamento: string | null;
  prazo_entrega_dias: number | null;
  chave_pix: string | null;
  banco: Banco;
  homologacao: Homologacao;
  avaliacao_media: number;
  avaliacao_n: number;
  tags: string[];
  ativo: boolean;
  obs: string | null;
  criado_em: string;
  atualizado_em: string;
};

export type Contato = {
  id: string;
  fornecedor_id: string;
  usuario_id: string;
  nome: string;
  cargo: string | null;
  email: string | null;
  telefone: string | null;
  whatsapp: string | null;
  principal: boolean;
  obs: string | null;
  criado_em: string;
};

export type CriterioKey = 'qualidade' | 'prazo' | 'preco' | 'atendimento';
export type Avaliacao = {
  id: string;
  fornecedor_id: string;
  usuario_id: string;
  evento_id: string | null;
  nota: number;
  criterios: Partial<Record<CriterioKey, number>>;
  comentario: string | null;
  data: string;
  criado_em: string;
};

export type FornDoc = {
  id: string;
  fornecedor_id: string;
  usuario_id: string;
  nome: string;
  tipo: string;
  numero: string | null;
  emissao: string | null;
  validade: string | null;
  arquivo_url: string | null;
  arquivo_nome: string | null;
  arquivo_tipo: string | null;
  arquivo_tamanho: number | null;
  obs: string | null;
  criado_em: string;
};

// Despesa de "Contas a pagar" (lançamento) atribuída ao fornecedor.
export type DespesaLite = {
  id: number;
  fornecedor_id: string | null;
  categoria: string | null;
  descricao: string | null;
  valor: number;
  data: string;
  status: string;            // pago | pendente | atrasado
  tipo_evento: string | null;
  metodo_pagamento: string | null;
};

// Evento (para vincular avaliação pós-evento) — subconjunto de clientes_eventos.
export type EventoLite = {
  id: string;
  nome_evento: string | null;
  tipo_evento: string | null;
  data_inicio: string | null;
};

// ── Categorias (filtros + donut + selects) ───────────────────────────────────
export const CATEGORIAS: { v: string; label: string; cor: string }[] = [
  { v: 'buffet',      label: 'Buffet / Catering',  cor: '#ff385c' },
  { v: 'som',         label: 'Som & Iluminação',   cor: '#8b5cf6' },
  { v: 'decoracao',   label: 'Decoração & Flores',  cor: '#ec4899' },
  { v: 'estrutura',   label: 'Estrutura & Tendas',  cor: '#f97316' },
  { v: 'locacao',     label: 'Locação de itens',    cor: '#f59e0b' },
  { v: 'seguranca',   label: 'Segurança',           cor: '#1a73e8' },
  { v: 'limpeza',     label: 'Limpeza & Sanitários', cor: '#14b8a6' },
  { v: 'bebidas',     label: 'Bebidas',             cor: '#10b981' },
  { v: 'fotografia',  label: 'Foto & Vídeo',        cor: '#0ea5e9' },
  { v: 'transporte',  label: 'Transporte & Valet',  cor: '#64748b' },
  { v: 'grafica',     label: 'Gráfica & Convites',  cor: '#a855f7' },
  { v: 'energia',     label: 'Energia & Geradores', cor: '#eab308' },
  { v: 'outro',       label: 'Outro',               cor: '#94a3b8' },
];
export const CAT_BY: Record<string, (typeof CATEGORIAS)[number]> =
  Object.fromEntries(CATEGORIAS.map((c) => [c.v, c]));
export function catLabel(v: string | null): string { return CAT_BY[v || 'outro']?.label || v || '—'; }
export function catCor(v: string | null): string { return CAT_BY[v || 'outro']?.cor || '#94a3b8'; }

// ── Homologação ──────────────────────────────────────────────────────────────
export const HOMOLOGACOES: { v: Homologacao; label: string; cls: string; dot: string }[] = [
  { v: 'homologado', label: 'Homologado', cls: 'bg-emerald-50 text-emerald-700', dot: 'bg-emerald-500' },
  { v: 'em_analise', label: 'Em análise', cls: 'bg-amber-50 text-amber-700', dot: 'bg-amber-500' },
  { v: 'bloqueado',  label: 'Bloqueado',  cls: 'bg-red-50 text-red-700', dot: 'bg-red-500' },
];
export const HOMOLOG_BY: Record<Homologacao, (typeof HOMOLOGACOES)[number]> =
  Object.fromEntries(HOMOLOGACOES.map((h) => [h.v, h])) as Record<Homologacao, (typeof HOMOLOGACOES)[number]>;

// ── Critérios de avaliação (qualidade, prazo, preço, atendimento) ────────────
export const CRITERIOS: { v: CriterioKey; label: string; icon: string }[] = [
  { v: 'qualidade',   label: 'Qualidade',   icon: '✨' },
  { v: 'prazo',       label: 'Prazo',       icon: '⏱️' },
  { v: 'preco',       label: 'Preço',       icon: '🏷️' },
  { v: 'atendimento', label: 'Atendimento', icon: '🤝' },
];

// Nota geral = média dos critérios preenchidos (1–5). 0 se nenhum.
export function notaDeCriterios(c: Partial<Record<CriterioKey, number>>): number {
  const vals = CRITERIOS.map((k) => c[k.v]).filter((n): n is number => typeof n === 'number' && n > 0);
  if (!vals.length) return 0;
  return Math.round((vals.reduce((s, n) => s + n, 0) / vals.length) * 100) / 100;
}

// ── Documentos: tipos + checklist de homologação ─────────────────────────────
export const DOC_TIPOS: { v: string; label: string }[] = [
  { v: 'contrato', label: 'Contrato' },
  { v: 'certidao', label: 'Certidão (CND)' },
  { v: 'alvara',   label: 'Alvará / Licença' },
  { v: 'seguro',   label: 'Seguro / Apólice' },
  { v: 'outro',    label: 'Outro' },
];
export const DOC_TIPO_LABEL: Record<string, string> =
  Object.fromEntries(DOC_TIPOS.map((d) => [d.v, d.label]));

// Para homologar um fornecedor, esperamos estes documentos (operacional).
export const CHECKLIST_HOMOLOG: { tipo: string; label: string; obrigatorio: boolean }[] = [
  { tipo: 'contrato', label: 'Contrato de prestação', obrigatorio: true },
  { tipo: 'certidao', label: 'Certidão negativa (CND)', obrigatorio: true },
  { tipo: 'alvara',   label: 'Alvará / Licença', obrigatorio: false },
  { tipo: 'seguro',   label: 'Seguro / Apólice', obrigatorio: false },
];

// ── Helpers genéricos ─────────────────────────────────────────────────────────
export function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function soDigitos(s: string | null | undefined): string { return (s || '').replace(/\D/g, ''); }
export { waLink } from '@/lib/waLink';
export function telLink(fone: string | null | undefined): string | null {
  const d = soDigitos(fone);
  return d ? `tel:+${d.length <= 11 ? '55' + d : d}` : null;
}
export function mailLink(email: string | null | undefined): string | null {
  return email && email.includes('@') ? `mailto:${email.trim()}` : null;
}
export function siteLink(url: string | null | undefined): string | null {
  const s = (url || '').trim();
  if (!s) return null;
  return /^https?:\/\//i.test(s) ? s : `https://${s}`;
}
export function iniciais(nome: string): string {
  const partes = (nome || '?').trim().split(/\s+/).filter(Boolean);
  if (!partes.length) return '?';
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}
export function fonePreferido(f: Fornecedor): string | null { return f.whatsapp || f.telefone || null; }

// ── Gasto (Contas a pagar) por fornecedor ─────────────────────────────────────
export type GastoForn = { total: number; ytd: number; n: number; ultima: string | null };
export function gastoPorFornecedor(despesas: DespesaLite[], anoRef: number): Map<string, GastoForn> {
  const m = new Map<string, GastoForn>();
  for (const d of despesas) {
    if (!d.fornecedor_id) continue;
    const g = m.get(d.fornecedor_id) || { total: 0, ytd: 0, n: 0, ultima: null };
    g.total += d.valor; g.n++;
    if ((d.data || '').slice(0, 4) === String(anoRef)) g.ytd += d.valor;
    if (!g.ultima || (d.data || '') > g.ultima) g.ultima = d.data || null;
    m.set(d.fornecedor_id, g);
  }
  return m;
}

// ── Validade de documentos (mesma lógica de /painel/documentos) ───────────────
export type DocStatus = 'vencido' | 'avencer' | 'emdia' | 'permanente';
export const DOC_STATUS_META: Record<DocStatus, { label: string; cls: string; cor: string }> = {
  vencido:    { label: 'Vencido',    cls: 'bg-red-50 text-red-700 border-red-200', cor: '#dc2626' },
  avencer:    { label: 'A vencer',   cls: 'bg-amber-50 text-amber-700 border-amber-200', cor: '#d97706' },
  emdia:      { label: 'Em dia',     cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', cor: '#16a34a' },
  permanente: { label: 'Permanente', cls: 'bg-blue-50 text-blue-700 border-blue-200', cor: '#1a73e8' },
};
export function diasRestantes(validade: string | null): number | null {
  if (!validade) return null;
  const alvo = new Date(validade + 'T00:00:00').getTime();
  const hoje = new Date(new Date().toDateString()).getTime();
  return Math.round((alvo - hoje) / 86400000);
}
export function docStatus(validade: string | null, diasAviso = 30): DocStatus {
  if (!validade) return 'permanente';
  const d = diasRestantes(validade)!;
  if (d < 0) return 'vencido';
  if (d <= diasAviso) return 'avencer';
  return 'emdia';
}
export function diasLabel(dias: number | null): string {
  if (dias == null) return 'Não vence';
  if (dias < 0) return `Vencido há ${Math.abs(dias)} ${Math.abs(dias) === 1 ? 'dia' : 'dias'}`;
  if (dias === 0) return 'Vence hoje';
  if (dias === 1) return 'Vence amanhã';
  return `${dias} dias restantes`;
}
export function formatBytes(n: number | null): string {
  if (!n) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1048576) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1048576).toFixed(1)} MB`;
}

// ── Supabase Storage (reutiliza o bucket `documentos`) ────────────────────────
export const BUCKET = 'documentos';
export type UploadResult = { arquivo_url: string; arquivo_nome: string; arquivo_tipo: string | null; arquivo_tamanho: number };

export async function uploadDoc(uid: string, file: File): Promise<UploadResult> {
  const ext = file.name.includes('.') ? '.' + file.name.split('.').pop() : '';
  const path = `${uid}/fornecedores/${crypto.randomUUID()}${ext}`;
  const { error } = await sb.storage.from(BUCKET).upload(path, file, { upsert: false, contentType: file.type || undefined });
  if (error) throw error;
  return { arquivo_url: path, arquivo_nome: file.name, arquivo_tipo: file.type || null, arquivo_tamanho: file.size };
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
export const isImagem = (tipo: string | null) => !!tipo && tipo.startsWith('image/');
export const isPdf = (tipo: string | null) => tipo === 'application/pdf';

// ── De-dupe + CSV (importar/exportar) ─────────────────────────────────────────
export function chaveDedupe(x: { doc?: string | null; email?: string | null; nome?: string | null }): string {
  const d = soDigitos(x.doc);
  if (d) return 'doc:' + d;
  if (x.email && x.email.includes('@')) return 'mail:' + x.email.trim().toLowerCase();
  return 'nome:' + (x.nome || '').trim().toLowerCase();
}

export function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = '', i = 0, q = false;
  const t = text.replace(/\r\n?/g, '\n');
  while (i < t.length) {
    const ch = t[i];
    if (q) {
      if (ch === '"') { if (t[i + 1] === '"') { cell += '"'; i++; } else q = false; }
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += ch;
    i++;
  }
  if (cell.length || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

export type ImportRow = { nome: string; fantasia: string; doc: string; categoria: string; email: string; telefone: string; cidade: string; estado: string; tipo: TipoForn };
// Mapeia uma categoria livre do CSV para uma das chaves conhecidas (heurística).
function normalizaCategoria(s: string): string {
  const v = s.trim().toLowerCase();
  if (!v) return 'outro';
  const hit = CATEGORIAS.find((c) => c.v === v || c.label.toLowerCase().includes(v) || v.includes(c.v));
  return hit ? hit.v : 'outro';
}
export function importFornecedoresCSV(text: string): ImportRow[] {
  const grid = parseCSV(text);
  if (grid.length < 2) return [];
  const head = grid[0].map((h) => h.trim().toLowerCase());
  const idx = (alts: string[]) => head.findIndex((h) => alts.includes(h));
  const iNome = idx(['nome', 'name', 'razao social', 'razão social', 'fornecedor']);
  const iFant = idx(['fantasia', 'nome fantasia', 'apelido']);
  const iDoc = idx(['doc', 'documento', 'cnpj', 'cpf', 'cpf/cnpj']);
  const iCat = idx(['categoria', 'segmento', 'tipo de servico', 'serviço']);
  const iEmail = idx(['email', 'e-mail']);
  const iTel = idx(['telefone', 'phone', 'celular', 'whatsapp', 'fone', 'contato']);
  const iCid = idx(['cidade', 'city']);
  const iEst = idx(['estado', 'uf', 'state']);
  const at = (r: string[], i: number) => (i >= 0 ? (r[i] || '').trim() : '');
  return grid.slice(1).map((r) => {
    const doc = at(r, iDoc);
    return {
      nome: at(r, iNome) || at(r, iFant) || at(r, iEmail) || 'Sem nome',
      fantasia: at(r, iFant),
      doc, categoria: normalizaCategoria(at(r, iCat)),
      email: at(r, iEmail), telefone: at(r, iTel),
      cidade: at(r, iCid), estado: at(r, iEst).toUpperCase().slice(0, 2),
      tipo: (soDigitos(doc).length > 11 ? 'pj' : 'pf') as TipoForn,
    };
  }).filter((r) => r.nome && r.nome !== 'Sem nome');
}

export function exportFornecedoresCSV(rows: { f: Fornecedor; gasto: GastoForn }[]): void {
  const header = ['Nome', 'Fantasia', 'Tipo', 'Documento', 'Categoria', 'Cidade', 'UF', 'E-mail', 'Telefone', 'Homologação', 'Avaliação', 'Nº avaliações', 'Gasto total', 'Gasto no ano', 'Ativo'];
  const esc = (s: string) => `"${(s || '').replace(/"/g, '""')}"`;
  const body = rows.map(({ f, gasto }) => [
    esc(f.nome), esc(f.fantasia || ''), f.tipo, esc(f.doc || ''), esc(catLabel(f.categoria)),
    esc(f.cidade || ''), esc(f.estado || ''), esc(f.email || ''), esc(f.telefone || ''),
    HOMOLOG_BY[f.homologacao].label, f.avaliacao_media || 0, f.avaliacao_n || 0,
    gasto.total, gasto.ytd, f.ativo ? 'sim' : 'não',
  ].join(',')).join('\n');
  const blob = new Blob(['﻿' + header.join(',') + '\n' + body], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `fornecedores-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
  URL.revokeObjectURL(url);
}
