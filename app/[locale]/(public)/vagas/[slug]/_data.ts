import { cache } from 'react'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

// Leitura server-side (service-role) de uma vaga ABERTA pelo slug. Espelha
// app/api/rh/vaga; memoizada com react/cache para generateMetadata + page
// reusarem uma única consulta por request.
export type Vaga = {
  id: string
  titulo: string
  slug: string
  departamento: string | null
  tipo_contrato: string
  salario_min: number | null
  salario_max: number | null
  descricao: string | null
  requisitos: string | null
  beneficios: string | null
  local: string | null
  criado_em: string | null
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const admin = supabaseAdmin as any

export const fetchVagaPorSlug = cache(async (slug: string): Promise<Vaga | null> => {
  try {
    const { data } = await admin
      .from('rh_vagas')
      .select('id,titulo,slug,departamento,tipo_contrato,salario_min,salario_max,descricao,requisitos,beneficios,local,status,criado_em')
      .eq('slug', slug)
      .maybeSingle()
    if (!data || data.status !== 'aberta') return null
    return data as Vaga
  } catch {
    return null
  }
})
