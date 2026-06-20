import type { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/adminAuth'
import { forbidden } from '@/lib/apiAuth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { registrarAcaoAdmin } from '@/lib/adminAudit'

// CRUD de cupons pelo admin (a tabela `cupons` tem policy is_admin, mas
// centralizamos na API service-role para manter o padrão e habilitar auditoria).
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const ctx = await requireAdmin(req, 'cupons', 'ver')
  if (!ctx) return forbidden()

  const { data } = await supabaseAdmin.from('cupons').select('*').order('criado_em', { ascending: false })
  const hoje = Date.now()
  const cupons = (data ?? []).map((c) => ({
    id: c.id,
    codigo: c.codigo,
    descricao: c.descricao ?? null,
    tipo: c.tipo ?? 'percent',
    valor: c.valor,
    plano: c.plano ?? 'todos',
    limite: c.limite ?? null,
    usos_atual: c.usos_atual ?? 0,
    validade: c.validade ?? null,
    ativo: c.ativo !== false,
    expirado: !!c.validade && Date.parse(String(c.validade)) < hoje,
  }))
  return Response.json({ cupons })
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
  const action = body.action as string | undefined
  const acaoRbac = action === 'excluir' ? 'excluir' : action === 'criar' ? 'criar' : 'editar'
  const ctx = await requireAdmin(req, 'cupons', acaoRbac)
  if (!ctx) return forbidden()
  await registrarAcaoAdmin(ctx, 'cupons', action ?? 'acao', (body.id as string) ?? (body.codigo as string) ?? null)

  const admin = supabaseAdmin

  if (action === 'criar') {
    const codigo = String(body.codigo || '').trim().toUpperCase()
    const valor = Number(body.valor)
    if (!codigo || !valor) return Response.json({ error: 'Informe código e valor.' }, { status: 400 })
    const registro = {
      codigo,
      valor,
      tipo: (body.tipo as string) || 'percent',
      plano: (body.plano as string) || 'todos',
      limite: body.limite ? Number(body.limite) : null,
      validade: (body.validade as string) || null,
      descricao: (body.descricao as string) || null,
      usos_atual: 0,
      ativo: true,
    }
    const { error } = await admin.from('cupons').insert(registro)
    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ ok: true })
  }

  const id = body.id as string
  if (!id) return Response.json({ error: 'ID ausente.' }, { status: 400 })

  if (action === 'excluir') {
    const { error } = await admin.from('cupons').delete().eq('id', id)
    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ ok: true })
  }
  if (action === 'ativar' || action === 'desativar') {
    const { error } = await admin.from('cupons').update({ ativo: action === 'ativar' }).eq('id', id)
    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ ok: true })
  }

  return Response.json({ error: 'Ação inválida.' }, { status: 400 })
}
