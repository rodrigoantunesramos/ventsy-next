import { cache } from 'react'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

// Leitura server-side (service-role) dos campos da propriedade necessários para
// metadata e JSON-LD. O conteúdo interativo continua na ilha _PropriedadeClient.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const admin = supabaseAdmin as any

export type PropMeta = {
  id: number
  nome: string | null
  descricao: string | null
  cidade: string | null
  estado: string | null
  capacidade: number | string | null
  valor_base: number | null
  valor_hora: number | null
  avaliacao: number | null
  imagem_url: string | null
  tipo_propriedade: string | null
  publicada: boolean | null
  nAvaliacoes: number
}

// Forma mínima de foto para semear a galeria no SSR (espelha o mapeamento do
// cliente em _PropriedadeClient). Mantida em sincronia com a interface `Foto` lá.
export type FotoMeta = {
  url: string
  titulo: string
  ordem: number
  tipo: string | null
  focal_x: number | null
  focal_y: number | null
  alt: string | null
}

export const fetchPropriedadeMeta = cache(async (id: number): Promise<PropMeta | null> => {
  if (!id || Number.isNaN(id)) return null
  try {
    const { data: prop } = await admin
      .from('propriedades')
      .select('id,nome,descricao,cidade,estado,capacidade,valor_base,valor_hora,avaliacao,imagem_url,tipo_propriedade,publicada')
      .eq('id', id)
      .maybeSingle()
    if (!prop) return null

    let nAvaliacoes = 0
    try {
      const { count } = await admin
        .from('avaliacoes')
        .select('id', { count: 'exact', head: true })
        .eq('propriedade_id', id)
        .eq('verificada', true)
        .eq('oculta', false)
      nAvaliacoes = count || 0
    } catch {
      /* tabela de avaliações ausente — segue sem aggregateRating */
    }

    return { ...prop, nAvaliacoes } as PropMeta
  } catch {
    return null
  }
})

// Primeiras fotos da propriedade lidas no servidor para semear a galeria já no
// HTML (melhora o LCP: o herói entra com `priority` e não espera o fetch do
// cliente). O cliente re-busca a lista completa e enriquece em seguida.
export const fetchPropriedadeFotos = cache(async (id: number): Promise<FotoMeta[]> => {
  if (!id || Number.isNaN(id)) return []
  try {
    const { data } = await admin
      .from('fotos_imovel')
      .select('url,secao,ordem,tipo,focal_x,focal_y,alt')
      .eq('propriedade_id', id)
      .order('ordem', { ascending: true })
      .limit(12)
    return (data || []).map((f: { url: string; secao: string | null; ordem: number; tipo: string | null; focal_x: number | null; focal_y: number | null; alt: string | null }) => ({
      url: f.url,
      titulo: f.secao || '',
      ordem: f.ordem,
      tipo: f.tipo ?? null,
      focal_x: f.focal_x ?? null,
      focal_y: f.focal_y ?? null,
      alt: f.alt ?? null,
    }))
  } catch {
    return []
  }
})
