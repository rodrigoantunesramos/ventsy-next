import { NextRequest } from 'next/server'
import { reprocessarPendentes } from '@/lib/webhooksServer'

// Reprocessa entregas de webhook que FALHARAM e já estão na hora de retentar
// (backoff: 1min→5min→30min→2h→6h, ver lib/integracoes). Idempotente e limitado.
// Segurança: exige CRON_SECRET (a Vercel injeta Authorization: Bearer <secret>;
// teste manual com ?secret=<CRON_SECRET>). Registre no pg_cron do Supabase
// apontando para https://www.ventsy.com.br/api/cron/webhooks-retry (o vercel.json
// Hobby não comporta mais crons — ver memória do projeto).

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const LIMITE = 50

function autorizado(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const bearer = (req.headers.get('authorization') || '').replace('Bearer ', '').trim()
  const qs = new URL(req.url).searchParams.get('secret') || ''
  return bearer === secret || qs === secret
}

export async function GET(req: NextRequest) {
  if (!autorizado(req)) return Response.json({ error: 'não autorizado' }, { status: 401 })
  const r = await reprocessarPendentes(LIMITE)
  return Response.json({ ok: true, ...r })
}
