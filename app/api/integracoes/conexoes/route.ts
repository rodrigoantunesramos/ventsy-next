import { NextRequest } from 'next/server'
import { getAuthUser, unauthorized } from '@/lib/apiAuth'
import { CHAVES_VALIDAS } from '@/lib/integracoes'
import { lerStatusTodas, lerStatusUma, salvarConexao, desconectar } from '../_store'

// Contrato ÚNICO do catálogo de integrações para o client. Federa status de
// TODOS os serviços (Mercado Pago, NFS-e, IA, cofre genérico) e SEMPRE mascara a
// saída — segredos nunca chegam ao navegador (ver app/api/integracoes/_store.ts).

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET — status mascarado de todas as integrações do catálogo.
export async function GET(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return unauthorized()
  const conexoes = await lerStatusTodas(user.id)
  return Response.json({ conexoes })
}

// POST — conecta/salva uma integração. body: { chave, valores: {...} }.
// Campos-segredo vazios MANTÊM o valor atual (não apagam por engano).
export async function POST(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return unauthorized()
  const body = await req.json().catch(() => ({}))
  const chave = String(body?.chave || '')
  if (!CHAVES_VALIDAS.has(chave)) return Response.json({ error: 'Integração desconhecida' }, { status: 400 })
  const valores = body?.valores && typeof body.valores === 'object' ? body.valores : {}

  const r = await salvarConexao(user.id, chave, valores)
  if ('error' in r) return Response.json({ error: r.error }, { status: r.status || 500 })
  const conexao = await lerStatusUma(user.id, chave)
  return Response.json({ ok: true, conexao })
}

// DELETE — desconecta (apaga o segredo e zera o status). ?chave= ou body { chave }.
export async function DELETE(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return unauthorized()
  let chave = new URL(req.url).searchParams.get('chave') || ''
  if (!chave) { const b = await req.json().catch(() => ({})); chave = String(b?.chave || '') }
  if (!CHAVES_VALIDAS.has(chave)) return Response.json({ error: 'Integração desconhecida' }, { status: 400 })
  const r = await desconectar(user.id, chave)
  if ('error' in r) return Response.json({ error: r.error }, { status: 400 })
  return Response.json({ ok: true })
}
