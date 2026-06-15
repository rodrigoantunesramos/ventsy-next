import type { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/adminAuth'
import { forbidden } from '@/lib/apiAuth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import type { Json } from '@/types/supabase'
import { registrarAcaoAdmin } from '@/lib/adminAudit'

// Gestão da equipe de admin (tabela admin_membros). O módulo 'acessos' só é
// permitido ao super_admin (adminPode nega staff), então requireAdmin já barra
// não-super-admins. Inclui travas anti-lockout (não rebaixar/remover a si mesmo).
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const ctx = await requireAdmin(req, 'acessos', 'ver')
  if (!ctx) return forbidden()

  const admin = supabaseAdmin
  const { data: membros } = await admin
    .from('admin_membros')
    .select('usuario_id, papel, permissoes, ativo, criado_em')
    .order('criado_em', { ascending: true })

  const ids = ((membros ?? []) as Array<{ usuario_id: string }>).map((m) => m.usuario_id)
  const userMap = new Map<string, { nome?: string; email?: string }>()
  if (ids.length) {
    const { data: us } = await admin.from('usuarios').select('id, nome, email').in('id', ids)
    for (const u of (us ?? []) as Array<{ id: string; nome?: string; email?: string }>) {
      userMap.set(u.id, { nome: u.nome, email: u.email })
    }
  }

  const rows = ((membros ?? []) as Array<Record<string, unknown>>).map((m) => ({
    usuario_id: m.usuario_id as string,
    papel: (m.papel as string) ?? 'staff',
    permissoes: (m.permissoes as Record<string, string>) ?? {},
    ativo: m.ativo !== false,
    nome: userMap.get(m.usuario_id as string)?.nome ?? null,
    email: userMap.get(m.usuario_id as string)?.email ?? null,
    eu: m.usuario_id === ctx.userId,
  }))
  return Response.json({ membros: rows })
}

export async function POST(req: NextRequest) {
  const ctx = await requireAdmin(req, 'acessos', 'editar')
  if (!ctx) return forbidden()

  const admin = supabaseAdmin
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
  const action = body.action as string | undefined

  if (action === 'adicionar') {
    const email = String(body.email || '').trim().toLowerCase()
    const papel = (body.papel as string) === 'super_admin' ? 'super_admin' : 'staff'
    if (!email) return Response.json({ error: 'Informe o e-mail.' }, { status: 400 })
    const { data: u } = await admin.from('usuarios').select('id').eq('email', email).maybeSingle()
    if (!u) {
      return Response.json(
        { error: 'Nenhum usuário com esse e-mail. A pessoa precisa ter conta no Ventsy primeiro.' },
        { status: 404 },
      )
    }
    const { error } = await admin
      .from('admin_membros')
      .upsert(
        { usuario_id: u.id, papel, permissoes: {}, ativo: true, concedido_por: ctx.userId },
        { onConflict: 'usuario_id' },
      )
    if (error) return Response.json({ error: error.message }, { status: 500 })
    await registrarAcaoAdmin(ctx, 'acessos', 'conceder', email, { papel })
    return Response.json({ ok: true })
  }

  const id = body.id as string | undefined
  if (!id) return Response.json({ error: 'ID ausente.' }, { status: 400 })
  const ehVoceMesmo = id === ctx.userId

  if (action === 'papel') {
    const papel = (body.papel as string) === 'super_admin' ? 'super_admin' : 'staff'
    if (ehVoceMesmo && papel !== 'super_admin') {
      return Response.json({ error: 'Você não pode rebaixar a si mesmo.' }, { status: 400 })
    }
    const { error } = await admin.from('admin_membros').update({ papel }).eq('usuario_id', id)
    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ ok: true })
  }

  if (action === 'permissoes') {
    const permissoes = body.permissoes && typeof body.permissoes === 'object' ? body.permissoes : {}
    const { error } = await admin.from('admin_membros').update({ permissoes: permissoes as Json }).eq('usuario_id', id)
    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ ok: true })
  }

  if (action === 'ativar' || action === 'desativar') {
    if (ehVoceMesmo && action === 'desativar') {
      return Response.json({ error: 'Você não pode desativar a si mesmo.' }, { status: 400 })
    }
    const { error } = await admin.from('admin_membros').update({ ativo: action === 'ativar' }).eq('usuario_id', id)
    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ ok: true })
  }

  if (action === 'remover') {
    if (ehVoceMesmo) return Response.json({ error: 'Você não pode remover a si mesmo.' }, { status: 400 })
    const { error } = await admin.from('admin_membros').delete().eq('usuario_id', id)
    if (error) return Response.json({ error: error.message }, { status: 500 })
    await registrarAcaoAdmin(ctx, 'acessos', 'remover', id)
    return Response.json({ ok: true })
  }

  return Response.json({ error: 'Ação inválida.' }, { status: 400 })
}
