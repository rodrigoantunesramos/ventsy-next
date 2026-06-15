import type { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/adminAuth'
import { forbidden } from '@/lib/apiAuth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { registrarAcaoAdmin } from '@/lib/adminAudit'

// Edição de planos (preço/benefícios/status) na fonte única `planos_config`,
// consumida pelas páginas pública e do painel. Via service-role após requireAdmin.
export const dynamic = 'force-dynamic'

const PLANOS = ['basico', 'pro', 'ultra']

export async function GET(req: NextRequest) {
  const ctx = await requireAdmin(req, 'planos', 'ver')
  if (!ctx) return forbidden()

  const { data } = await supabaseAdmin.from('planos_config').select('*')
  const map = new Map<string, Record<string, unknown>>()
  for (const p of (data ?? []) as Array<Record<string, unknown>>) map.set(p.id as string, p)

  const planos = PLANOS.map((id) => {
    const p = map.get(id) ?? {}
    return {
      id,
      preco: Number(p.preco) || 0,
      items: Array.isArray(p.items) ? (p.items as string[]) : [],
      status: (p.status as string) || 'ativo',
    }
  })
  return Response.json({ planos })
}

export async function POST(req: NextRequest) {
  const ctx = await requireAdmin(req, 'planos', 'editar')
  if (!ctx) return forbidden()

  const body = (await req.json().catch(() => ({}))) as { planos?: Array<Record<string, unknown>> }
  const entrada = Array.isArray(body.planos) ? body.planos : []

  const registros = entrada
    .filter((p) => PLANOS.includes(p.id as string))
    .map((p) => {
      const itemsRaw = p.items
      const items = Array.isArray(itemsRaw)
        ? (itemsRaw as string[]).map((s) => String(s).trim()).filter(Boolean)
        : String(itemsRaw || '')
            .split('\n')
            .map((s) => s.trim())
            .filter(Boolean)
      return {
        id: p.id as string,
        preco: Number(p.preco) || 0,
        items,
        status: p.status === 'oculto' ? 'oculto' : 'ativo',
        atualizado_em: new Date().toISOString(),
      }
    })

  if (!registros.length) return Response.json({ error: 'Nada para salvar.' }, { status: 400 })

  const { error } = await supabaseAdmin.from('planos_config').upsert(registros, { onConflict: 'id' })
  if (error) return Response.json({ error: error.message }, { status: 500 })
  await registrarAcaoAdmin(ctx, 'planos', 'salvar', null, { planos: registros.length })
  return Response.json({ ok: true })
}
