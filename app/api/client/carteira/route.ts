import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getAuthUser, unauthorized } from '@/lib/apiAuth'
import { resumoCarteira, podeResgatar, type LancamentoCredito } from '@/lib/creditos'

// Carteira do cliente — créditos (razão) + cupons. GET devolve extrato, cupons e
// resumo. POST { action:'resgatar', valor } converte créditos num cupom de
// desconto (débito no razão + cupom 'resgate'), atomicamente do ponto de vista
// do usuário. Service-role: a identidade vem SEMPRE do JWT (getAuthUser).

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const admin = supabaseAdmin as any

async function carregar(uid: string) {
  const [{ data: extrato }, { data: cupons }] = await Promise.all([
    admin.from('creditos_cliente').select('*').eq('user_id', uid).order('criado_em', { ascending: false }),
    admin.from('cupons_cliente').select('*').eq('user_id', uid).order('criado_em', { ascending: false }),
  ])
  const lancamentos = (extrato || []) as LancamentoCredito[]
  const resumo = resumoCarteira(lancamentos, new Date())
  return { extrato: lancamentos, cupons: cupons || [], resumo }
}

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return unauthorized()
  try {
    return Response.json(await carregar(user.id))
  } catch {
    // Tabelas ainda não criadas → devolve vazio (UI mostra o SetupCard).
    return Response.json({ extrato: [], cupons: [], resumo: { saldo: 0, totalGanho: 0, totalUsado: 0, aExpirar: 0 }, needsSetup: true })
  }
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return unauthorized()

  const body = await req.json().catch(() => ({}))
  const action = String(body.action || '')

  if (action !== 'resgatar') {
    return Response.json({ error: 'Ação inválida.' }, { status: 400 })
  }

  const valor = Math.floor(Number(body.valor) || 0)
  // Saldo atual (recalculado no servidor — nunca confiar no client).
  const { data: extrato } = await admin.from('creditos_cliente').select('*').eq('user_id', user.id)
  const { saldo } = resumoCarteira((extrato || []) as LancamentoCredito[], new Date())

  if (!podeResgatar(saldo, valor, 10)) {
    return Response.json({ error: 'Valor inválido para resgate (mínimo R$ 10 e até o seu saldo).' }, { status: 400 })
  }

  const codigo = 'VENTSY' + Math.random().toString(36).slice(2, 8).toUpperCase()
  const validade = new Date(Date.now() + 180 * 86_400_000).toISOString().slice(0, 10)

  const { data: cupom, error: cupErr } = await admin
    .from('cupons_cliente')
    .insert({
      user_id: user.id, codigo, descricao: `Cupom de R$ ${valor} resgatado da carteira`,
      tipo: 'valor', valor, origem: 'resgate', status: 'disponivel', validade,
    })
    .select()
    .single()
  if (cupErr) return Response.json({ error: cupErr.message }, { status: 500 })

  const { error: debErr } = await admin.from('creditos_cliente').insert({
    user_id: user.id, tipo: 'resgate', valor: -valor,
    descricao: `Resgate de créditos → cupom ${codigo}`, referencia: cupom?.id ?? codigo,
  })
  if (debErr) {
    // Compensa: remove o cupom para não conceder desconto sem debitar.
    await admin.from('cupons_cliente').delete().eq('id', cupom.id)
    return Response.json({ error: debErr.message }, { status: 500 })
  }

  return Response.json({ ok: true, cupom, ...(await carregar(user.id)) })
}
