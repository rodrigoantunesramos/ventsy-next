import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getAuthUser, unauthorized, forbidden } from '@/lib/apiAuth'
import { checarDisponibilidade, toRange, type Alocacao, type Equipamento } from '@/lib/equipamentos'

// Mutações de ALOCAÇÃO de equipamentos (reservar itens a um evento, separar,
// pôr em uso, devolver, registrar avaria). É a checagem de SUPERALOCAÇÃO
// AUTORITATIVA: roda com service-role, valida que o item é do dono e recusa
// alocar mais unidades do que existem disponíveis no período (a menos de
// `force`, que confirma a sublocação do que faltar). O CRUD dos itens em si
// (`equipamentos`) é feito direto no client via RLS — só a alocação, sensível a
// corrida, passa por aqui. Espelha /api/reservas.

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const admin = supabaseAdmin as any

const STATUS_VALIDOS = new Set(['reservado', 'separado', 'em_uso', 'devolvido', 'avariado', 'cancelado'])
const ALOC_SELECT = 'id,usuario_id,equipamento_id,evento_id,reserva_id,quantidade,inicio,fim,status,qtd_avaria,custo_unit_num,preco_unit_num,obs'

function badRequest(msg: string) {
  return Response.json({ error: msg }, { status: 400 })
}
function parseISO(v: unknown): string | null {
  if (typeof v !== 'string' || !v) return null
  const t = Date.parse(v)
  return Number.isNaN(t) ? null : new Date(t).toISOString()
}

/** Carrega o item garantindo que é do usuário. */
async function carregarEquip(id: string, userId: string): Promise<Equipamento | null> {
  const { data } = await admin.from('equipamentos').select('*').eq('id', id).maybeSingle()
  if (!data || data.usuario_id !== userId) return null
  return data as Equipamento
}
/** Alocações que ocupam estoque do item (para a engine de pico). */
async function alocacoesDoItem(equipId: string): Promise<Alocacao[]> {
  const { data } = await admin.from('equipamentos_alocacao').select(ALOC_SELECT).eq('equipamento_id', equipId)
  return (data || []) as Alocacao[]
}
/** Resposta padrão de superalocação (409) com o que falta sublocar. */
function superalocado(c: { disponivel: number; faltam: number; total: number; alocadoPico: number }) {
  return Response.json({
    error: 'superalocacao',
    disponivel: c.disponivel, faltam: c.faltam, total: c.total, alocadoPico: c.alocadoPico,
  }, { status: 409 })
}

// POST /api/equipamentos — cria uma alocação (reserva de N unidades a um período).
export async function POST(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return unauthorized()

  const body = await req.json().catch(() => ({}))
  const equipamento_id = String(body.equipamento_id || '')
  const quantidade = Math.floor(Number(body.quantidade))
  const inicio = parseISO(body.inicio)
  const fim = parseISO(body.fim)
  const status = body.status ? String(body.status) : 'reservado'

  if (!equipamento_id) return badRequest('equipamento_id é obrigatório')
  if (!Number.isFinite(quantidade) || quantidade <= 0) return badRequest('quantidade deve ser maior que zero')
  if (!inicio || !fim) return badRequest('inicio e fim são obrigatórios')
  if (Date.parse(fim) <= Date.parse(inicio)) return badRequest('o fim deve ser depois do início')
  if (!STATUS_VALIDOS.has(status)) return badRequest('status inválido')

  const equip = await carregarEquip(equipamento_id, user.id)
  if (!equip) return forbidden()

  const existentes = await alocacoesDoItem(equipamento_id)
  const range = toRange({ inicio, fim })!
  const c = checarDisponibilidade(equip, existentes, { start: range.start, end: range.end, quantidade })
  const force = body.force === true
  if (!c.ok && !force) return superalocado(c)

  const row = {
    usuario_id: user.id,
    equipamento_id,
    evento_id: body.evento_id || null,
    reserva_id: body.reserva_id || null,
    quantidade,
    inicio,
    fim,
    status,
    // Fotografias do custo/preço no momento da alocação (default = do item).
    custo_unit_num: body.custo_unit_num != null ? Number(body.custo_unit_num) : Number(equip.custo_locacao_num) || 0,
    preco_unit_num: body.preco_unit_num != null ? Number(body.preco_unit_num) : Number(equip.preco_locacao_num) || 0,
    obs: (body.obs || '').toString().trim() || null,
  }

  const { data, error } = await admin.from('equipamentos_alocacao').insert(row).select(ALOC_SELECT).single()
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ data, faltam: c.faltam })
}

// PATCH /api/equipamentos — edita uma alocação (status do ciclo, quantidade,
// período, avaria). Reaplica a checagem de superalocação quando muda algo que
// afeta o estoque (quantidade/período) e o novo status ocupa.
export async function PATCH(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return unauthorized()

  const body = await req.json().catch(() => ({}))
  const id = String(body.id || '')
  if (!id) return badRequest('id é obrigatório')

  const { data: atual } = await admin.from('equipamentos_alocacao').select(ALOC_SELECT).eq('id', id).maybeSingle()
  if (!atual) return Response.json({ error: 'alocação não encontrada' }, { status: 404 })
  if (atual.usuario_id !== user.id) return forbidden()

  const status = body.status !== undefined ? String(body.status) : atual.status
  const quantidade = body.quantidade !== undefined ? Math.floor(Number(body.quantidade)) : Number(atual.quantidade)
  const inicio = body.inicio !== undefined ? parseISO(body.inicio) : atual.inicio
  const fim = body.fim !== undefined ? parseISO(body.fim) : atual.fim

  if (body.status !== undefined && !STATUS_VALIDOS.has(status)) return badRequest('status inválido')
  if (!Number.isFinite(quantidade) || quantidade <= 0) return badRequest('quantidade deve ser maior que zero')
  if (!inicio || !fim) return badRequest('inicio e fim são obrigatórios')
  if (Date.parse(fim) <= Date.parse(inicio)) return badRequest('o fim deve ser depois do início')

  const equip = await carregarEquip(atual.equipamento_id, user.id)
  if (!equip) return forbidden()

  // Só recheca se a nova combinação ocupa estoque (reservado/separado/em_uso).
  const ocupaNovo = status === 'reservado' || status === 'separado' || status === 'em_uso'
  const force = body.force === true
  if (ocupaNovo) {
    const existentes = await alocacoesDoItem(atual.equipamento_id)
    const range = toRange({ inicio, fim })!
    const c = checarDisponibilidade(equip, existentes, { start: range.start, end: range.end, quantidade, ignoreId: id })
    if (!c.ok && !force) return superalocado(c)
  }

  const patch: Record<string, unknown> = { status, quantidade, inicio, fim }
  if (body.qtd_avaria !== undefined) patch.qtd_avaria = Math.max(0, Math.floor(Number(body.qtd_avaria)) || 0)
  if (body.obs !== undefined) patch.obs = (body.obs || '').toString().trim() || null
  if (body.evento_id !== undefined) patch.evento_id = body.evento_id || null
  if (body.reserva_id !== undefined) patch.reserva_id = body.reserva_id || null
  if (body.custo_unit_num !== undefined) patch.custo_unit_num = Number(body.custo_unit_num) || 0
  if (body.preco_unit_num !== undefined) patch.preco_unit_num = Number(body.preco_unit_num) || 0

  const { data, error } = await admin.from('equipamentos_alocacao').update(patch).eq('id', id).select(ALOC_SELECT).single()
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ data })
}

// DELETE /api/equipamentos?id=...  — cancela (preserva histórico) ou ?hard=1 apaga.
export async function DELETE(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return unauthorized()

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  const hard = searchParams.get('hard') === '1'
  if (!id) return badRequest('id é obrigatório')

  const { data: atual } = await admin.from('equipamentos_alocacao').select('id,usuario_id').eq('id', id).maybeSingle()
  if (!atual) return Response.json({ error: 'alocação não encontrada' }, { status: 404 })
  if (atual.usuario_id !== user.id) return forbidden()

  if (hard) {
    const { error } = await admin.from('equipamentos_alocacao').delete().eq('id', id)
    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ data: { id, deleted: true } })
  }

  const { error } = await admin.from('equipamentos_alocacao').update({ status: 'cancelado' }).eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ data: { id, status: 'cancelado' } })
}
