import { redirect } from 'next/navigation'
import type { NextRequest } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'
import { supabaseServer } from '@/lib/supabaseServer'

// Consome links de auth gerados server-side pelo admin: reset de senha e
// "Entrar como" (impersonação). Faz verifyOtp com o token_hash, o que estabelece
// a sessão nos COOKIES (server-side). Isso difere do fluxo implícito por hash
// (#access_token), que só cria a sessão no client e perde a corrida contra o
// gate do middleware em /painel. Depois redireciona para `next` (sanitizado).
export const dynamic = 'force-dynamic'

const TIPOS_OK: ReadonlySet<string> = new Set([
  'recovery',
  'magiclink',
  'email',
  'signup',
  'invite',
  'email_change',
])

// Aceita só caminho interno: começa com "/" e não com "//" nem "/\" (anti open-redirect).
function destinoSeguro(next: string | null, fallback: string): string {
  return next && /^\/(?![/\\])/.test(next) ? next : fallback
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type')
  const fallback = type === 'recovery' ? '/redefinir-senha' : '/painel'
  const next = destinoSeguro(searchParams.get('next'), fallback)

  if (tokenHash && type && TIPOS_OK.has(type)) {
    let ok = false
    try {
      const { error } = await supabaseServer().auth.verifyOtp({
        token_hash: tokenHash,
        type: type as EmailOtpType,
      })
      ok = !error
    } catch {
      ok = false
    }
    if (ok) redirect(next)
  }

  redirect('/login?erro=link_invalido')
}
