import type { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/adminAuth'
import { forbidden } from '@/lib/apiAuth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

// Métricas-chave da plataforma para o Dashboard do admin. Como requireAdmin já
// autorizou, usa service-role e enxerga dados que a RLS esconde do admin legado
// (ex.: assinaturas/analytics de TODOS os usuários — que hoje aparecem zerados).
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const ctx = await requireAdmin(req, 'dashboard', 'ver')
  if (!ctx) return forbidden()

  const admin = supabaseAdmin

  const [usuarios, propriedadesTotal, propriedadesPublicadas, cupons] = await Promise.all([
    admin.from('usuarios').select('*', { count: 'exact', head: true }).then((r) => r.count ?? 0),
    admin.from('propriedades').select('*', { count: 'exact', head: true }).then((r) => r.count ?? 0),
    admin
      .from('propriedades')
      .select('*', { count: 'exact', head: true })
      .eq('publicada', true)
      .then((r) => r.count ?? 0),
    admin.from('cupons').select('*', { count: 'exact', head: true }).then((r) => r.count ?? 0),
  ])

  const { data: assinaturas } = await admin.from('assinaturas').select('status, plano_ativo')
  const lista = (assinaturas ?? []) as Array<{ status?: string; plano_ativo?: string }>

  const assinaturasPorStatus: Record<string, number> = {}
  const ativasPorPlano: Record<string, number> = {}
  for (const a of lista) {
    const st = a.status ?? 'desconhecido'
    assinaturasPorStatus[st] = (assinaturasPorStatus[st] ?? 0) + 1
    if (st === 'ativa' || st === 'trial') {
      const pl = a.plano_ativo ?? 'basico'
      ativasPorPlano[pl] = (ativasPorPlano[pl] ?? 0) + 1
    }
  }

  return Response.json({
    usuarios,
    propriedades: {
      total: propriedadesTotal,
      publicadas: propriedadesPublicadas,
      pendentes: Math.max(0, propriedadesTotal - propriedadesPublicadas),
    },
    assinaturas: {
      total: lista.length,
      porStatus: assinaturasPorStatus,
      ativasPorPlano,
    },
    cupons,
  })
}
