import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getAuthUser, unauthorized } from '@/lib/apiAuth'

// Perfil + preferências do cliente. GET devolve dados do usuário (usuarios) e as
// preferências (preferencias_cliente, com defaults). POST atualiza nome/telefone
// e faz upsert das preferências de notificação/tema.

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const admin = supabaseAdmin as any

const PREFS_DEFAULT = {
  notif_email: true, notif_push: true, notif_whatsapp: false, novidades: true, tema: 'auto',
}

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return unauthorized()

  const { data: perfil } = await admin
    .from('usuarios')
    .select('nome, telefone, documento, nascimento, usuario, seucodigo, criado_em')
    .eq('id', user.id)
    .maybeSingle()

  let preferencias = PREFS_DEFAULT
  try {
    const { data: prefs } = await admin.from('preferencias_cliente').select('*').eq('user_id', user.id).maybeSingle()
    if (prefs) preferencias = { ...PREFS_DEFAULT, ...prefs }
  } catch { /* tabela ausente — usa defaults */ }

  return Response.json({
    email: user.email ?? null,
    perfil: perfil || { nome: user.email?.split('@')[0] ?? '' },
    preferencias,
  })
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return unauthorized()

  const body = await req.json().catch(() => ({}))

  // ── Dados do usuário ───────────────────────────────────────────────────────
  const patch: Record<string, unknown> = {}
  if (typeof body.nome === 'string' && body.nome.trim()) patch.nome = body.nome.trim()
  if (typeof body.telefone === 'string') patch.telefone = body.telefone.trim() || null
  if (Object.keys(patch).length) {
    const { error } = await admin.from('usuarios').update(patch).eq('id', user.id)
    if (error) return Response.json({ error: error.message }, { status: 500 })
  }

  // ── Preferências ───────────────────────────────────────────────────────────
  if (body.preferencias && typeof body.preferencias === 'object') {
    const p = body.preferencias as Record<string, unknown>
    const row: Record<string, unknown> = { user_id: user.id, atualizado_em: new Date().toISOString() }
    for (const k of ['notif_email', 'notif_push', 'notif_whatsapp', 'novidades']) {
      if (typeof p[k] === 'boolean') row[k] = p[k]
    }
    if (typeof p.tema === 'string' && ['auto', 'claro', 'escuro'].includes(p.tema)) row.tema = p.tema
    try {
      const { error } = await admin.from('preferencias_cliente').upsert(row, { onConflict: 'user_id' })
      if (error) return Response.json({ error: error.message }, { status: 500 })
    } catch {
      return Response.json({ error: 'Rode docs/sql/area-cliente.sql para salvar preferências.' }, { status: 500 })
    }
  }

  return Response.json({ ok: true })
}
