import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getAuthUser, unauthorized } from '@/lib/apiAuth'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const admin = supabaseAdmin as any

// Chaves de IA do PRÓPRIO usuário (BYOK). Tabela `integracoes` tem RLS sem policies:
// a chave nunca chega ao navegador — só estas rotas (service role) leem/gravam.

// GET — status mascarado (não retorna a chave em texto puro).
export async function GET(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return unauthorized()
  const { data } = await admin.from('integracoes').select('provider, modelo, api_key').eq('usuario_id', user.id).maybeSingle()
  const key: string = data?.api_key || ''
  return Response.json({
    configured: !!key,
    provider: data?.provider || 'openai',
    modelo: data?.modelo || '',
    last4: key ? key.slice(-4) : '',
  })
}

// POST — salva/atualiza. Se api_key vier vazia, mantém a existente.
export async function POST(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return unauthorized()
  const { provider, api_key, modelo } = await req.json()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const row: any = {
    usuario_id: user.id,
    provider: provider || 'openai',
    modelo: (modelo || '').trim() || null,
    atualizado_em: new Date().toISOString(),
  }
  if (typeof api_key === 'string' && api_key.trim()) row.api_key = api_key.trim()
  const { error } = await admin.from('integracoes').upsert(row, { onConflict: 'usuario_id' })
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}

// DELETE — remove a integração.
export async function DELETE(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return unauthorized()
  await admin.from('integracoes').delete().eq('usuario_id', user.id)
  return Response.json({ ok: true })
}
