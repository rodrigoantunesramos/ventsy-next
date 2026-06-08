import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getAuthUser, unauthorized, forbidden } from '@/lib/apiAuth'

// Fechamento da RECEITA de estacionamento → financeiro do evento. Agrega os
// acessos PAGOS e ainda não conciliados (lancamento_id nulo) de um evento num
// ÚNICO lançamento de receita no caixa (`lancamentos`), e carimba cada acesso com
// o lancamento_id — idempotente e estornável. Mantém o critério de aceite "a
// receita de estacionamento entra no evento", sem poluir o caixa com 1 linha por
// carro. Roda com service-role; espelha app/api/faturamento/_baixa.ts.

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const admin = supabaseAdmin as any

function badRequest(msg: string) {
  return Response.json({ error: msg }, { status: 400 })
}

// POST /api/estacionamento/receita — lança a receita acumulada do evento no caixa.
export async function POST(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return unauthorized()

  const body = await req.json().catch(() => ({}))
  const evento_id = body.evento_id ? String(body.evento_id) : ''
  if (!evento_id) return badRequest('evento_id é obrigatório')

  // Acessos pagos e ainda não conciliados.
  const { data: pendentes, error: e0 } = await admin
    .from('estacionamento_acessos')
    .select('id,valor_num')
    .eq('usuario_id', user.id).eq('evento_id', evento_id)
    .eq('pago', true).is('lancamento_id', null).gt('valor_num', 0)
  if (e0) return Response.json({ error: e0.message }, { status: 500 })

  const ids = (pendentes || []).map((a: { id: string }) => a.id)
  const valor = (pendentes || []).reduce((s: number, a: { valor_num: number }) => s + (Number(a.valor_num) || 0), 0)
  if (!ids.length || valor <= 0) {
    return Response.json({ ok: true, valor: 0, qtd: 0, message: 'Nenhuma receita nova para lançar.' })
  }

  // Contexto do evento (rótulo + centro de custo do lançamento).
  const { data: evento } = await admin
    .from('clientes_eventos').select('nome_evento,tipo_evento,propriedade_id').eq('id', evento_id).maybeSingle()

  const dataCaixa = (body.data || new Date().toISOString().slice(0, 10)).slice(0, 10)
  const { data: lanc, error: e1 } = await admin.from('lancamentos').insert({
    usuario_id: user.id,
    tipo: 'receita',
    categoria: 'Estacionamento',
    descricao: `${evento?.nome_evento || 'Evento'} — Estacionamento (${ids.length} veículo${ids.length === 1 ? '' : 's'})`,
    tipo_evento: evento?.tipo_evento || null,
    valor,
    status: 'pago',
    data: dataCaixa,
    metodo_pagamento: body.metodo || 'Diversos',
    prop_id: evento?.propriedade_id ?? null,
    observacao: 'Receita de estacionamento (fechamento)',
  }).select('id').single()
  if (e1 || !lanc) return Response.json({ error: 'Falha ao lançar a receita no caixa' }, { status: 500 })

  const { error: e2 } = await admin
    .from('estacionamento_acessos').update({ lancamento_id: lanc.id }).in('id', ids)
  if (e2) {
    await admin.from('lancamentos').delete().eq('id', lanc.id) // rollback best-effort
    return Response.json({ error: 'Falha ao conciliar os acessos' }, { status: 500 })
  }

  return Response.json({ ok: true, lancamento_id: lanc.id, valor, qtd: ids.length })
}

// DELETE /api/estacionamento/receita?lancamento_id=...  — estorna o fechamento.
export async function DELETE(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return unauthorized()

  const { searchParams } = new URL(req.url)
  const lancamentoId = searchParams.get('lancamento_id')
  if (!lancamentoId) return badRequest('lancamento_id é obrigatório')

  const { data: lanc } = await admin.from('lancamentos').select('id,usuario_id').eq('id', lancamentoId).maybeSingle()
  if (!lanc) return Response.json({ error: 'Lançamento não encontrado' }, { status: 404 })
  if (lanc.usuario_id !== user.id) return forbidden()

  // Desconcilia os acessos e remove o lançamento.
  await admin.from('estacionamento_acessos').update({ lancamento_id: null }).eq('lancamento_id', lancamentoId).eq('usuario_id', user.id)
  const { error } = await admin.from('lancamentos').delete().eq('id', lancamentoId).eq('usuario_id', user.id)
  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json({ ok: true, estornado: true })
}
