import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const admin = supabaseAdmin as any

// GET /api/mp/oauth/callback — o Mercado Pago redireciona aqui com ?code&state.
// Troca o code pelos tokens do anfitrião e salva em host_mp (tabela travada).
export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const proto = req.headers.get('x-forwarded-proto') || url.protocol.replace(':', '')
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || url.host
  const base = `${proto}://${host}`
  const redirectUri = process.env.MP_REDIRECT_URI || `${base}/api/mp/oauth/callback`
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')

  if (!code || !state) return Response.redirect(`${base}/reservas?mp=erro`)

  const { data: row } = await admin.from('host_mp').select('usuario_id').eq('oauth_state', state).maybeSingle()
  if (!row) return Response.redirect(`${base}/reservas?mp=erro`)

  try {
    const resp = await fetch('https://api.mercadopago.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: process.env.MP_CLIENT_ID,
        client_secret: process.env.MP_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }),
    })
    const tok = await resp.json()
    if (!tok?.access_token) return Response.redirect(`${base}/reservas?mp=erro`)

    await admin
      .from('host_mp')
      .update({
        mp_user_id: tok.user_id != null ? String(tok.user_id) : null,
        mp_access_token: tok.access_token,
        mp_refresh_token: tok.refresh_token ?? null,
        mp_public_key: tok.public_key ?? null,
        conectado: true,
        oauth_state: null,
        atualizado_em: new Date().toISOString(),
      })
      .eq('usuario_id', row.usuario_id)

    return Response.redirect(`${base}/reservas?mp=conectado`)
  } catch {
    return Response.redirect(`${base}/reservas?mp=erro`)
  }
}
