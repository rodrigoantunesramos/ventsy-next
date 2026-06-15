import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { filtrosFromParams, aplicarFiltrosNaQuery, ordenarPorRelevancia, type SP } from './_filtros'

// Server-only: este módulo importa supabaseAdmin (service-role). NUNCA importar
// no client — a lógica de filtros pura fica em _filtros.ts.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const admin = supabaseAdmin as any

export type BuscaInicial = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  props: any[]
  planos: Record<string, string>
}

export async function fetchBuscaInicial(sp: SP): Promise<BuscaInicial> {
  const planos: Record<string, string> = {}
  try {
    const { data: assinaturas } = await admin
      .from('assinaturas').select('usuario_id, plano_ativo, status').in('status', ['ativa', 'trial'])
    ;(assinaturas || []).forEach((a: { usuario_id: string; plano_ativo: string }) => {
      const p = (a.plano_ativo || 'basico').toLowerCase()
      if (['basico', 'pro', 'ultra'].includes(p)) planos[a.usuario_id] = p
    })
  } catch { /* segue sem planos */ }

  const f = filtrosFromParams(sp)
  let query = admin.from('propriedades').select('*').eq('publicada', true)
  query = aplicarFiltrosNaQuery(query, sp)

  if (f.ultra) {
    const ultraIds = Object.entries(planos).filter(([, p]) => p === 'ultra').map(([uid]) => uid)
    if (ultraIds.length === 0) return { props: [], planos }
    query = query.in('usuario_id', ultraIds)
  }

  try {
    const { data } = await query.limit(60)
    return { props: ordenarPorRelevancia(data || [], planos), planos }
  } catch {
    return { props: [], planos }
  }
}
