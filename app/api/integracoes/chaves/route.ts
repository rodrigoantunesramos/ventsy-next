import { NextRequest } from 'next/server'
import { createHash, randomBytes } from 'crypto'
import { getAuthUser, unauthorized } from '@/lib/apiAuth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { ESCOPOS_API_SET, PREFIXO_API_KEY } from '@/lib/integracoes'

// API keys do dono (para integrações próprias: Zapier/Make/n8n). Guardamos só o
// HASH (sha256) do token — o token completo é exibido UMA única vez, ao gerar.
// Nunca é possível reler o token; se perder, gere outro.

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const admin = supabaseAdmin as any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Dict = Record<string, any>

const mascarar = (k: Dict) => ({
  id: k.id, nome: k.nome, prefixo: k.prefixo, last4: k.last4, escopos: k.escopos || [],
  rate_limit: k.rate_limit, ultimo_uso: k.ultimo_uso, revogada: k.revogada, criado_em: k.criado_em,
})

// GET — chaves do dono (sem hash, sem token).
export async function GET(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return unauthorized()
  const { data } = await admin.from('integracoes_chaves').select('*').eq('usuario_id', user.id).order('criado_em', { ascending: false })
  return Response.json({ chaves: ((data as Dict[]) || []).map(mascarar) })
}

// POST — gera uma chave. body { nome, escopos[], rate_limit? }. Token retornado 1x.
export async function POST(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return unauthorized()
  const b = await req.json().catch(() => ({}))
  const nome = (b?.nome || '').toString().trim()
  if (!nome) return Response.json({ error: 'Dê um nome para a chave.' }, { status: 400 })
  const escopos: string[] = Array.isArray(b?.escopos) ? b.escopos.filter((e: string) => ESCOPOS_API_SET.has(e)) : []
  if (escopos.length === 0) escopos.push('leitura')
  const rate = Number.isFinite(Number(b?.rate_limit)) && Number(b?.rate_limit) > 0 ? Math.floor(Number(b.rate_limit)) : null

  const token = `${PREFIXO_API_KEY}_live_${randomBytes(20).toString('hex')}`
  const prefixo = token.slice(0, 16)
  const last4 = token.slice(-4)
  const token_hash = createHash('sha256').update(token).digest('hex')

  const { data, error } = await admin.from('integracoes_chaves').insert({
    usuario_id: user.id, nome, prefixo, last4, token_hash, escopos, rate_limit: rate, revogada: false,
  }).select('*').single()
  if (error) return Response.json({ error: error.message }, { status: 500 })
  // token em texto puro APENAS aqui.
  return Response.json({ ok: true, chave: mascarar(data), token })
}

// DELETE — revoga (remove) a chave. ?id= ou body { id }.
export async function DELETE(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return unauthorized()
  let id = new URL(req.url).searchParams.get('id') || ''
  if (!id) { const b = await req.json().catch(() => ({})); id = String(b?.id || '') }
  if (!id) return Response.json({ error: 'id obrigatório.' }, { status: 400 })
  await admin.from('integracoes_chaves').delete().eq('id', id).eq('usuario_id', user.id)
  return Response.json({ ok: true })
}
