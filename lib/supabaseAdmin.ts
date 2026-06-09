import { createClient, SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'

// ⚠️ SERVER-ONLY. Usa a service_role key (ignora RLS). NUNCA importar em
// componentes de cliente ('use client') — vazaria o segredo no navegador.
// Use somente em Route Handlers / Server Actions.

type TypedClient = SupabaseClient<Database>

let _admin: TypedClient | undefined

function adminClient(): TypedClient {
  if (!_admin) {
    _admin = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    )
  }
  return _admin
}

// Proxy lazy — o módulo nunca lança no import durante o build do Next.
export const supabaseAdmin: TypedClient = new Proxy({} as TypedClient, {
  get(_, prop: string | symbol) {
    return (adminClient() as unknown as Record<string | symbol, unknown>)[prop]
  },
})

// Cliente admin SEM tipos — para tabelas ainda fora do schema gerado (migrations
// pendentes). Espelha `supabaseAny` de lib/supabase.ts. Troque por consultas
// tipadas após regenerar types/supabase.ts.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const supabaseAdminAny = supabaseAdmin as any
