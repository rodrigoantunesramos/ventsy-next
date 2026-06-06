import { NextRequest } from 'next/server'
import { randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getAuthUser, unauthorized } from '@/lib/apiAuth'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const admin = supabaseAdmin as any

// GET /api/mp/oauth/start — inicia a conexão da conta Mercado Pago do anfitrião.
// Retorna { url } para o cliente redirecionar ao MP. Requer auth.
export async function GET(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return unauthorized()

  const clientId = process.env.MP_CLIENT_ID
  if (!clientId) {
    return Response.json({ error: 'Conexão indisponível: MP_CLIENT_ID ausente no servidor.' }, { status: 503 })
  }

  const state = randomUUID()
  await admin
    .from('host_mp')
    .upsert(
      { usuario_id: user.id, oauth_state: state, atualizado_em: new Date().toISOString() },
      { onConflict: 'usuario_id' },
    )

  const proto = req.headers.get('x-forwarded-proto') || new URL(req.url).protocol.replace(':', '')
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || new URL(req.url).host
  const redirectUri = process.env.MP_REDIRECT_URI || `${proto}://${host}/api/mp/oauth/callback`
  const url =
    'https://auth.mercadopago.com.br/authorization' +
    `?client_id=${encodeURIComponent(clientId)}` +
    '&response_type=code&platform_id=mp' +
    `&state=${state}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}`

  return Response.json({ url })
}
