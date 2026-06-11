import type { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/adminAuth'
import { forbidden } from '@/lib/apiAuth'
import { supabaseAdminAny } from '@/lib/supabaseAdmin'
import { registrarAcaoAdmin } from '@/lib/adminAudit'

// Moderação de conteúdo — avaliações públicas (ocultar/exibir/destacar/excluir).
// Via service-role após requireAdmin; toda ação é auditada.
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const ctx = await requireAdmin(req, 'moderacao', 'ver')
  if (!ctx) return forbidden()

  const admin = supabaseAdminAny
  const filtro = new URL(req.url).searchParams.get('filtro') || 'todas'

  let q = admin
    .from('avaliacoes')
    .select('id, autor, nota, texto, propriedade_id, oculta, destaque, verificada, criado_em')
    .order('criado_em', { ascending: false })
    .limit(200)
  if (filtro === 'ocultas') q = q.eq('oculta', true)
  else if (filtro === 'visiveis') q = q.eq('oculta', false)

  const { data: avals } = await q
  const lista = (avals ?? []) as Array<Record<string, unknown>>

  const ids = Array.from(new Set(lista.map((a) => a.propriedade_id).filter(Boolean)))
  const propMap = new Map<number, string>()
  if (ids.length) {
    const { data: props } = await admin.from('propriedades').select('id, nome').in('id', ids)
    for (const p of (props ?? []) as Array<{ id: number; nome?: string }>) propMap.set(p.id, p.nome ?? '')
  }

  const avaliacoes = lista.map((a) => ({
    id: a.id as number,
    autor: (a.autor as string) ?? '—',
    nota: (a.nota as number) ?? 0,
    texto: (a.texto as string) ?? '',
    propriedade: propMap.get(a.propriedade_id as number) || `#${a.propriedade_id}`,
    oculta: a.oculta === true,
    destaque: a.destaque === true,
    verificada: a.verificada === true,
    criado_em: (a.criado_em as string) ?? null,
  }))

  return Response.json({ avaliacoes })
}

export async function POST(req: NextRequest) {
  const ctx = await requireAdmin(req, 'moderacao', 'editar')
  if (!ctx) return forbidden()

  const admin = supabaseAdminAny
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
  const action = body.action as string | undefined
  const id = body.id
  if (!action || id === undefined || id === null) {
    return Response.json({ error: 'Parâmetros ausentes.' }, { status: 400 })
  }

  if (action === 'excluir') {
    const { error } = await admin.from('avaliacoes').delete().eq('id', id)
    if (error) return Response.json({ error: error.message }, { status: 500 })
    await registrarAcaoAdmin(ctx, 'moderacao', 'excluir_avaliacao', String(id))
    return Response.json({ ok: true })
  }

  const patches: Record<string, Record<string, unknown>> = {
    ocultar: { oculta: true },
    mostrar: { oculta: false },
    destacar: { destaque: true },
    remover_destaque: { destaque: false },
  }
  const patch = patches[action]
  if (!patch) return Response.json({ error: 'Ação inválida.' }, { status: 400 })

  const { error } = await admin.from('avaliacoes').update(patch).eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  await registrarAcaoAdmin(ctx, 'moderacao', action, String(id))
  return Response.json({ ok: true })
}
