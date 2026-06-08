import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getAuthUser, unauthorized } from '@/lib/apiAuth'
import { baixarFatura, estornarFatura } from '../_baixa'

// Baixa/estorno MANUAL de uma fatura (o dono confirma o recebimento). A mesma
// lógica autoritativa é usada pelo webhook do Mercado Pago — aqui só validamos
// o autor. { action: 'estornar' } reverte.

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const admin = supabaseAdmin as any

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return unauthorized()

  const body = await req.json().catch(() => ({}))
  const faturaId = String(body.fatura_id || '')
  if (!faturaId) return Response.json({ error: 'fatura_id é obrigatório' }, { status: 400 })

  const result = body.action === 'estornar'
    ? await estornarFatura(admin, { faturaId, userId: user.id })
    : await baixarFatura(admin, { faturaId, userId: user.id, data: body.data, metodo: body.metodo })

  if (!result.ok) return Response.json({ error: result.error }, { status: 400 })
  return Response.json(result)
}
