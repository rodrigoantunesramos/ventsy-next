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
