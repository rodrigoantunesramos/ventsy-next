import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// ──────────────────────────────────────────────────────────────────────────
// 1) Renova a sessão do Supabase a cada navegação (cookies httpOnly), para que
//    middleware, Server Components e Route Handlers enxerguem o usuário logado.
// 2) Gate de rotas protegidas: /painel e /client exigem sessão.
//    /admin NÃO entra aqui ainda — roda o admin.js legado com sessão própria
//    (fora dos cookies); será protegido server-side na Fatia E (shell React).
//
// IMPORTANTE (@supabase/ssr): não inserir lógica entre criar o client e chamar
// getUser() — risco de logout aleatório por dessincronia de cookies.
// ──────────────────────────────────────────────────────────────────────────
export async function middleware(req: NextRequest) {
  let res = NextResponse.next({ request: req })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value))
          res = NextResponse.next({ request: req })
          cookiesToSet.forEach(({ name, value, options }) =>
            res.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const path = req.nextUrl.pathname
  const exigeSessao = path.startsWith('/painel') || path.startsWith('/client')
  if (exigeSessao && !user) {
    const url = req.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('redirect', path)
    return NextResponse.redirect(url)
  }

  return res
}

export const config = {
  matcher: [
    // Tudo, exceto assets estáticos do Next e arquivos de imagem.
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
