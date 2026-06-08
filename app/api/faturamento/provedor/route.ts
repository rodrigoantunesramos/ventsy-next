import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getAuthUser, unauthorized } from '@/lib/apiAuth'
import { PROVEDORES, type ProvedorFiscal } from '@/lib/fiscal'

// Credenciais do provedor de NFS-e do PRÓPRIO dono (segredo). A tabela
// `fiscal_provedores` tem RLS habilitada SEM policy: o token nunca chega ao
// navegador — só estas rotas (service-role) leem/gravam. Mesmo padrão de
// /api/integracoes.

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const admin = supabaseAdmin as any

const PROVEDOR_SET = new Set<ProvedorFiscal>(PROVEDORES.map((p) => p.v))

// GET — status mascarado (não retorna o token em texto puro).
export async function GET(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return unauthorized()
  const { data } = await admin
    .from('fiscal_provedores')
    .select('provedor, ambiente, endpoint, token, empresa_token, cnpj, ativo')
    .eq('usuario_id', user.id)
    .maybeSingle()
  const token: string = data?.token || ''
  return Response.json({
    configured: !!(data && data.ativo && token && data.provedor !== 'manual'),
    provedor: data?.provedor || 'manual',
    ambiente: data?.ambiente || 'homologacao',
    endpoint: data?.endpoint || '',
    cnpj: data?.cnpj || '',
    ativo: data?.ativo ?? true,
    last4: token ? token.slice(-4) : '',
    has_token: !!token,
  })
}

// POST — salva/atualiza. Token vazio mantém o existente (não apaga por engano).
export async function POST(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return unauthorized()
  const body = await req.json().catch(() => ({}))
  const provedor = PROVEDOR_SET.has(body.provedor) ? body.provedor : 'manual'
  const ambiente = body.ambiente === 'producao' ? 'producao' : 'homologacao'

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const row: any = {
    usuario_id: user.id,
    provedor,
    ambiente,
    endpoint: (body.endpoint || '').toString().trim() || null,
    empresa_token: (body.empresa_token || '').toString().trim() || null,
    cnpj: (body.cnpj || '').toString().trim() || null,
    ativo: body.ativo === false ? false : true,
    atualizado_em: new Date().toISOString(),
  }
  if (typeof body.token === 'string' && body.token.trim()) row.token = body.token.trim()

  const { error } = await admin.from('fiscal_provedores').upsert(row, { onConflict: 'usuario_id' })
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}

// DELETE — remove a configuração do provedor.
export async function DELETE(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return unauthorized()
  await admin.from('fiscal_provedores').delete().eq('usuario_id', user.id)
  return Response.json({ ok: true })
}
