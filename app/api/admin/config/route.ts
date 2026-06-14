import type { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/adminAuth'
import { forbidden } from '@/lib/apiAuth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import type { Json } from '@/types/supabase'
import { registrarAcaoAdmin } from '@/lib/adminAudit'
import { PLATAFORMA_CONFIG } from '@/lib/plataformaConfig'
import { lerPlataformaConfig } from '@/lib/plataformaConfigServer'

// Leitura/escrita das configurações globais (feature flags + textos). Valida as
// chaves contra o catálogo para não gravar lixo. Via service-role após requireAdmin.
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const ctx = await requireAdmin(req, 'config', 'ver')
  if (!ctx) return forbidden()
  const valores = await lerPlataformaConfig()
  return Response.json({ catalogo: PLATAFORMA_CONFIG, valores })
}

export async function POST(req: NextRequest) {
  const ctx = await requireAdmin(req, 'config', 'editar')
  if (!ctx) return forbidden()

  const body = (await req.json().catch(() => ({}))) as { valores?: Record<string, unknown> }
  const valores = body.valores || {}
  const chavesValidas = new Set(PLATAFORMA_CONFIG.map((d) => d.chave))

  const registros = Object.entries(valores)
    .filter(([chave]) => chavesValidas.has(chave))
    .map(([chave, valor]) => ({
      chave,
      valor: valor as Json,
      atualizado_em: new Date().toISOString(),
      atualizado_por: ctx.userId,
    }))

  if (!registros.length) return Response.json({ error: 'Nada para salvar.' }, { status: 400 })

  const { error } = await supabaseAdmin.from('plataforma_config').upsert(registros, { onConflict: 'chave' })
  if (error) return Response.json({ error: error.message }, { status: 500 })
  await registrarAcaoAdmin(ctx, 'config', 'salvar', null, { chaves: registros.map((r) => r.chave) })
  return Response.json({ ok: true })
}
