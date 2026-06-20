import type { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/adminAuth'
import { forbidden } from '@/lib/apiAuth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { registrarAcaoAdmin } from '@/lib/adminAudit'

// Moderação de propriedades pelo admin (fila de aprovação + destaque). Via
// service-role após requireAdmin (as RLS de propriedades já permitiam admin,
// mas centralizar na API mantém o padrão e habilita auditoria futura).
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const ctx = await requireAdmin(req, 'propriedades', 'ver')
  if (!ctx) return forbidden()

  const admin = supabaseAdmin
  const url = new URL(req.url)
  const status = url.searchParams.get('status') || 'todas' // pendentes|publicadas|todas
  const q = (url.searchParams.get('q') || '').toLowerCase().trim()

  let query = admin
    .from('propriedades')
    .select('id, nome, cidade, estado, capacidade, valor_base, publicada, destaque, usuario_id, criadoem')
    .order('criadoem', { ascending: false })
  if (status === 'pendentes') query = query.eq('publicada', false)
  else if (status === 'publicadas') query = query.eq('publicada', true)

  const { data: props } = await query
  const lista = (props ?? []) as Array<Record<string, unknown>>

  const ids = Array.from(new Set(lista.map((p) => p.usuario_id).filter(Boolean))) as string[]
  const donoMap = new Map<string, { nome?: string; email?: string }>()
  if (ids.length) {
    const { data: donos } = await admin.from('usuarios').select('id, nome, email').in('id', ids)
    for (const d of (donos ?? []) as Array<{ id: string; nome?: string; email?: string }>) {
      donoMap.set(d.id, { nome: d.nome, email: d.email })
    }
  }

  let rows = lista.map((p) => ({
    id: p.id,
    nome: (p.nome as string) ?? null,
    cidade: (p.cidade as string) ?? null,
    estado: (p.estado as string) ?? null,
    capacidade: (p.capacidade as number) ?? null,
    valor_base: (p.valor_base as number) ?? null,
    publicada: !!p.publicada,
    destaque: !!p.destaque,
    criadoem: (p.criadoem as string) ?? null,
    dono_nome: donoMap.get(p.usuario_id as string)?.nome ?? null,
    dono_email: donoMap.get(p.usuario_id as string)?.email ?? null,
  }))
  if (q) {
    rows = rows.filter((r) => [r.nome, r.cidade, r.dono_nome].some((v) => (v || '').toLowerCase().includes(q)))
  }

  return Response.json({ propriedades: rows })
}

export async function POST(req: NextRequest) {
  const ctx = await requireAdmin(req, 'propriedades', 'editar')
  if (!ctx) return forbidden()

  const admin = supabaseAdmin
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
  const action = body.action as string | undefined
  const id = body.id
  if (!action || id === undefined || id === null) {
    return Response.json({ error: 'Parâmetros ausentes.' }, { status: 400 })
  }

  const patches: Record<string, Record<string, unknown>> = {
    aprovar: { publicada: true },
    despublicar: { publicada: false },
    destacar: { destaque: true },
    remover_destaque: { destaque: false },
  }
  const patch = patches[action]
  if (!patch) return Response.json({ error: 'Ação inválida.' }, { status: 400 })
  await registrarAcaoAdmin(ctx, 'propriedades', action, String(id))

  const { error } = await admin.from('propriedades').update(patch).eq('id', id as number)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
