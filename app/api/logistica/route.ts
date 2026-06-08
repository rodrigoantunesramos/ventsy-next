import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getAuthUser, unauthorized, forbidden } from '@/lib/apiAuth'
import { detectarConflitos, toRange, type Reserva } from '@/lib/reservas'
import { JANELA_TIPOS, janelaTipoMeta } from '@/lib/logistica'

// Mutações das JANELAS de logística (montagem/desmontagem/ensaio/limpeza). Cada
// janela OCUPA o espaço além do evento, então grava um BLOQUEIO na tabela
// `reservas` (reserva_id) — e por isso PRECISA furar a RLS de `reservas` com
// service-role, exatamente como /api/reservas. A checagem de conflito é
// AUTORITATIVA e reutiliza a engine de lib/reservas (mesmo espaço não sobrepõe;
// espaços distintos podem coexistir; respeita o buffer de montagem do espaço).
// Chegadas e frota são CRUD direto do dono via RLS (não passam por aqui).

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const admin = supabaseAdmin as any

const TIPOS = new Set<string>(JANELA_TIPOS) // montagem | desmontagem | ensaio | limpeza
const SELECT_CONFLITO = 'id,propriedade_id,espaco_id,status,inicio,fim,hold_expira_em,data_inicio,data_fim,modo,horas,titulo'
const JANELA_SELECT = 'id,usuario_id,evento_id,propriedade_id,espaco_id,reserva_id,tipo,titulo,inicio,fim,obs,criado_em,atualizado_em'

function badRequest(msg: string) {
  return Response.json({ error: msg }, { status: 400 })
}
function parseISO(v: unknown): string | null {
  if (typeof v !== 'string' || !v) return null
  const t = Date.parse(v)
  return Number.isNaN(t) ? null : new Date(t).toISOString()
}
function conflito(lista: Reserva[]) {
  return Response.json({
    error: 'conflito',
    conflitos: lista.map((r) => ({ id: r.id, titulo: r.titulo, status: r.status, espaco_id: r.espaco_id, inicio: r.inicio, fim: r.fim, data_inicio: r.data_inicio })),
  }, { status: 409 })
}

/** Valida que a propriedade pertence ao usuário. */
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
/** Reservas da propriedade para a engine de conflito (inclui fallback legado). */
async function reservasDaPropriedade(propriedadeId: number): Promise<Reserva[]> {
  const { data } = await admin.from('reservas').select(SELECT_CONFLITO).eq('propriedade_id', propriedadeId)
  return (data || []) as Reserva[]
}

// POST /api/logistica — cria uma janela física e o bloqueio que a reflete na agenda.
export async function POST(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return unauthorized()

  const body = await req.json().catch(() => ({}))
  const propriedade_id = Number(body.propriedade_id)
  const espaco_id = body.espaco_id == null || body.espaco_id === '' ? null : Number(body.espaco_id)
  const tipo = String(body.tipo || '')
  const inicio = parseISO(body.inicio)
  const fim = parseISO(body.fim)
  const evento_id = body.evento_id || null

  if (!propriedade_id) return badRequest('propriedade_id é obrigatório')
  if (!TIPOS.has(tipo)) return badRequest('tipo de janela inválido')
  if (!inicio || !fim) return badRequest('inicio e fim são obrigatórios')
  if (Date.parse(fim) <= Date.parse(inicio)) return badRequest('o fim deve ser depois do início')

  if (!(await donoDaPropriedade(propriedade_id, user.id))) return forbidden()
  const esp = await bufferDoEspaco(espaco_id, propriedade_id, user.id)
  if (!esp.ok) return forbidden()

  // Conflito (autoritativo). A janela pode FORÇAR (é um bloqueio operacional).
  const force = body.force === true
  const range = toRange({ inicio, fim })!
  const conflitos = detectarConflitos(
    { propriedade_id, espaco_id, start: range.start, end: range.end },
    await reservasDaPropriedade(propriedade_id),
    { bufferMin: esp.buffer },
  )
  if (conflitos.length && !force) return conflito(conflitos)

  const meta = janelaTipoMeta(tipo)
  const tituloFinal = (body.titulo || '').toString().trim() || meta.label
  const obs = (body.obs || '').toString().trim() || null

  // 1) bloqueio em `reservas` (reflete no Calendário e em Reservas).
  const { data: reserva, error: rErr } = await admin.from('reservas').insert({
    usuario_id: user.id, host_id: user.id, propriedade_id, espaco_id, evento_id,
    titulo: tituloFinal, status: 'bloqueio', origem: 'manual',
    inicio, fim, cor: meta.hex, obs: obs ? `Logística · ${tituloFinal}: ${obs}` : `Logística · ${tituloFinal}`,
  }).select('id').single()
  if (rErr) return Response.json({ error: rErr.message }, { status: 500 })

  // 2) janela atrelada ao bloqueio.
  const { data: janela, error: jErr } = await admin.from('logistica_janelas').insert({
    usuario_id: user.id, evento_id, propriedade_id, espaco_id, reserva_id: reserva.id,
    tipo, titulo: (body.titulo || '').toString().trim() || null, inicio, fim, obs,
  }).select(JANELA_SELECT).single()
  if (jErr) {
    // rollback do bloqueio órfão
    await admin.from('reservas').delete().eq('id', reserva.id)
    return Response.json({ error: jErr.message }, { status: 500 })
  }
  return Response.json({ data: janela, reserva_id: reserva.id })
}

// PATCH /api/logistica — move/redimensiona/retipa a janela; reaplica conflito e
// sincroniza o bloqueio espelhado.
export async function PATCH(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return unauthorized()

  const body = await req.json().catch(() => ({}))
  const id = String(body.id || '')
  if (!id) return badRequest('id é obrigatório')

  const { data: atual } = await admin.from('logistica_janelas').select(JANELA_SELECT).eq('id', id).maybeSingle()
  if (!atual) return Response.json({ error: 'janela não encontrada' }, { status: 404 })
  if (atual.usuario_id !== user.id) return forbidden()

  const propriedade_id = Number(atual.propriedade_id)
  const espaco_id = body.espaco_id === undefined ? atual.espaco_id : (body.espaco_id == null || body.espaco_id === '' ? null : Number(body.espaco_id))
  const tipo = body.tipo !== undefined ? String(body.tipo) : atual.tipo
  const inicio = body.inicio !== undefined ? parseISO(body.inicio) : atual.inicio
  const fim = body.fim !== undefined ? parseISO(body.fim) : atual.fim
  const evento_id = body.evento_id === undefined ? atual.evento_id : (body.evento_id || null)

  if (body.tipo !== undefined && !TIPOS.has(tipo)) return badRequest('tipo de janela inválido')
  if (!inicio || !fim) return badRequest('inicio e fim são obrigatórios')
  if (Date.parse(fim) <= Date.parse(inicio)) return badRequest('o fim deve ser depois do início')

  if (propriedade_id) {
    const esp = await bufferDoEspaco(espaco_id, propriedade_id, user.id)
    if (!esp.ok) return forbidden()
    const force = body.force === true
    const range = toRange({ inicio, fim })!
    const conflitos = detectarConflitos(
      { propriedade_id, espaco_id, start: range.start, end: range.end, ignoreId: atual.reserva_id || undefined },
      await reservasDaPropriedade(propriedade_id),
      { bufferMin: esp.buffer },
    )
    if (conflitos.length && !force) return conflito(conflitos)
  }

  const meta = janelaTipoMeta(tipo)
  const tituloField = body.titulo !== undefined ? ((body.titulo || '').toString().trim() || null) : atual.titulo
  const obsField = body.obs !== undefined ? ((body.obs || '').toString().trim() || null) : atual.obs

  // Sincroniza o bloqueio espelhado, se existir.
  if (atual.reserva_id) {
    await admin.from('reservas').update({
      espaco_id, evento_id, inicio, fim, cor: meta.hex,
      titulo: tituloField || meta.label,
      obs: obsField ? `Logística · ${tituloField || meta.label}: ${obsField}` : `Logística · ${tituloField || meta.label}`,
    }).eq('id', atual.reserva_id)
  }

  const { data: janela, error } = await admin.from('logistica_janelas').update({
    espaco_id, evento_id, tipo, titulo: tituloField, inicio, fim, obs: obsField,
  }).eq('id', id).select(JANELA_SELECT).single()
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ data: janela })
}

// DELETE /api/logistica?id=...  — remove a janela e libera o espaço (apaga o bloqueio).
export async function DELETE(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return unauthorized()

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return badRequest('id é obrigatório')

  const { data: atual } = await admin.from('logistica_janelas').select('id,usuario_id,reserva_id').eq('id', id).maybeSingle()
  if (!atual) return Response.json({ error: 'janela não encontrada' }, { status: 404 })
  if (atual.usuario_id !== user.id) return forbidden()

  if (atual.reserva_id) await admin.from('reservas').delete().eq('id', atual.reserva_id)
  const { error } = await admin.from('logistica_janelas').delete().eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ data: { id, deleted: true } })
}
