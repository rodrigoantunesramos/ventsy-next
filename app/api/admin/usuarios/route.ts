import type { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/adminAuth'
import { forbidden } from '@/lib/apiAuth'
import { supabaseAdmin, supabaseAdminAny } from '@/lib/supabaseAdmin'

// Gestão de usuários pelo admin. Tudo via service-role (após requireAdmin), por
// isso enxerga/edita o que a RLS bloqueava no admin legado. Bloqueio/reativação
// usam a Supabase Admin API (auth.admin).
export const dynamic = 'force-dynamic'

function estaBanido(bannedUntil: string | null | undefined): boolean {
  if (!bannedUntil) return false
  const t = Date.parse(bannedUntil)
  return Number.isFinite(t) && t > Date.now()
}

export async function GET(req: NextRequest) {
  const ctx = await requireAdmin(req, 'usuarios', 'ver')
  if (!ctx) return forbidden()

  const admin = supabaseAdminAny
  const q = (new URL(req.url).searchParams.get('q') || '').toLowerCase().trim()

  const [{ data: perfis }, { data: assinaturas }] = await Promise.all([
    admin
      .from('usuarios')
      .select('id, nome, usuario, email, telefone, criado_em, cadastro_completo')
      .order('criado_em', { ascending: false }),
    admin.from('assinaturas').select('usuario_id, plano_ativo, status'),
  ])

  const assMap = new Map<string, { plano_ativo?: string; status?: string }>()
  for (const a of (assinaturas ?? []) as Array<{ usuario_id: string; plano_ativo?: string; status?: string }>) {
    assMap.set(a.usuario_id, a)
  }

  // Status de bloqueio (auth.users). Best-effort: se a Admin API falhar, segue sem.
  const banMap = new Map<string, string | null>()
  try {
    const { data } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 })
    for (const u of data?.users ?? []) {
      banMap.set(u.id, (u as unknown as { banned_until?: string | null }).banned_until ?? null)
    }
  } catch {
    /* segue sem status de bloqueio */
  }

  let rows = ((perfis ?? []) as Array<Record<string, unknown>>).map((p) => ({
    id: p.id as string,
    nome: (p.nome as string) ?? null,
    usuario: (p.usuario as string) ?? null,
    email: (p.email as string) ?? null,
    telefone: (p.telefone as string) ?? null,
    criado_em: (p.criado_em as string) ?? null,
    cadastro_completo: (p.cadastro_completo as boolean) ?? null,
    plano: assMap.get(p.id as string)?.plano_ativo ?? 'basico',
    status: assMap.get(p.id as string)?.status ?? 'sem plano',
    bloqueado: estaBanido(banMap.get(p.id as string)),
  }))

  if (q) {
    rows = rows.filter((r) =>
      [r.nome, r.email, r.usuario].some((v) => (v || '').toLowerCase().includes(q)),
    )
  }

  return Response.json({ usuarios: rows })
}

export async function POST(req: NextRequest) {
  const ctx = await requireAdmin(req, 'usuarios', 'editar')
  if (!ctx) return forbidden()

  const admin = supabaseAdminAny
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
  const action = body.action as string | undefined
  const id = body.id as string | undefined
  if (!action || !id) return Response.json({ error: 'Parâmetros ausentes.' }, { status: 400 })

  if (action === 'editar') {
    const patch: Record<string, unknown> = {}
    for (const campo of ['nome', 'usuario', 'telefone', 'documento'] as const) {
      if (campo in body) patch[campo] = body[campo]
    }
    if (Object.keys(patch).length === 0) {
      return Response.json({ error: 'Nada para atualizar.' }, { status: 400 })
    }
    const { error } = await admin.from('usuarios').update(patch).eq('id', id)
    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ ok: true })
  }

  if (action === 'bloquear' || action === 'reativar') {
    const ban_duration = action === 'bloquear' ? '876000h' : 'none'
    const { error } = await supabaseAdmin.auth.admin.updateUserById(
      id,
      { ban_duration } as unknown as Record<string, unknown>,
    )
    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ ok: true })
  }

  return Response.json({ error: 'Ação inválida.' }, { status: 400 })
}
