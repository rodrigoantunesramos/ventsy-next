import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getAuthUser, unauthorized, forbidden } from '@/lib/apiAuth'
import { detectarConflitos, holdExpiraEm, toRange, type Reserva } from '@/lib/reservas'

// Mutações OPERACIONAIS da agenda multi-espaço (reserva firme, hold, bloqueio,
// manutenção). É a checagem de conflito AUTORITATIVA: roda com service-role,
// valida que a propriedade é do dono e recusa sobreposição no mesmo espaço
// (espaços distintos podem ser simultâneos). O fluxo público de marketplace
// (solicitada/aprovada/paga) NÃO passa por aqui.

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const admin = supabaseAdmin as any

const OPERACIONAL = new Set(['hold', 'confirmada', 'bloqueio', 'manutencao', 'cancelada'])

// Campos suficientes p/ a engine de conflito (inclui fallback legado).
const SELECT_CONFLITO = 'id,propriedade_id,espaco_id,status,inicio,fim,hold_expira_em,data_inicio,data_fim,modo,horas,titulo'

function badRequest(msg: string) {
  return Response.json({ error: msg }, { status: 400 })
}

/** Valida que a propriedade pertence ao usuário; devolve null se não. */
async function donoDaPropriedade(propriedadeId: number, userId: string): Promise<boolean> {
  const { data } = await admin.from('propriedades').select('id,usuario_id').eq('id', propriedadeId).maybeSingle()
  return !!data && data.usuario_id === userId
}

/** Buffer (min) do sub-espaço, validando que ele é do usuário e da propriedade. */
async function bufferDoEspaco(espacoId: number | null, propriedadeId: number, userId: string): Promise<{ ok: boolean; buffer: number }> {
  if (espacoId == null) return { ok: true, buffer: 0 }
  const { data } = await admin.from('espacos').select('id,usuario_id,propriedade_id,buffer_minutos').eq('id', espacoId).maybeSingle()
  if (!data || data.usuario_id !== userId || Number(data.propriedade_id) !== Number(propriedadeId)) return { ok: false, buffer: 0 }
  return { ok: true, buffer: Number(data.buffer_minutos) || 0 }
}

function parseISO(v: unknown): string | null {
  if (typeof v !== 'string' || !v) return null
  const t = Date.parse(v)
  return Number.isNaN(t) ? null : new Date(t).toISOString()
}

/** Resposta padrão de conflito (409) com a lista enxuta dos choques. */
function conflito(lista: Reserva[]) {
  return Response.json({
    error: 'conflito',
    conflitos: lista.map((r) => ({ id: r.id, titulo: r.titulo, status: r.status, espaco_id: r.espaco_id, inicio: r.inicio, fim: r.fim, data_inicio: r.data_inicio })),
  }, { status: 409 })
}

// POST /api/reservas — cria reserva firme / hold / bloqueio / manutenção.
export async function POST(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return unauthorized()

  const body = await req.json().catch(() => ({}))
  const propriedade_id = Number(body.propriedade_id)
  const espaco_id = body.espaco_id == null || body.espaco_id === '' ? null : Number(body.espaco_id)
  const status = String(body.status || '')
  const inicio = parseISO(body.inicio)
  const fim = parseISO(body.fim)

  if (!propriedade_id) return badRequest('propriedade_id é obrigatório')
  if (!OPERACIONAL.has(status)) return badRequest('status operacional inválido')
  if (!inicio || !fim) return badRequest('inicio e fim são obrigatórios')
  if (Date.parse(fim) <= Date.parse(inicio)) return badRequest('o fim deve ser depois do início')

  if (!(await donoDaPropriedade(propriedade_id, user.id))) return forbidden()
  const esp = await bufferDoEspaco(espaco_id, propriedade_id, user.id)
  if (!esp.ok) return forbidden()

  // Checagem de conflito (autoritativa). Bloqueio/manutenção podem forçar.
  const force = body.force === true && (status === 'bloqueio' || status === 'manutencao')
  const { data: existentes } = await admin.from('reservas').select(SELECT_CONFLITO).eq('propriedade_id', propriedade_id)
  const range = toRange({ inicio, fim })!
  const conflitos = detectarConflitos(
    { propriedade_id, espaco_id, start: range.start, end: range.end },
    (existentes || []) as Reserva[],
    { bufferMin: esp.buffer },
  )
  if (conflitos.length && !force) return conflito(conflitos)

  const hold_horas = Number(body.hold_horas)
  const row = {
    usuario_id: user.id,
    host_id: user.id,
    propriedade_id,
    espaco_id,
    evento_id: body.evento_id || null,
    titulo: (body.titulo || '').toString().trim() || null,
    status,
    origem: body.origem === 'site' || body.origem === 'proposta' ? body.origem : 'manual',
    inicio,
    fim,
    cor: body.cor || null,
    obs: (body.obs || '').toString().trim() || null,
    hold_expira_em: status === 'hold' && hold_horas > 0 ? holdExpiraEm(hold_horas) : null,
  }

  const { data, error } = await admin.from('reservas').insert(row).select(SELECT_CONFLITO + ',evento_id,origem,cor,obs,usuario_id,host_id').single()
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ data })
}

// PATCH /api/reservas — move/redimensiona, troca status (ex.: hold→confirmada),
// edita título/espaço/observação. Reaplica a checagem de conflito.
export async function PATCH(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return unauthorized()

  const body = await req.json().catch(() => ({}))
  const id = String(body.id || '')
  if (!id) return badRequest('id é obrigatório')

  const { data: atual } = await admin.from('reservas').select(SELECT_CONFLITO + ',usuario_id,host_id,evento_id,cor,obs,origem').eq('id', id).maybeSingle()
  if (!atual) return Response.json({ error: 'reserva não encontrada' }, { status: 404 })
  if (atual.host_id !== user.id && atual.usuario_id !== user.id) return forbidden()

  const propriedade_id = Number(atual.propriedade_id)
  const espaco_id = body.espaco_id === undefined ? atual.espaco_id : (body.espaco_id == null || body.espaco_id === '' ? null : Number(body.espaco_id))
  const status = body.status !== undefined ? String(body.status) : atual.status
  const inicio = body.inicio !== undefined ? parseISO(body.inicio) : atual.inicio
  const fim = body.fim !== undefined ? parseISO(body.fim) : atual.fim

  if (body.status !== undefined && !OPERACIONAL.has(status)) return badRequest('status operacional inválido')
  if (!inicio || !fim) return badRequest('inicio e fim são obrigatórios')
  if (Date.parse(fim) <= Date.parse(inicio)) return badRequest('o fim deve ser depois do início')

  if (espaco_id !== atual.espaco_id) {
    const esp = await bufferDoEspaco(espaco_id, propriedade_id, user.id)
    if (!esp.ok) return forbidden()
  }
  const esp = await bufferDoEspaco(espaco_id, propriedade_id, user.id)

  // Conflito só importa se a faixa ocupa (cancelar nunca conflita).
  if (status !== 'cancelada') {
    const force = body.force === true && (status === 'bloqueio' || status === 'manutencao')
    const { data: existentes } = await admin.from('reservas').select(SELECT_CONFLITO).eq('propriedade_id', propriedade_id)
    const range = toRange({ inicio, fim })!
    const conflitos = detectarConflitos(
      { propriedade_id, espaco_id, start: range.start, end: range.end, ignoreId: id },
      (existentes || []) as Reserva[],
      { bufferMin: esp.buffer },
    )
    if (conflitos.length && !force) return conflito(conflitos)
  }

  // Converter hold→confirmada limpa a expiração.
  const patch: Record<string, unknown> = { espaco_id, status, inicio, fim }
  if (body.titulo !== undefined) patch.titulo = (body.titulo || '').toString().trim() || null
  if (body.cor !== undefined) patch.cor = body.cor || null
  if (body.obs !== undefined) patch.obs = (body.obs || '').toString().trim() || null
  if (body.evento_id !== undefined) patch.evento_id = body.evento_id || null
  if (status !== 'hold') patch.hold_expira_em = null
  else if (body.hold_horas !== undefined && Number(body.hold_horas) > 0) patch.hold_expira_em = holdExpiraEm(Number(body.hold_horas))

  const { data, error } = await admin.from('reservas').update(patch).eq('id', id).select(SELECT_CONFLITO + ',evento_id,origem,cor,obs,usuario_id,host_id').single()
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ data })
}

// DELETE /api/reservas?id=...  — remove (hold/bloqueio/manutenção) ou cancela.
// Por padrão CANCELA (preserva histórico). ?hard=1 apaga entradas operacionais.
export async function DELETE(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return unauthorized()

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  const hard = searchParams.get('hard') === '1'
  if (!id) return badRequest('id é obrigatório')

  const { data: atual } = await admin.from('reservas').select('id,usuario_id,host_id,status').eq('id', id).maybeSingle()
  if (!atual) return Response.json({ error: 'reserva não encontrada' }, { status: 404 })
  if (atual.host_id !== user.id && atual.usuario_id !== user.id) return forbidden()

  if (hard && ['hold', 'bloqueio', 'manutencao'].includes(atual.status)) {
    const { error } = await admin.from('reservas').delete().eq('id', id)
    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ data: { id, deleted: true } })
  }

  const { error } = await admin.from('reservas').update({ status: 'cancelada' }).eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ data: { id, status: 'cancelada' } })
}
