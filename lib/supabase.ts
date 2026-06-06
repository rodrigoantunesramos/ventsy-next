import { createClient, SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'

type TypedClient = SupabaseClient<Database>

let _client: TypedClient | undefined

// Lazy singleton — deferred so module import never throws during Next.js
// build-time static analysis when env vars aren't present in the build env.
function client(): TypedClient {
  if (!_client) {
    _client = createClient<Database>(
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
// Anexe em fetch() para rotas de API para que o servidor verifique o autor.
export async function authHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}
}
