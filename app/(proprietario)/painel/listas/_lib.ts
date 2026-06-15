// Listas Oficiais — tipos, constantes e helpers puros da página /painel/listas.
// Compartilhado entre page.tsx e _components/Editor.tsx. Sem dependência de React
// nem de Supabase: só dados e transformações (fácil de testar e reusar).

export type ItemTipo = 'espaco' | 'fornecedor' | 'servico';

export type Lista = {
  id: string;
  usuario_id: string;
  autor_nome: string | null;
  titulo: string;
  slug: string;
  descricao: string | null;
  capa_url: string | null;
  categoria: string | null;
  cidade: string | null;
  publica: boolean;
  curtidas: number;
  salvos: number;
  n_itens: number;
  criado_em: string;
  atualizado_em: string;
};

export type ListaItem = {
  id: string;
  lista_id: string;
  usuario_id: string;
  propriedade_id: number | null;
  nome_externo: string | null;
  ref_nome: string | null;
  ref_cidade: string | null;
  ref_imagem: string | null;
  tipo: ItemTipo;
  nota: number | null;
  comentario: string | null;
  ordem: number;
};

// Item enquanto editado no construtor (antes de persistir). `key` é só p/ o React.
export type DraftItem = {
  key: string;
  propriedade_id: number | null;
  nome_externo: string | null;
  ref_nome: string | null;
  ref_cidade: string | null;
  ref_imagem: string | null;
  tipo: ItemTipo;
  nota: number | null;
  comentario: string | null;
};

// Propriedade da plataforma exibida no buscador de itens.
export type PropriedadeLite = {
  id: number;
  nome: string | null;
  cidade: string | null;
  estado: string | null;
  imagem_url: string | null;
  avaliacao: number | null;
  tipo_propriedade: string | null;
};

// ── Constantes ───────────────────────────────────────────────────────────────
export const CATEGORIAS: { v: string; label: string }[] = [
  { v: 'casamento', label: 'Casamento' },
  { v: 'aniversario', label: 'Aniversário & Festas' },
  { v: 'corporativo', label: 'Corporativo' },
  { v: 'show', label: 'Shows & Festivais' },
  { v: 'formatura', label: 'Formatura' },
  { v: 'infantil', label: 'Infantil' },
  { v: 'fornecedores', label: 'Fornecedores' },
  { v: 'gastronomia', label: 'Gastronomia & Bar' },
  { v: 'outro', label: 'Outro' },
];

export const TIPOS_ITEM: { v: ItemTipo; label: string }[] = [
  { v: 'espaco', label: 'Espaço' },
  { v: 'fornecedor', label: 'Fornecedor' },
  { v: 'servico', label: 'Serviço' },
];

export function categoriaLabel(v: string | null | undefined): string {
  if (!v) return '';
  return CATEGORIAS.find((c) => c.v === v)?.label ?? v;
}

// ── Slug ─────────────────────────────────────────────────────────────────────
export function slugify(titulo: string): string {
  return `${titulo}`
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'lista';
}

/** Slug + sufixo curto aleatório p/ garantir unicidade sem ida ao banco. */
export function slugComSufixo(titulo: string, sufixo: string): string {
  return `${slugify(titulo)}-${sufixo}`;
}

// ── Erro de tabela ausente (degrade p/ needsSetup) ───────────────────────────
export { isMissingTable } from '@/lib/dbErrors'

// ── Normalização banco → tipos ───────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normLista(l: any): Lista {
  return {
    id: String(l.id),
    usuario_id: l.usuario_id ?? '',
    autor_nome: l.autor_nome ?? null,
    titulo: l.titulo ?? '',
    slug: l.slug ?? '',
    descricao: l.descricao ?? null,
    capa_url: l.capa_url ?? null,
    categoria: l.categoria ?? null,
    cidade: l.cidade ?? null,
    publica: !!l.publica,
    curtidas: Number(l.curtidas) || 0,
    salvos: Number(l.salvos) || 0,
    n_itens: Number(l.n_itens) || 0,
    criado_em: l.criado_em ?? '',
    atualizado_em: l.atualizado_em ?? '',
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normItem(i: any): ListaItem {
  return {
    id: String(i.id),
    lista_id: String(i.lista_id),
    usuario_id: i.usuario_id ?? '',
    propriedade_id: i.propriedade_id != null ? Number(i.propriedade_id) : null,
    nome_externo: i.nome_externo ?? null,
    ref_nome: i.ref_nome ?? null,
    ref_cidade: i.ref_cidade ?? null,
    ref_imagem: i.ref_imagem ?? null,
    tipo: (i.tipo ?? 'espaco') as ItemTipo,
    nota: i.nota != null ? Number(i.nota) : null,
    comentario: i.comentario ?? null,
    ordem: Number(i.ordem) || 0,
  };
}

let _k = 0;
export function itemToDraft(i: ListaItem): DraftItem {
  return {
    key: `it_${i.id}`,
    propriedade_id: i.propriedade_id,
    nome_externo: i.nome_externo,
    ref_nome: i.ref_nome,
    ref_cidade: i.ref_cidade,
    ref_imagem: i.ref_imagem,
    tipo: i.tipo,
    nota: i.nota,
    comentario: i.comentario,
  };
}

export function draftFromPropriedade(p: PropriedadeLite): DraftItem {
  return {
    key: `new_${++_k}`,
    propriedade_id: p.id,
    nome_externo: null,
    ref_nome: p.nome ?? 'Espaço',
    ref_cidade: [p.cidade, p.estado].filter(Boolean).join(', ') || null,
    ref_imagem: p.imagem_url ?? null,
    tipo: 'espaco',
    nota: null,
    comentario: null,
  };
}

export function draftExterno(nome: string, tipo: ItemTipo): DraftItem {
  return {
    key: `new_${++_k}`,
    propriedade_id: null,
    nome_externo: nome.trim(),
    ref_nome: nome.trim(),
    ref_cidade: null,
    ref_imagem: null,
    tipo,
    nota: null,
    comentario: null,
  };
}

/** Nome de exibição de um item (snapshot ou externo). */
export function itemNome(i: { ref_nome: string | null; nome_externo: string | null }): string {
  return (i.ref_nome || i.nome_externo || 'Item').trim();
}

// ── KPIs ─────────────────────────────────────────────────────────────────────
export function agregado(listas: Lista[]) {
  return {
    total: listas.length,
    publicas: listas.filter((l) => l.publica).length,
    curtidas: listas.reduce((s, l) => s + l.curtidas, 0),
    salvos: listas.reduce((s, l) => s + l.salvos, 0),
    itens: listas.reduce((s, l) => s + l.n_itens, 0),
  };
}
