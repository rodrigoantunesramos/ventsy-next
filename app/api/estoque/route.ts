import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getAuthUser, unauthorized, forbidden } from '@/lib/apiAuth'
import { aplicarUma, recalcular, statusMinimo, num, type MovTipo, type MovCalc } from '@/lib/estoque'

// Movimentação de estoque AUTORITATIVA (Kardex + custo médio móvel).
// Roda com service-role: valida que o produto é do dono, grava a movimentação
// com o custo EFETIVO da linha e recalcula `estoque_atual`/`custo_medio_num` do
// produto a partir de TODO o histórico (motor puro lib/estoque.ts) — assim o
// saldo e o custo médio são consistentes a cada entrada/saída/ajuste/perda.
//
// O Kardex é imutável (boa prática de auditoria): não há edição de movimentação;
// correções são feitas por nova movimentação de 'ajuste'/'perda' ou por DELETE
// (que reverte e recalcula). Saídas/perdas além do saldo exigem ?force.

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const admin = supabaseAdmin as any

const TIPOS = new Set<MovTipo>(['entrada', 'saida', 'ajuste', 'perda', 'transferencia'])
const SELECT_RECALC = 'tipo,quantidade,custo_unit_num,criado_em'

function badRequest(msg: string) {
  return Response.json({ error: msg }, { status: 400 })
}

/** Produto do dono? Retorna a linha (saldo/custo atuais) ou null. */
async function produtoDoDono(produtoId: string, userId: string): Promise<{ id: string; estoque_atual: number; custo_medio_num: number } | null> {
  const { data } = await admin.from('produtos').select('id,usuario_id,estoque_atual,custo_medio_num').eq('id', produtoId).maybeSingle()
  if (!data || data.usuario_id !== userId) return null
  return { id: data.id, estoque_atual: num(data.estoque_atual), custo_medio_num: num(data.custo_medio_num) }
}

/** Recalcula saldo + custo médio do produto a partir do histórico e persiste. */
async function recomputarProduto(produtoId: string): Promise<{ estoque_atual: number; custo_medio_num: number }> {
  const { data: movs } = await admin
    .from('estoque_mov')
    .select(SELECT_RECALC)
    .eq('produto_id', produtoId)
    .order('criado_em', { ascending: true })
    .order('id', { ascending: true })
  const estado = recalcular((movs || []) as MovCalc[])
  await admin.from('produtos').update({ estoque_atual: estado.saldo, custo_medio_num: estado.custo_medio_num }).eq('id', produtoId)
  return { estoque_atual: estado.saldo, custo_medio_num: estado.custo_medio_num }
}

// POST /api/estoque — registra uma movimentação e atualiza o produto.
export async function POST(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return unauthorized()

  const body = await req.json().catch(() => ({}))
  const produto_id = String(body.produto_id || '')
  const tipo = String(body.tipo || '') as MovTipo
  const quantidade = num(body.quantidade)
  const force = body.force === true

  if (!produto_id) return badRequest('produto_id é obrigatório')
  if (!TIPOS.has(tipo)) return badRequest('tipo de movimentação inválido')
  if (tipo === 'ajuste') {
    if (quantidade === 0) return badRequest('o ajuste precisa de um delta diferente de zero')
  } else if (tipo !== 'transferencia' && quantidade <= 0) {
    return badRequest('a quantidade deve ser maior que zero')
  }

  const produto = await produtoDoDono(produto_id, user.id)
  if (!produto) return forbidden()

  // Regra de saldo: saída/perda não podem exceder o saldo (salvo force).
  const estadoAtual = { saldo: produto.estoque_atual, custo_medio_num: produto.custo_medio_num }
  if ((tipo === 'saida' || tipo === 'perda') && Math.abs(quantidade) > estadoAtual.saldo && !force) {
    return Response.json({ error: 'saldo_insuficiente', saldo: estadoAtual.saldo, solicitado: Math.abs(quantidade) }, { status: 409 })
  }

  // Valoração da linha (append: estado atual = pré-estado cronológico).
  const mov: MovCalc = { tipo, quantidade, custo_unit_num: tipo === 'entrada' ? num(body.custo_unit_num) : produto.custo_medio_num }
  const r = aplicarUma(estadoAtual, mov)

  const row = {
    usuario_id: user.id,
    produto_id,
    tipo,
    quantidade,
    custo_unit_num: r.custo_unit_efetivo,
    custo_total_num: r.custo_total,
    motivo: (body.motivo || '').toString().trim() || null,
    evento_id: body.evento_id || null,
    recebimento_id: body.recebimento_id || null,
    local_origem: (body.local_origem || '').toString().trim() || null,
    local_destino: (body.local_destino || '').toString().trim() || null,
    lote: (body.lote || '').toString().trim() || null,
    validade: body.validade || null,
  }

  const { data: movRow, error } = await admin.from('estoque_mov').insert(row).select('*').single()
  if (error) return Response.json({ error: error.message }, { status: 500 })

  // Transferência pode atualizar o local "corrente" do produto.
  if (tipo === 'transferencia' && row.local_destino) {
    await admin.from('produtos').update({ local: row.local_destino }).eq('id', produto_id)
  }

  const estado = await recomputarProduto(produto_id)
  return Response.json({ data: { mov: movRow, produto: { id: produto_id, ...estado, nivel: statusMinimo({ estoque_atual: estado.estoque_atual, estoque_minimo: num(body.estoque_minimo) }) } } })
}

// DELETE /api/estoque?id=<movId> — remove a movimentação e recalcula o produto.
export async function DELETE(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return unauthorized()

  const id = new URL(req.url).searchParams.get('id')
  if (!id) return badRequest('id é obrigatório')

  const { data: mov } = await admin.from('estoque_mov').select('id,usuario_id,produto_id').eq('id', id).maybeSingle()
  if (!mov) return Response.json({ error: 'movimentação não encontrada' }, { status: 404 })
  if (mov.usuario_id !== user.id) return forbidden()

  const { error } = await admin.from('estoque_mov').delete().eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 500 })

  const estado = await recomputarProduto(mov.produto_id)
  return Response.json({ data: { id, produto: { id: mov.produto_id, ...estado } } })
}
