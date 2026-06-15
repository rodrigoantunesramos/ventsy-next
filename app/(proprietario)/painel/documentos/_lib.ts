// Núcleo compartilhado do módulo Documentos (/painel/documentos/*).
// Tipos, constantes (categorias/status), helpers de validade e de Supabase Storage.

import { supabase as sb, authHeaders } from '@/lib/supabase';

// ── Tipo (espelha a tabela public.documentos) ──────────────────────────────────
export type Doc = {
  id: number;
  usuario_id?: string;
  prop_id?: number | null;
  nome: string;
  categoria: string;
  orgao: string | null;
  numero: string | null;
  emissao: string | null;
  vencimento: string | null;
  obs: string | null;
  arquivo_url: string | null;       // caminho no storage: {uid}/{uuid}.{ext}
  arquivo_nome: string | null;      // nome original do arquivo
  arquivo_tipo: string | null;      // mime-type
  arquivo_tamanho: number | null;   // bytes
  link_renovacao: string | null;
  passo_online: string | null;
  passo_presencial: string | null;
  login_portal: string | null;
  senha_portal: string | null;
  endereco_orgao: string | null;
  telefone_orgao: string | null;
  horario_orgao: string | null;
  dias_aviso: number;
  created_at?: string;
};

export type DocForm = {
  nome: string;
  categoria: string;
  orgao: string;
  numero: string;
  emissao: string;
  vencimento: string;
  dias_aviso: number;
  obs: string;
  link_renovacao: string;
  passo_online: string;
  passo_presencial: string;
  login_portal: string;
  senha_portal: string;
  endereco_orgao: string;
  telefone_orgao: string;
  horario_orgao: string;
};

export const EMPTY_FORM: DocForm = {
  nome: '', categoria: 'licencas', orgao: '', numero: '', emissao: '', vencimento: '',
  dias_aviso: 90, obs: '', link_renovacao: '', passo_online: '', passo_presencial: '',
  login_portal: '', senha_portal: '', endereco_orgao: '', telefone_orgao: '', horario_orgao: '',
};

export function docToForm(d: Doc): DocForm {
  return {
    nome: d.nome || '', categoria: d.categoria || 'outros', orgao: d.orgao || '', numero: d.numero || '',
    emissao: d.emissao || '', vencimento: d.vencimento || '', dias_aviso: d.dias_aviso ?? 90, obs: d.obs || '',
    link_renovacao: d.link_renovacao || '', passo_online: d.passo_online || '', passo_presencial: d.passo_presencial || '',
    // senha nunca é pré-preenchida no form: vem cifrada do banco e só é revelada
    // sob demanda via API. Em branco = manter a senha atual ao salvar.
    login_portal: d.login_portal || '', senha_portal: '', endereco_orgao: d.endereco_orgao || '',
    telefone_orgao: d.telefone_orgao || '', horario_orgao: d.horario_orgao || '',
  };
}

export function formToPayload(f: DocForm) {
  const t = (v: string) => (v.trim() ? v.trim() : null);
  return {
    nome: f.nome.trim(),
    categoria: f.categoria,
    orgao: t(f.orgao),
    numero: t(f.numero),
    emissao: f.emissao || null,
    vencimento: f.vencimento || null,
    dias_aviso: Number(f.dias_aviso) || 90,
    obs: t(f.obs),
    link_renovacao: t(f.link_renovacao),
    passo_online: t(f.passo_online),
    passo_presencial: t(f.passo_presencial),
    login_portal: t(f.login_portal),
    senha_portal: t(f.senha_portal),
    endereco_orgao: t(f.endereco_orgao),
    telefone_orgao: t(f.telefone_orgao),
    horario_orgao: t(f.horario_orgao),
  };
}

// ── Categorias ─────────────────────────────────────────────────────────────────
export type CatKey = 'licencas' | 'alvara' | 'juridico' | 'fiscal' | 'seguros' | 'outros';

export const CATS: { v: CatKey; label: string; color: string; bg: string }[] = [
  { v: 'licencas', label: 'Licenças',  color: '#dc2626', bg: '#fef2f2' },
  { v: 'alvara',   label: 'Alvarás',   color: '#d97706', bg: '#fffbeb' },
  { v: 'juridico', label: 'Jurídico',  color: '#1a73e8', bg: '#eff6ff' },
  { v: 'fiscal',   label: 'Fiscal',    color: '#ff385c', bg: 'rgba(255,56,92,0.07)' },
  { v: 'seguros',  label: 'Seguros',   color: '#16a34a', bg: '#f0fdf4' },
  { v: 'outros',   label: 'Outros',    color: '#6b7280', bg: '#f5f5f5' },
];

export const CAT_BY_V: Record<string, (typeof CATS)[number]> =
  Object.fromEntries(CATS.map((c) => [c.v, c]));

// ── Status de validade ─────────────────────────────────────────────────────────
export type StatusKey = 'vencido' | 'avencer' | 'emdia' | 'permanente';

export const STATUS_META: Record<StatusKey, { label: string; color: string; bgCls: string }> = {
  vencido:    { label: 'Vencido',    color: '#dc2626', bgCls: 'bg-red-50 text-red-700 border-red-200' },
  avencer:    { label: 'A vencer',   color: '#d97706', bgCls: 'bg-amber-50 text-amber-700 border-amber-200' },
  emdia:      { label: 'Em dia',     color: '#16a34a', bgCls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  permanente: { label: 'Permanente', color: '#1a73e8', bgCls: 'bg-blue-50 text-blue-700 border-blue-200' },
};

export const ORDEM_GRUPOS: StatusKey[] = ['vencido', 'avencer', 'emdia', 'permanente'];
export const GRUPO_LABEL: Record<StatusKey, string> = {
  vencido:    'Vencidos',
  avencer:    'A vencer',
  emdia:      'Em dia',
  permanente: 'Permanentes',
};

export type SortKey = 'vencimento' | 'nome' | 'categoria' | 'emissao';
export const SORT_OPTIONS: { v: SortKey; label: string }[] = [
  { v: 'vencimento', label: 'Vencimento' },
  { v: 'nome',       label: 'Nome' },
  { v: 'categoria',  label: 'Categoria' },
  { v: 'emissao',    label: 'Emissão' },
];

// ── Helpers de validade ────────────────────────────────────────────────────────
export function statusDe(venc: string | null, diasAviso = 90): StatusKey {
  if (!venc) return 'permanente';
  const diff = diasRestantes(venc)!;
  if (diff < 0) return 'vencido';
  if (diff <= diasAviso) return 'avencer';
  return 'emdia';
}

export function diasRestantes(venc: string | null): number | null {
  if (!venc) return null;
  const alvo = new Date(venc + 'T00:00:00').getTime();
  const hoje = new Date(new Date().toDateString()).getTime();
  return Math.round((alvo - hoje) / 86400000);
}

export function validadePct(emissao: string | null, vencimento: string | null): number {
  if (!vencimento || !emissao) return 100;
  const total   = new Date(vencimento).getTime() - new Date(emissao).getTime();
  const elapsed = Date.now()                      - new Date(emissao).getTime();
  if (total <= 0) return 0;
  return Math.max(0, Math.min(100, 100 - (elapsed / total) * 100));
}

export function diasLabel(dias: number | null): string {
  if (dias == null) return 'Não vence';
  if (dias < 0)  return `Vencido há ${Math.abs(dias)} ${Math.abs(dias) === 1 ? 'dia' : 'dias'}`;
  if (dias === 0) return 'Vence hoje!';
  if (dias === 1) return 'Vence amanhã';
  return `${dias} dias restantes`;
}

export function formatBytes(n: number | null): string {
  if (!n) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1048576) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1048576).toFixed(1)} MB`;
}

export function dataAviso(vencimento: string | null, diasAviso: number): string | null {
  if (!vencimento) return null;
  const d = new Date(vencimento + 'T00:00:00');
  d.setDate(d.getDate() - diasAviso);
  return d.toISOString().split('T')[0];
}

// ── Exportação CSV ─────────────────────────────────────────────────────────────
export function exportCsv(docs: Doc[]) {
  const head = ['Nome', 'Categoria', 'Órgão', 'Número', 'Emissão', 'Vencimento', 'Status', 'Arquivo'];
  const fmt = (v: string | null) => (v ? new Date(v + 'T00:00:00').toLocaleDateString('pt-BR') : '—');
  const esc = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
  const rows = docs.map((d) =>
    [
      d.nome,
      CAT_BY_V[d.categoria]?.label || d.categoria,
      d.orgao || '',
      d.numero || '',
      fmt(d.emissao),
      d.vencimento ? fmt(d.vencimento) : 'Permanente',
      STATUS_META[statusDe(d.vencimento, d.dias_aviso)].label,
      d.arquivo_nome || 'sem arquivo',
    ].map(esc).join(','),
  );
  const blob = new Blob(['﻿' + [head.map(esc).join(','), ...rows].join('\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `documentos_ventsy_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

// ── Supabase Storage ───────────────────────────────────────────────────────────
export const BUCKET = 'documentos';

export type UploadResult = {
  arquivo_url: string;
  arquivo_nome: string;
  arquivo_tipo: string | null;
  arquivo_tamanho: number;
};

export async function uploadArquivo(uid: string, file: File): Promise<UploadResult> {
  const ext = file.name.includes('.') ? '.' + file.name.split('.').pop() : '';
  const path = `${uid}/${crypto.randomUUID()}${ext}`;
  const { error } = await sb.storage.from(BUCKET).upload(path, file, {
    upsert: false,
    contentType: file.type || undefined,
  });
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

export function isImagem(tipo: string | null): boolean {
  return !!tipo && tipo.startsWith('image/');
}
export function isPdf(tipo: string | null): boolean {
  return tipo === 'application/pdf';
}

// ── Criptografia da senha do portal (via API, chave fica no servidor) ───────────
// Cifra a senha antes de o cliente gravá-la (texto puro nunca vai ao banco).
export async function encryptSenha(value: string): Promise<string | null> {
  if (!value.trim()) return null;
  const res = await fetch('/api/documentos/secret', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
    body: JSON.stringify({ action: 'encrypt', value }),
  });
  if (!res.ok) throw new Error('encrypt failed');
  const j = await res.json();
  return j.cipher ?? null;
}

// Revela (descriptografa) a senha de um documento — só o dono, sob demanda.
export async function revealSenha(id: number): Promise<string> {
  const res = await fetch('/api/documentos/secret', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
    body: JSON.stringify({ action: 'reveal', id }),
  });
  if (!res.ok) throw new Error('reveal failed');
  const j = await res.json();
  return j.value ?? '';
}

// ── Templates de documentos comuns para casas de eventos ───────────────────────
// Pré-preenchem o formulário ao criar um novo documento (premium onboarding).
export type Template = {
  id: string;
  nome: string;
  categoria: CatKey;
  orgao: string;
  dias_aviso: number;
  link_renovacao?: string;
  passo_online?: string;
  descricao: string;
};

export const TEMPLATES: Template[] = [
  {
    id: 'alvara-func', nome: 'Alvará de Funcionamento', categoria: 'alvara', orgao: 'Prefeitura Municipal',
    dias_aviso: 60, descricao: 'Autoriza o funcionamento do espaço no município.',
    passo_online: '1. Acesse o portal da Prefeitura.\n2. Vá em Serviços > Alvará de Funcionamento.\n3. Faça login com o e-CNPJ ou usuário do portal.\n4. Solicite a renovação e anexe os documentos exigidos.\n5. Pague a taxa (DAM) e aguarde a emissão.',
  },
  {
    id: 'avcb', nome: 'AVCB — Auto de Vistoria do Corpo de Bombeiros', categoria: 'licencas', orgao: 'Corpo de Bombeiros',
    dias_aviso: 90, descricao: 'Atesta que o imóvel atende às normas de segurança contra incêndio.',
    passo_online: '1. Acesse o portal do Corpo de Bombeiros do estado.\n2. Solicite a vistoria técnica.\n3. Garanta extintores, sinalização e saídas de emergência em dia.\n4. Aguarde a vistoria presencial.\n5. Baixe o AVCB após aprovação.',
  },
  {
    id: 'sanitaria', nome: 'Licença Sanitária', categoria: 'licencas', orgao: 'Vigilância Sanitária',
    dias_aviso: 60, descricao: 'Obrigatória para espaços que servem alimentos/bebidas.',
  },
  {
    id: 'ambiental', nome: 'Licença Ambiental', categoria: 'licencas', orgao: 'Órgão Ambiental Estadual',
    dias_aviso: 120, descricao: 'Controla ruído, resíduos e impacto ambiental do espaço.',
  },
  {
    id: 'publicidade', nome: 'Alvará de Publicidade', categoria: 'alvara', orgao: 'Prefeitura Municipal',
    dias_aviso: 60, descricao: 'Para fachada, placas e anúncios externos do espaço.',
  },
  {
    id: 'brigada', nome: 'Certificado de Brigada de Incêndio', categoria: 'licencas', orgao: 'Corpo de Bombeiros',
    dias_aviso: 60, descricao: 'Comprova equipe treinada para emergências.',
  },
  {
    id: 'seguro-rc', nome: 'Seguro de Responsabilidade Civil', categoria: 'seguros', orgao: 'Seguradora',
    dias_aviso: 45, descricao: 'Cobre danos a terceiros durante eventos.',
  },
  {
    id: 'seguro-incendio', nome: 'Seguro Contra Incêndio', categoria: 'seguros', orgao: 'Seguradora',
    dias_aviso: 45, descricao: 'Protege o imóvel e equipamentos.',
  },
  {
    id: 'cnpj', nome: 'Cartão CNPJ', categoria: 'fiscal', orgao: 'Receita Federal',
    dias_aviso: 90, link_renovacao: 'https://solucoes.receita.fazenda.gov.br/Servicos/cnpjreva/cnpjreva_solicitacao.asp',
    descricao: 'Comprovante de inscrição da empresa. Não vence, mas mantenha atualizado.',
  },
  {
    id: 'cnd', nome: 'Certidão Negativa de Débitos (CND)', categoria: 'fiscal', orgao: 'Receita Federal / Prefeitura',
    dias_aviso: 30, descricao: 'Comprova regularidade fiscal — costuma valer poucos meses.',
  },
  {
    id: 'contrato-social', nome: 'Contrato Social', categoria: 'juridico', orgao: 'Junta Comercial',
    dias_aviso: 90, descricao: 'Ato constitutivo da empresa.',
  },
  {
    id: 'ecad', nome: 'Autorização ECAD (música)', categoria: 'outros', orgao: 'ECAD',
    dias_aviso: 30, descricao: 'Licença para execução de música em eventos.',
  },
];
