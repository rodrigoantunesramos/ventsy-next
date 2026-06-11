import { createServerClient } from '@supabase/ssr'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import type { Database } from '@/types/supabase'

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// ──────────────────────────────────────────────────────────────────────────
// Client de SERVIDOR ciente da sessão (lê/grava cookies do request).
// Use em Server Components, Route Handlers e Server Actions quando a operação
// deve respeitar a identidade do usuário logado (RLS aplicada como o usuário).
// A sessão é mantida em cookies pelo @supabase/ssr + middleware.
// ──────────────────────────────────────────────────────────────────────────
export function supabaseServer(): SupabaseClient<Database> {
  const cookieStore = cookies()
  return createServerClient<Database>(URL, ANON, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          )
        } catch {
          // Chamado de um Server Component (não pode setar cookie) — ok, o
          // middleware (updateSession) é quem renova os cookies da resposta.
        }
      },
    },
  })
}

// ──────────────────────────────────────────────────────────────────────────
// Client ANÔNIMO "puro" server-safe — SEM sessão/cookies. Para leituras
// públicas que não dependem de quem está logado (ex.: dumps de /api/table/*,
// listagens públicas). Equivale ao comportamento anon que essas rotas já tinham.
// ──────────────────────────────────────────────────────────────────────────
let _rest: SupabaseClient<Database> | undefined
function restClient(): SupabaseClient<Database> {
  if (!_rest) {
    _rest = createClient<Database>(URL, ANON, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  }
  return _rest
}

export const supabaseRest: SupabaseClient<Database> = new Proxy(
  {} as SupabaseClient<Database>,
  {
    get(_, prop: string | symbol) {
      return (restClient() as unknown as Record<string | symbol, unknown>)[prop]
    },
  },
)

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const supabaseRestAny = supabaseRest as any
