import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { HOLD_MS } from '../../bilheteria/_shared'

// Libera reservas de ingresso (hold) vencidas — disparado por Vercel Cron.
// Um pedido 'pendente' criado há mais que a janela de hold (sem pagamento) vira
// 'expirado', e seus ingressos 'reservado' viram 'cancelado' — devolvendo os
// assentos ao lote (o trigger de `vendido` nem precisa mexer, pois reserva não
// conta como vendido). A UI/checkout já trata reservas vencidas como livres em
// tempo real (lib/bilheteria via _shared.ocupadosPorCategoria); este cron é a
// limpeza autoritativa. Espelha /api/cron/expirar-holds.
//
// Segurança: exige CRON_SECRET. A Vercel injeta `Authorization: Bearer <secret>`.
// Teste manual: ?secret=<CRON_SECRET>. Simulação: ?dry=1.

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const admin = supabaseAdmin as any

function autorizado(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const bearer = (req.headers.get('authorization') || '').replace('Bearer ', '').trim()
  return bearer === secret
}

export async function GET(req: NextRequest) {
  if (!autorizado(req)) return Response.json({ error: 'não autorizado' }, { status: 401 })
  const dry = new URL(req.url).searchParams.get('dry') === '1'
  const cutoff = new Date(Date.now() - HOLD_MS).toISOString()

  const { data: vencidos, error } = await admin
    .from('pedidos_ingresso')
    .select('id')
    .eq('status', 'pendente')
    .lt('criado_em', cutoff)
  if (error) return Response.json({ error: error.message }, { status: 500 })

  const ids = (vencidos || []).map((r: { id: string }) => r.id)
  if (dry || ids.length === 0) return Response.json({ dry, vencidos: ids.length })

  // Cancela os ingressos reservados desses pedidos e expira os pedidos.
  const { error: e1 } = await admin.from('ingressos').update({ status: 'cancelado' }).in('pedido_id', ids).eq('status', 'reservado')
  if (e1) return Response.json({ error: e1.message }, { status: 500 })
  const { error: e2 } = await admin.from('pedidos_ingresso').update({ status: 'expirado' }).in('id', ids)
  if (e2) return Response.json({ error: e2.message }, { status: 500 })

  return Response.json({ dry: false, expirados: ids.length })
}
