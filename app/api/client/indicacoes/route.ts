import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getAuthUser, unauthorized } from '@/lib/apiAuth'

// Indique & Ganhe do cliente. GET garante o código de indicação (usuarios.seucodigo
// via RPC garantir_seucodigo) e devolve o histórico. POST { action:'convidar',
// email, nome? } registra um convite pendente para o usuário acompanhar.

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const admin = supabaseAdmin as any

async function obterCodigo(uid: string): Promise<string> {
  // 1) RPC que gera/garante o código (SECURITY DEFINER).
  try {
    const { data, error } = await admin.rpc('garantir_seucodigo', { p_user: uid })
    if (!error && data) return String(data)
  } catch { /* segue para fallback */ }
  // 2) Fallback: lê o que já houver.
  try {
    const { data } = await admin.from('usuarios').select('seucodigo').eq('id', uid).maybeSingle()
    if (data?.seucodigo) return String(data.seucodigo)
  } catch { /* sem usuarios */ }
  return ''
}

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return unauthorized()

  const codigo = await obterCodigo(user.id)
  let indicacoes: unknown[] = []
  let needsSetup = false
  try {
    const { data, error } = await admin
      .from('indicacoes_cliente')
      .select('*')
      .eq('indicador_id', user.id)
      .order('criado_em', { ascending: false })
    if (error) needsSetup = true
    else indicacoes = data || []
  } catch {
    needsSetup = true
  }
  return Response.json({ codigo, indicacoes, needsSetup })
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return unauthorized()

  const body = await req.json().catch(() => ({}))
  const action = String(body.action || '')

  if (action !== 'convidar') {
    return Response.json({ error: 'Ação inválida.' }, { status: 400 })
  }

  const email = String(body.email || '').trim().toLowerCase()
  const nome = String(body.nome || '').trim() || null
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return Response.json({ error: 'Informe um e-mail válido.' }, { status: 400 })
  }

  const codigo = await obterCodigo(user.id)

  // Evita duplicar o mesmo e-mail convidado pelo mesmo usuário.
  const { data: existente } = await admin
    .from('indicacoes_cliente')
    .select('id')
    .eq('indicador_id', user.id)
    .eq('indicado_email', email)
    .maybeSingle()
  if (existente) return Response.json({ ok: true, duplicado: true })

  const { error } = await admin.from('indicacoes_cliente').insert({
    indicador_id: user.id, indicado_email: email, indicado_nome: nome,
    codigo, status: 'pendente',
  })
  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json({ ok: true })
}
