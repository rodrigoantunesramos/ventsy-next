import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Callback do OAuth (ex.: "Entrar com Google"). O provedor redireciona para cá
// com ?code; trocamos o code por uma sessão (cookies httpOnly via @supabase/ssr)
// e seguimos para o destino. O fluxo só funciona com o provedor HABILITADO no
// Supabase Auth (painel) — sem isso, o signInWithOAuth nem chega aqui.
export async function GET(req: NextRequest) {
  const { searchParams, origin } = req.nextUrl
  const code = searchParams.get('code')
  const nextParam = searchParams.get('next') || ''
  // Só caminhos internos (evita open-redirect).
  const destino = nextParam.startsWith('/') && !nextParam.startsWith('//') ? nextParam : '/painel'

  if (code) {
    const res = NextResponse.redirect(`${origin}${destino}`)
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return req.cookies.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => res.cookies.set(name, value, options))
          },
        },
      },
    )
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) return res
  }
  // Sem code ou falha na troca → volta ao login sinalizando o erro.
  return NextResponse.redirect(`${origin}/login?erro=oauth`)
}
