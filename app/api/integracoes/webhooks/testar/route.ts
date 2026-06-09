import { NextRequest } from 'next/server'
import { getAuthUser, unauthorized } from '@/lib/apiAuth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { entregarTeste } from '@/lib/webhooksServer'

// POST /api/integracoes/webhooks/testar { id } — envia uma entrega de TESTE
// assinada (HMAC) à URL da assinatura e registra no log. Prova a entrega + a
// assinatura sem depender de um evento real acontecer.

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const admin = supabaseAdmin as any

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return unauthorized()
  const b = await req.json().catch(() => ({}))
  const id = String(b?.id || '')
  if (!id) return Response.json({ error: 'id obrigatório.' }, { status: 400 })

  const { data: sub } = await admin
    .from('integracoes_webhooks').select('id, usuario_id, url, segredo, evento')
    .eq('id', id).eq('usuario_id', user.id).maybeSingle()
  if (!sub) return Response.json({ error: 'Webhook não encontrado.' }, { status: 404 })

  const r = await entregarTeste(sub, sub.evento)
  return Response.json({ ok: r.ok, status: r.status })
}
