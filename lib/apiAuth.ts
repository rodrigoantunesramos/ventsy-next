import type { NextRequest } from 'next/server'
import { createClient, SupabaseClient } from '@supabase/supabase-js'

// Cliente leve só para VALIDAR o JWT do autor. Usa a anon key (pública), então
// a verificação de identidade não depende da saúde da service_role key.
// As operações privilegiadas (escrita ignorando RLS) seguem usando supabaseAdmin.
let _auth: SupabaseClient | undefined
function authClient(): SupabaseClient {
  if (!_auth) {
    _auth = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    )
  }
  return _auth
}

// Resolve e valida o autor da requisição a partir do header
// `Authorization: Bearer <access_token>` (token de sessão do Supabase).
// Retorna o usuário autenticado ou null se ausente/inválido.
// Use SEMPRE o id retornado aqui como identidade — nunca o `user_id` vindo
// do corpo/query, pois as rotas usam service-role (ignora RLS).
export async function getAuthUser(req: NextRequest) {
  const header = req.headers.get('authorization') || ''
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : ''
  if (!token) return null

  const { data, error } = await authClient().auth.getUser(token)
  if (error || !data?.user) return null
  return data.user
}

export function unauthorized() {
  return Response.json({ error: 'Não autenticado' }, { status: 401 })
}

export function forbidden() {
  return Response.json({ error: 'Acesso negado' }, { status: 403 })
}
