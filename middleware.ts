import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { isLocale, localizar, localeDoPath, defaultLocale, type Locale } from '@/lib/i18n/config'

// ──────────────────────────────────────────────────────────────────────────
// 1) Renova a sessão do Supabase a cada navegação (cookies httpOnly), para que
//    middleware, Server Components e Route Handlers enxerguem o usuário logado.
// 2) Gate de rotas protegidas: /painel e /client exigem sessão → /{locale}/login.
// 3) i18n: rotas públicas SEM prefixo de locale são redirecionadas para
//    /{locale}/… (locale via cookie NEXT_LOCALE → Accept-Language → 'pt').
//    Áreas internas, APIs e callbacks por token/auth NÃO recebem prefixo.
//
// IMPORTANTE (@supabase/ssr):
//  • Não inserir lógica entre criar o client e chamar getUser() — risco de
//    logout aleatório por dessincronia de cookies.
//  • Ao retornar um redirect próprio, COPIAR os cookies de `res` (a sessão
//    renovada vive neles), senão o refresh de token se perde.
// ──────────────────────────────────────────────────────────────────────────

// Prefixos que NUNCA recebem locale: áreas internas, APIs e callbacks por
// link/token (acessados fora do contexto de SEO).
const SEM_LOCALE = [
  '/painel',
  '/admin',
  '/client',
  '/api',
  '/auth', // /auth/confirm (reset de senha, impersonação)
  '/contrato',
  '/proposta',
  '/ingressos',
  '/feedback',
  '/pesquisa',
]
const ARQUIVOS = new Set(['/sitemap.xml', '/robots.txt', '/favicon.ico', '/manifest.webmanifest'])

function negociarLocale(req: NextRequest): Locale {
  const cookie = req.cookies.get('NEXT_LOCALE')?.value
  if (isLocale(cookie)) return cookie
  const accept = req.headers.get('accept-language') || ''
  for (const item of accept.split(',')) {
    const base = item.split(';')[0].trim().toLowerCase().split('-')[0]
    if (isLocale(base)) return base
  }
  return defaultLocale
}

// Caminhos que ficam fora do esquema de locale (não são prefixados).
function ehSemLocale(path: string): boolean {
  if (ARQUIVOS.has(path)) return true
  if (path.includes('.')) return true // arquivos com extensão escapados do matcher
  return SEM_LOCALE.some((p) => path === p || path.startsWith(p + '/'))
}

// Copia a sessão renovada (cookies de `res`) para um redirect próprio.
function redirecionar(url: URL, res: NextResponse, extraLocale?: Locale): NextResponse {
  const redir = NextResponse.redirect(url)
  res.cookies.getAll().forEach((c) => redir.cookies.set(c))
  if (extraLocale) {
    redir.cookies.set('NEXT_LOCALE', extraLocale, { path: '/', maxAge: 60 * 60 * 24 * 365 })
  }
  return redir
}

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
          cookiesToSet.forEach(({ name, value, options }) => res.cookies.set(name, value, options))
        },
      },
    },
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const path = req.nextUrl.pathname

  // 2) Gate de rotas protegidas (sem locale): /painel e /client exigem sessão.
  const exigeSessao = path.startsWith('/painel') || path.startsWith('/client')
  if (exigeSessao && !user) {
    const url = req.nextUrl.clone()
    url.pathname = localizar(negociarLocale(req), '/login')
    url.searchParams.set('redirect', path)
    return redirecionar(url, res)
  }

  // 3) Negociação de locale para rotas públicas sem prefixo.
  const jaTemLocale = localeDoPath(path)
  if (!jaTemLocale && !ehSemLocale(path)) {
    const locale = negociarLocale(req)
    const url = req.nextUrl.clone()
    url.pathname = localizar(locale, path)
    // 307 (temporário) de propósito: a escolha de locale é dinâmica
    // (cookie/Accept-Language). Um 301/308 seria cacheado e travaria o idioma.
    return redirecionar(url, res, locale)
  }

  // Mantém o cookie de locale alinhado ao prefixo da URL visitada.
  if (jaTemLocale) {
    res.cookies.set('NEXT_LOCALE', jaTemLocale, { path: '/', maxAge: 60 * 60 * 24 * 365 })
  }

  return res
}

export const config = {
  matcher: [
    // Tudo, exceto assets estáticos do Next e arquivos de imagem.
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
