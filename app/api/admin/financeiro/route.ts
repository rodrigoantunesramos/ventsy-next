import type { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/adminAuth'
import { forbidden } from '@/lib/apiAuth'
import { supabaseAdminAny } from '@/lib/supabaseAdmin'

// Visão financeira da plataforma (assinaturas + MRR/ARR). Via service-role após
// requireAdmin — por isso enxerga as assinaturas de TODOS (o admin legado via 0,
// pois a RLS de `assinaturas` só expõe as do próprio usuário). MRR usa os preços
// de `planos_config`.
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const ctx = await requireAdmin(req, 'financeiro', 'ver')
  if (!ctx) return forbidden()

  const admin = supabaseAdminAny
  const [{ data: assinaturas }, { data: planos }, { data: usuarios }] = await Promise.all([
    admin
      .from('assinaturas')
      .select('usuario_id, plano_ativo, status, inicio_periodo, fim_periodo, valor_pago')
      .order('inicio_periodo', { ascending: false }),
    admin.from('planos_config').select('id, preco'),
    admin.from('usuarios').select('id, nome, email'),
  ])

  const precoMap = new Map<string, number>()
  for (const p of (planos ?? []) as Array<{ id: string; preco: number }>) {
    precoMap.set(p.id, Number(p.preco) || 0)
  }
  const userMap = new Map<string, { nome?: string; email?: string }>()
  for (const u of (usuarios ?? []) as Array<{ id: string; nome?: string; email?: string }>) {
    userMap.set(u.id, { nome: u.nome, email: u.email })
  }

  const lista = (assinaturas ?? []) as Array<Record<string, unknown>>
  let mrr = 0
  let ativas = 0
  let trial = 0
  let canceladas = 0
  let receitaHistorica = 0

  const rows = lista.map((a) => {
    const status = (a.status as string) ?? '—'
    if (status === 'ativa') ativas++
    else if (status === 'trial') trial++
    else if (status === 'cancelada' || status === 'expirada') canceladas++
    if (status === 'ativa' || status === 'trial') mrr += precoMap.get(a.plano_ativo as string) ?? 0
    receitaHistorica += Number(a.valor_pago) || 0
    return {
      usuario:
        userMap.get(a.usuario_id as string)?.nome ??
        userMap.get(a.usuario_id as string)?.email ??
        '—',
      plano: (a.plano_ativo as string) ?? '—',
      status,
      inicio: (a.inicio_periodo as string) ?? null,
      fim: (a.fim_periodo as string) ?? null,
      valor_pago: Number(a.valor_pago) || 0,
    }
  })

  return Response.json({
    metricas: { mrr, arr: mrr * 12, ativas, trial, canceladas, receitaHistorica, total: lista.length },
    assinaturas: rows,
  })
}
