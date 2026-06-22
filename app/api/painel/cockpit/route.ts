import type { NextRequest } from 'next/server'
import { getAuthUser } from '@/lib/apiAuth'
import { pendenciasDoDia } from '@/lib/automacoes'
import { carregarDados, hojeUTC } from '@/app/api/automacoes/_engine'

// Cockpit "Seu dia" — feed de pendências CROSS-MÓDULO da home do painel.
// Reaproveita o loader + o motor PURO já testado das Automações:
// carregarDados (parcelas/contratos/eventos/licenças escopados por usuario_id)
// → pendenciasDoDia (parcelas a vencer/atrasadas, contratos sem assinatura,
// eventos próximos, licenças a vencer; priorizadas por urgência). O escopo do
// dono é garantido por getAuthUser (uid autenticado, nunca vindo do request).

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return Response.json({ pendencias: [] }, { status: 401 })
  try {
    const dados = await carregarDados(user.id)
    const pendencias = pendenciasDoDia(dados, hojeUTC(), 14) // horizonte 14 dias
    return Response.json({ pendencias })
  } catch {
    return Response.json({ pendencias: [] })
  }
}
