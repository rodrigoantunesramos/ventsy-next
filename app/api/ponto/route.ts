import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getAuthUser, unauthorized, forbidden } from '@/lib/apiAuth'
import { checarAlocacao, type EscalaAlocacao } from '@/lib/ponto'

// Mutações de ALOCAÇÃO de pessoas a uma escala (convocar fixo/freelancer,
// confirmar presença, marcar falta, cancelar). É a checagem de SUPER-ALOCAÇÃO
// AUTORITATIVA: roda com service-role, valida que a escala é do dono e recusa
// convocar MAIS pessoas do que a vaga pede (`necessario`), a menos de `force`.
// O CRUD de escalas/freelancers e as batidas de ponto (`ponto_registros`) são
// feitos direto no client via RLS — só a alocação, sensível a corrida, passa
// por aqui. Espelha /api/equipamentos.

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const admin = supabaseAdmin as any

const STATUS_VALIDOS = new Set(['convocado', 'confirmado', 'presente', 'falta', 'cancelado'])
const OCUPA = new Set(['convocado', 'confirmado', 'presente'])
const ALOC_SELECT = 'id,usuario_id,escala_id,equipe_id,freelancer_id,inicio_previsto,fim_previsto,valor_diaria_num,status,pago,conta_pagar_id,obs'

function badRequest(msg: string) {
  return Response.json({ error: msg }, { status: 400 })
}
function parseISO(v: unknown): string | null {
  if (typeof v !== 'string' || !v) return null
  const t = Date.parse(v)
  return Number.isNaN(t) ? null : new Date(t).toISOString()
}

type EscalaLite = { id: string; usuario_id: string; necessario: number; evento_id: string | null; valor_diaria_ref_num: number }
/** Carrega a escala garantindo que é do usuário. */
async function carregarEscala(id: string, userId: string): Promise<EscalaLite | null> {
  const { data } = await admin.from('escalas').select('id,usuario_id,necessario,evento_id,valor_diaria_ref_num').eq('id', id).maybeSingle()
  if (!data || data.usuario_id !== userId) return null
  return data as EscalaLite
}
/** Alocações da escala (para a checagem de cobertura/super-alocação). */
async function alocacoesDaEscala(escalaId: string): Promise<EscalaAlocacao[]> {
  const { data } = await admin.from('escalas_alocacao').select(ALOC_SELECT).eq('escala_id', escalaId)
  return (data || []) as EscalaAlocacao[]
}
/** Resposta padrão de super-alocação (409): a vaga já está completa. */
function superalocado(c: { preenchidas: number; necessario: number }) {
  return Response.json({ error: 'superalocacao', preenchidas: c.preenchidas, necessario: c.necessario }, { status: 409 })
}

// POST /api/ponto — aloca uma pessoa (fixo ou freelancer) a uma escala.
export async function POST(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return unauthorized()

  const body = await req.json().catch(() => ({}))
  const escala_id = String(body.escala_id || '')
  const equipe_id = body.equipe_id != null && body.equipe_id !== '' ? Math.floor(Number(body.equipe_id)) : null
  const freelancer_id = body.freelancer_id ? String(body.freelancer_id) : null
  const status = body.status ? String(body.status) : 'convocado'

  if (!escala_id) return badRequest('escala_id é obrigatório')
  if (equipe_id == null && !freelancer_id) return badRequest('informe equipe_id ou freelancer_id')
  if (equipe_id != null && freelancer_id) return badRequest('informe apenas um: equipe_id OU freelancer_id')
  if (!STATUS_VALIDOS.has(status)) return badRequest('status inválido')

  const escala = await carregarEscala(escala_id, user.id)
  if (!escala) return forbidden()

  const existentes = await alocacoesDaEscala(escala_id)

  // Impede alocar a MESMA pessoa duas vezes na mesma escala (exceto se a
  // anterior está encerrada — falta/cancelado).
  const jaAlocada = existentes.find((a) =>
    OCUPA.has(a.status) &&
    ((equipe_id != null && Number(a.equipe_id) === equipe_id) ||
     (freelancer_id != null && a.freelancer_id === freelancer_id)))
  if (jaAlocada) return Response.json({ error: 'duplicada', alocacao_id: jaAlocada.id }, { status: 409 })

  // Anti super-alocação: só se o status novo ocupa vaga.
  const force = body.force === true
  if (OCUPA.has(status)) {
    const c = checarAlocacao(escala.necessario, existentes)
    if (!c.ok && !force) return superalocado(c)
  }

  // Diária: snapshot informado > diária do freelancer > referência da escala.
  let valor_diaria_num = body.valor_diaria_num != null ? Number(body.valor_diaria_num) : null
  if (valor_diaria_num == null && freelancer_id) {
    const { data: f } = await admin.from('freelancers').select('valor_diaria_num').eq('id', freelancer_id).maybeSingle()
    valor_diaria_num = f ? Number(f.valor_diaria_num) || 0 : 0
  }
  if (valor_diaria_num == null) valor_diaria_num = Number(escala.valor_diaria_ref_num) || 0

  const row = {
    usuario_id: user.id,
    escala_id,
    equipe_id,
    freelancer_id,
    inicio_previsto: parseISO(body.inicio_previsto),
    fim_previsto: parseISO(body.fim_previsto),
    valor_diaria_num,
    status,
    obs: (body.obs || '').toString().trim() || null,
  }

  const { data, error } = await admin.from('escalas_alocacao').insert(row).select(ALOC_SELECT).single()
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ data })
}

// PATCH /api/ponto — atualiza uma alocação (status do ciclo, diária, previsto).
export async function PATCH(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return unauthorized()

  const body = await req.json().catch(() => ({}))
  const id = String(body.id || '')
  if (!id) return badRequest('id é obrigatório')

  const { data: atual } = await admin.from('escalas_alocacao').select(ALOC_SELECT).eq('id', id).maybeSingle()
  if (!atual) return Response.json({ error: 'alocação não encontrada' }, { status: 404 })
  if (atual.usuario_id !== user.id) return forbidden()

  const status = body.status !== undefined ? String(body.status) : atual.status
  if (body.status !== undefined && !STATUS_VALIDOS.has(status)) return badRequest('status inválido')

  // Recheca super-alocação só ao RE-OCUPAR uma vaga (ex.: falta/cancelado → convocado).
  const reocupa = OCUPA.has(status) && !OCUPA.has(atual.status)
  const force = body.force === true
  if (reocupa) {
    const escala = await carregarEscala(atual.escala_id, user.id)
    if (!escala) return forbidden()
    const existentes = await alocacoesDaEscala(atual.escala_id)
    const c = checarAlocacao(escala.necessario, existentes, { ignoreId: id })
    if (!c.ok && !force) return superalocado(c)
  }

  const patch: Record<string, unknown> = { status }
  if (body.valor_diaria_num !== undefined) patch.valor_diaria_num = Math.max(0, Number(body.valor_diaria_num) || 0)
  if (body.inicio_previsto !== undefined) patch.inicio_previsto = parseISO(body.inicio_previsto)
  if (body.fim_previsto !== undefined) patch.fim_previsto = parseISO(body.fim_previsto)
  if (body.obs !== undefined) patch.obs = (body.obs || '').toString().trim() || null

  const { data, error } = await admin.from('escalas_alocacao').update(patch).eq('id', id).select(ALOC_SELECT).single()
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ data })
}

// DELETE /api/ponto?id=...  — cancela (preserva histórico) ou ?hard=1 apaga.
export async function DELETE(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return unauthorized()

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  const hard = searchParams.get('hard') === '1'
  if (!id) return badRequest('id é obrigatório')

  const { data: atual } = await admin.from('escalas_alocacao').select('id,usuario_id,pago').eq('id', id).maybeSingle()
  if (!atual) return Response.json({ error: 'alocação não encontrada' }, { status: 404 })
  if (atual.usuario_id !== user.id) return forbidden()
  if (atual.pago && !hard) return Response.json({ error: 'alocacao_paga' }, { status: 409 })

  if (hard) {
    const { error } = await admin.from('escalas_alocacao').delete().eq('id', id)
    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ data: { id, deleted: true } })
  }

  const { error } = await admin.from('escalas_alocacao').update({ status: 'cancelado' }).eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ data: { id, status: 'cancelado' } })
}
