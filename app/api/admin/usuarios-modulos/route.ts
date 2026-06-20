import type { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/adminAuth'
import { forbidden } from '@/lib/apiAuth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { registrarAcaoAdmin } from '@/lib/adminAudit'
import { ativarModulo, cancelarModulo } from '@/lib/moduloAvulso'
import { MODULOS_PAINEL } from '@/lib/modulos'

// Concessão MANUAL de módulos avulsos a um usuário (venda por fora / cortesia)
// e revogação. Service-role após requireAdmin. A compra self-service não passa
// por aqui (vai pelo webhook do Mercado Pago).
export const dynamic = 'force-dynamic'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const admin = supabaseAdmin as any

const KEYS = new Set(MODULOS_PAINEL.map((m) => m.key))

export async function GET(req: NextRequest) {
  const ctx = await requireAdmin(req, 'usuarios', 'ver')
  if (!ctx) return forbidden()

  const usuarioId = new URL(req.url).searchParams.get('usuario_id')
  if (!usuarioId) return Response.json({ error: 'usuario_id obrigatório' }, { status: 400 })

  const { data } = await admin
    .from('usuarios_modulos')
    .select('modulo_key, status, origem, inicio, fim, valor_pago')
    .eq('usuario_id', usuarioId)

  return Response.json({ modulos: data ?? [] })
}

export async function POST(req: NextRequest) {
  const ctx = await requireAdmin(req, 'usuarios', 'editar')
  if (!ctx) return forbidden()

  const body = (await req.json().catch(() => ({}))) as {
    action?: string
    usuario_id?: string
    modulo_key?: string
    meses?: number
  }
  const { action, usuario_id, modulo_key } = body
  if (!usuario_id || !modulo_key || !KEYS.has(modulo_key)) {
    return Response.json({ error: 'Dados inválidos.' }, { status: 400 })
  }

  if (action === 'conceder') {
    const meses = Number(body.meses) > 0 ? Number(body.meses) : 12
    await ativarModulo({ usuario_id, modulo_key, meses, valor: 0, origem: 'cortesia' })
  } else if (action === 'revogar') {
    await cancelarModulo(usuario_id, modulo_key)
  } else {
    return Response.json({ error: 'Ação inválida.' }, { status: 400 })
  }

  await registrarAcaoAdmin(
    ctx,
    'usuarios',
    action === 'conceder' ? 'conceder_modulo' : 'revogar_modulo',
    usuario_id,
    { modulo_key },
  )
  return Response.json({ ok: true })
}
