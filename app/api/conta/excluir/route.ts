import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getAuthUser, unauthorized } from '@/lib/apiAuth'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const admin = supabaseAdmin as any

// LGPD — registra o pedido de encerramento de conta. A exclusão definitiva exige
// processamento server-side (remoção em cascata + auth.users) feito pela equipe;
// aqui carimbamos a solicitação em empresa_config.exclusao_solicitada_em.
export async function POST(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return unauthorized()

  const agora = new Date().toISOString()
  const { error } = await admin
    .from('empresa_config')
    .upsert({ usuario_id: user.id, exclusao_solicitada_em: agora }, { onConflict: 'usuario_id' })

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true, solicitado_em: agora })
}

// Cancela um pedido de encerramento (limpa o carimbo).
export async function DELETE(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return unauthorized()
  await admin.from('empresa_config').update({ exclusao_solicitada_em: null }).eq('usuario_id', user.id)
  return Response.json({ ok: true })
}
