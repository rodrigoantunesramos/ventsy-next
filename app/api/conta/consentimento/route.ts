import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getAuthUser, unauthorized } from '@/lib/apiAuth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const admin = supabaseAdmin as any

// Versão vigente dos Termos de Uso / Política de Privacidade. Incremente ao
// publicar uma nova versão (a prova do aceite guarda esta string).
const POLITICA_VERSAO = '2026-06-13'

function clientInfo(req: NextRequest) {
  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim()
    || req.headers.get('x-real-ip') || ''
  const ua = req.headers.get('user-agent') || ''
  return { ip, ua }
}

// LGPD art. 8º, §1º — registra a PROVA (data + versão + IP + UA) do aceite dos
// Termos de Uso e Política de Privacidade pelo titular no cadastro. Server-side
// (service-role) para capturar IP/UA confiáveis. Idempotente por finalidade.
export async function POST(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return unauthorized()

  const body = (await req.json().catch(() => ({}))) as { nome?: string }

  // Não duplica o aceite de cadastro já vigente.
  const { data: existe } = await admin
    .from('lgpd_consentimentos')
    .select('id')
    .eq('usuario_id', user.id).eq('titular_id', user.id).eq('canal', 'site')
    .ilike('finalidade', 'Aceite dos Termos%').is('revogado_em', null)
    .limit(1).maybeSingle()
  if (existe) return Response.json({ ok: true, jaRegistrado: true })

  const { ip, ua } = clientInfo(req)
  const { error } = await admin.from('lgpd_consentimentos').insert({
    usuario_id: user.id,
    titular_tipo: 'outro',
    titular_id: user.id,
    titular_nome: String(body.nome || user.email || '').slice(0, 200) || null,
    finalidade: `Aceite dos Termos de Uso e Política de Privacidade (cadastro) — v${POLITICA_VERSAO}`,
    base_legal: 'consentimento',
    canal: 'site',
    evidencia: `versao=${POLITICA_VERSAO} · ip=${ip || 'n/d'} · ua=${ua.slice(0, 300)}`,
  })
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
