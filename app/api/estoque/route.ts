import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getAuthUser, unauthorized, forbidden } from '@/lib/apiAuth'
import { num, type MovTipo } from '@/lib/estoque'

// Movimentação de estoque (Kardex). Roda com service-role e valida posse do
// produto + regra de saldo (saída/perda não excedem o saldo, salvo ?force).
// O cálculo de saldo e CUSTO MÉDIO MÓVEL é AUTORITATIVO no banco: triggers em
// `estoque_mov` (docs/sql/estoque.sql) valoram a linha e recalculam o produto a
// cada inserção/edição/exclusão — assim qualquer caminho de escrita (esta rota
// ou o recebimento de Compras) mantém produtos.estoque_atual/custo_medio_num
// coerentes. A lógica do trigger espelha o motor puro lib/estoque.ts.
//
// O Kardex é imutável (auditoria): não há edição de movimentação; correções via
// nova 'ajuste'/'perda' ou DELETE (que reverte e recalcula pelo trigger).

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const admin = supabaseAdmin as any

const TIPOS = new Set<MovTipo>(['entrada', 'saida', 'ajuste', 'perda', 'transferencia'])

function badRequest(msg: string) {
  return Response.json({ error: msg }, { status: 400 })
}

/** Produto do dono? Retorna a linha (saldo/custo/local atuais) ou null. */
async function produtoDoDono(produtoId: string, userId: string): Promise<{ id: string; estoque_atual: number; custo_medio_num: number; local: string } | null> {
  const { data } = await admin.from('produtos').select('id,usuario_id,estoque_atual,custo_medio_num,local').eq('id', produtoId).maybeSingle()
  if (!data || data.usuario_id !== userId) return null
  return { id: data.id, estoque_atual: num(data.estoque_atual), custo_medio_num: num(data.custo_medio_num), local: data.local }
}

/** Lê o produto já recalculado (após o trigger) para devolver na resposta. */
async function lerProduto(produtoId: string) {
  const { data } = await admin.from('produtos').select('id,estoque_atual,custo_medio_num,local').eq('id', produtoId).maybeSingle()
  return data ? { id: produtoId, estoque_atual: num(data.estoque_atual), custo_medio_num: num(data.custo_medio_num), local: data.local } : { id: produtoId }
}

// POST /api/estoque — registra uma movimentação; o trigger recalcula o produto.
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
  } else if (quantidade <= 0) {
    return badRequest('a quantidade deve ser maior que zero')
  }

  const produto = await produtoDoDono(produto_id, user.id)
  if (!produto) return forbidden()

  // Regra de saldo: saída/perda não podem exceder o saldo (salvo force).
  if ((tipo === 'saida' || tipo === 'perda') && Math.abs(quantidade) > produto.estoque_atual && !force) {
    return Response.json({ error: 'saldo_insuficiente', saldo: produto.estoque_atual, solicitado: Math.abs(quantidade) }, { status: 409 })
  }

  // custo_unit só importa na entrada; nos demais o trigger valora pelo médio.
  const row = {
    usuario_id: user.id,
    produto_id,
    tipo,
    quantidade,
    custo_unit_num: tipo === 'entrada' ? num(body.custo_unit_num) : 0,
    motivo: (body.motivo || '').toString().trim() || null,
    evento_id: body.evento_id || null,
    recebimento_id: body.recebimento_id || null,
    local_origem: (body.local_origem || '').toString().trim() || produto.local,
    local_destino: (body.local_destino || '').toString().trim() || null,
    lote: (body.lote || '').toString().trim() || null,
    validade: body.validade || null,
  }

  const { data: movRow, error } = await admin.from('estoque_mov').insert(row).select('*').single()
  if (error) return Response.json({ error: error.message }, { status: 500 })

  // Transferência atualiza o local "corrente" do produto (não altera saldo).
  if (tipo === 'transferencia' && row.local_destino) {
    await admin.from('produtos').update({ local: row.local_destino }).eq('id', produto_id)
  }

  const produtoAtual = await lerProduto(produto_id)
  return Response.json({ data: { mov: movRow, produto: produtoAtual } })
}

// DELETE /api/estoque?id=<movId> — remove a movimentação; o trigger recalcula.
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

  const produtoAtual = await lerProduto(mov.produto_id)
  return Response.json({ data: { id, produto: produtoAtual } })
}
