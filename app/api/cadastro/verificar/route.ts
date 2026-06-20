import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

// Checagem de disponibilidade do cadastro (documento/email/usuário). Antes eram RPCs
// SECURITY DEFINER chamadas DIRETO pelo client anônimo — abrindo enumeração de
// e-mail/CPF/usuário (e `verificar_email` ainda dispara DELETE de zumbis em auth.users).
// Agora só por aqui: rate-limit por IP + service_role. As funções verificar_* têm o
// EXECUTE revogado de anon/authenticated (ver docs/sql/rate-limit-cadastro.sql).

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const admin = supabaseAdmin as any

const RPC: Record<string, { fn: string; arg: string }> = {
  documento: { fn: 'verificar_documento', arg: 'p_documento' },
  email:     { fn: 'verificar_email',     arg: 'p_email' },
  usuario:   { fn: 'verificar_usuario',   arg: 'p_usuario' },
}

const MAX = 20        // checagens por (tipo, IP)
const JANELA_SEG = 60 // por minuto

function ipDe(req: NextRequest): string {
  const xff = req.headers.get('x-forwarded-for') || ''
  return xff.split(',')[0].trim() || req.headers.get('x-real-ip') || 'sem-ip'
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const tipo = String(body?.tipo || '')
  const valor = String(body?.valor ?? '').slice(0, 320).trim()
  const cfg = RPC[tipo]
  if (!cfg || !valor) return Response.json({ error: 'requisição inválida' }, { status: 400 })

  // Rate-limit por (tipo, IP). Fail-open se o limiter falhar (é mitigação, não crítico).
  try {
    const { data: ok, error } = await admin.rpc('rate_limit_check', {
      p_chave: `cad:${tipo}:${ipDe(req)}`, p_max: MAX, p_janela_seg: JANELA_SEG,
    })
    if (!error && ok === false) return Response.json({ error: 'rate_limit' }, { status: 429 })
  } catch { /* fail-open */ }

  const { data, error } = await admin.rpc(cfg.fn, { [cfg.arg]: valor })
  if (error) return Response.json({ error: 'falha na verificação' }, { status: 502 })
  return Response.json({ existe: data === true })
}
