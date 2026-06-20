import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

// Libera reservas provisórias (hold) vencidas — disparado por Vercel Cron
// (ver vercel.json). Um hold com `hold_expira_em` no passado vira 'cancelada',
// devolvendo o espaço à agenda. A UI já trata holds vencidos como livres em
// tempo real (lib/reservas.holdExpirado); este cron é a limpeza autoritativa.
//
// Segurança: exige CRON_SECRET via `Authorization: Bearer <secret>` (header). Force
// simulação com ?dry=1. (O segredo NÃO é aceito por query string — evita vazá-lo em
// logs de acesso/proxy/Referer.)

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
  const agora = new Date().toISOString()

  const { data: vencidos, error } = await admin
    .from('reservas')
    .select('id')
    .eq('status', 'hold')
    .not('hold_expira_em', 'is', null)
    .lt('hold_expira_em', agora)
  if (error) return Response.json({ error: error.message }, { status: 500 })

  const ids = (vencidos || []).map((r: { id: string }) => r.id)
  if (dry || ids.length === 0) return Response.json({ dry, vencidos: ids.length })

  const { error: upErr } = await admin.from('reservas').update({ status: 'cancelada' }).in('id', ids)
  if (upErr) return Response.json({ error: upErr.message }, { status: 500 })
  return Response.json({ dry: false, liberados: ids.length })
}
