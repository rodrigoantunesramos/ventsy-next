import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getAuthUser, unauthorized } from '@/lib/apiAuth'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const admin = supabaseAdmin as any

// GET /api/mp/status — diz se o anfitrião autenticado já conectou o Mercado Pago.
export async function GET(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return unauthorized()
  const { data } = await admin.from('host_mp').select('conectado').eq('usuario_id', user.id).maybeSingle()
  return Response.json({ conectado: !!data?.conectado })
}
