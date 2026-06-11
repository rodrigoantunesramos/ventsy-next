import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'

// ──────────────────────────────────────────────────────────────────────────
// Client de NAVEGADOR (Client Components). A sessão é persistida em COOKIES
// pelo @supabase/ssr, para que o servidor (middleware, Server Components e
// Route Handlers via lib/supabaseServer) também enxergue o usuário logado.
// SERVER-side: use lib/supabaseServer (auth-aware) ou lib/supabaseAdmin.
// ──────────────────────────────────────────────────────────────────────────

type TypedClient = SupabaseClient<Database>

let _client: TypedClient | undefined

// Lazy singleton — adiado para o módulo nunca tocar `document` durante o
// prerender/SSG do build do Next (só instancia no primeiro uso, no browser).
function client(): TypedClient {
  if (!_client) {
    _client = createBrowserClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )
  }
  return _client
}

export const supabase: TypedClient = new Proxy({} as TypedClient, {
  get(_, prop: string | symbol) {
    return (client() as unknown as Record<string | symbol, unknown>)[prop]
  },
})

// Untyped client for tables not yet in the generated schema (pending migrations).
// Replace usages with typed equivalents after the corresponding migration is applied.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const supabaseAny = supabase as any

// Authorization header da sessão atual do navegador (vazio se deslogado).
// Mantido por compatibilidade durante a migração para cookies: as rotas que
// ainda dependem do Bearer continuam funcionando. Quando todas as rotas lerem
// a sessão via cookie (lib/supabaseServer), este helper pode ser removido.
export async function authHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}
}
