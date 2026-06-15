// Leitura PÚBLICA das Listas Oficiais (server-side, service-role) p/ as páginas
// (public)/listas e (public)/listas/[slug]. Roda só no servidor (server components),
// então usa supabaseAdmin para ler conteúdo de TODOS os autores filtrando
// `publica = true`. Não expõe usuario_id nem dados sensíveis ao HTML.

import { cache } from 'react';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const admin = supabaseAdmin as any;

export type PublicLista = {
  id: string;
  titulo: string;
  slug: string;
  descricao: string | null;
  capa_url: string | null;
  categoria: string | null;
  cidade: string | null;
  autor_nome: string | null;
  autor_id: string;            // só p/ "seguir autor" e relacionadas (uuid opaco)
  curtidas: number;
  salvos: number;
  n_itens: number;
  criado_em: string;
};

export type PublicItem = {
  id: string;
  propriedade_id: number | null;
  ref_nome: string | null;
  ref_cidade: string | null;
  ref_imagem: string | null;
  nome_externo: string | null;
  tipo: 'espaco' | 'fornecedor' | 'servico';
  nota: number | null;
  comentario: string | null;
  ordem: number;
};

export const CATEGORIA_LABEL: Record<string, string> = {
  casamento: 'Casamento',
  aniversario: 'Aniversário & Festas',
  corporativo: 'Corporativo',
  show: 'Shows & Festivais',
  formatura: 'Formatura',
  infantil: 'Infantil',
  fornecedores: 'Fornecedores',
  gastronomia: 'Gastronomia & Bar',
  outro: 'Outro',
};

export function categoriaLabel(v: string | null | undefined): string {
  if (!v) return '';
  return CATEGORIA_LABEL[v] ?? v;
}

export const TIPO_LABEL: Record<string, string> = {
  espaco: 'Espaço',
  fornecedor: 'Fornecedor',
  servico: 'Serviço',
};

const SELECT_LISTA =
  'id,titulo,slug,descricao,capa_url,categoria,cidade,autor_nome,usuario_id,curtidas,salvos,n_itens,criado_em';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapLista(l: any): PublicLista {
  return {
    id: String(l.id),
    titulo: l.titulo ?? '',
    slug: l.slug ?? '',
    descricao: l.descricao ?? null,
    capa_url: l.capa_url ?? null,
    categoria: l.categoria ?? null,
    cidade: l.cidade ?? null,
    autor_nome: l.autor_nome ?? null,
    autor_id: l.usuario_id ?? '',
    curtidas: Number(l.curtidas) || 0,
    salvos: Number(l.salvos) || 0,
    n_itens: Number(l.n_itens) || 0,
    criado_em: l.criado_em ?? '',
  };
}

/** Todas as listas públicas (recentes primeiro). Degrade p/ [] se a tabela faltar. */
export async function fetchListasPublicas(limit = 60): Promise<PublicLista[]> {
  const { data, error } = await admin
    .from('listas')
    .select(SELECT_LISTA)
    .eq('publica', true)
    .order('criado_em', { ascending: false })
    .limit(limit);
  if (error) return [];
  return ((data || []) as unknown[]).map(mapLista);
}

/** Uma lista pública pelo slug + seus itens (ordenados). null se não existir/privada.
 *  Memoizada por request (React cache) — generateMetadata e a página reusam 1 leitura. */
export const fetchListaPorSlug = cache(async (
  slug: string,
): Promise<{ lista: PublicLista; itens: PublicItem[] } | null> => {
  const { data: l, error } = await admin
    .from('listas')
    .select(SELECT_LISTA)
    .eq('slug', slug)
    .eq('publica', true)
    .maybeSingle();
  if (error || !l) return null;

  const { data: itensData } = await admin
    .from('listas_itens')
    .select('id,propriedade_id,ref_nome,ref_cidade,ref_imagem,nome_externo,tipo,nota,comentario,ordem')
    .eq('lista_id', l.id)
    .order('ordem', { ascending: true });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const itens: PublicItem[] = ((itensData || []) as any[]).map((i) => ({
    id: String(i.id),
    propriedade_id: i.propriedade_id != null ? Number(i.propriedade_id) : null,
    ref_nome: i.ref_nome ?? null,
    ref_cidade: i.ref_cidade ?? null,
    ref_imagem: i.ref_imagem ?? null,
    nome_externo: i.nome_externo ?? null,
    tipo: (i.tipo ?? 'espaco') as PublicItem['tipo'],
    nota: i.nota != null ? Number(i.nota) : null,
    comentario: i.comentario ?? null,
    ordem: Number(i.ordem) || 0,
  }));

  return { lista: mapLista(l), itens };
});

/** Listas relacionadas (mesma categoria ou cidade), excluindo a atual. */
export async function fetchRelacionadas(base: PublicLista, limit = 6): Promise<PublicLista[]> {
  let q = admin.from('listas').select(SELECT_LISTA).eq('publica', true).neq('id', base.id);
  if (base.categoria) q = q.eq('categoria', base.categoria);
  else if (base.cidade) q = q.eq('cidade', base.cidade);
  const { data, error } = await q.order('curtidas', { ascending: false }).limit(limit);
  if (error) return [];
  return ((data || []) as unknown[]).map(mapLista);
}

/** Engajamento p/ ranking/destaques. */
export function engajamento(l: PublicLista): number {
  return l.curtidas * 2 + l.salvos * 3 + l.n_itens;
}
