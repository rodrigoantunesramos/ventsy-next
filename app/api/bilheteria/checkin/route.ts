import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getAuthUser, unauthorized, forbidden } from '@/lib/apiAuth'
import { normalizarLeitura } from '@/lib/bilheteria'

// Check-in AUTORITATIVO de um ingresso (organizador autenticado). Lê o QR do
// ingresso (mesmo payload da credencial), confere que o ingresso é do dono e
// aplica anti-duplicidade: só ingresso PAGO pode entrar, e uma única vez (salvo
// `force`). Marca o ingresso como 'checkin' (e, se houver credencial vinculada,
// reflete na credencial p/ a lotação do /painel/acesso). Espelha /api/acesso.
//
// Para o controle de lotação por ZONA em tempo real, use a Portaria de
// /painel/acesso — o QR é o mesmo, então funciona nativamente lá.

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const admin = supabaseAdmin as any

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return unauthorized()

  const body = await req.json().catch(() => ({}))
  const force = body.force === true

  // Resolve o ingresso por id ou por token lido (QR/coletor).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let ing: any = null
  if (body.ingresso_id) {
    const { data } = await admin.from('ingressos').select('*').eq('id', String(body.ingresso_id)).maybeSingle()
    ing = data
  } else if (body.token) {
    const tk = normalizarLeitura(String(body.token))
    if (!tk) return Response.json({ error: 'token vazio' }, { status: 400 })
    const { data } = await admin.from('ingressos').select('*').eq('qr_token', tk).maybeSingle()
    ing = data
  } else {
    return Response.json({ error: 'informe ingresso_id ou token' }, { status: 400 })
  }

  if (!ing) return Response.json({ error: 'ingresso_nao_encontrado', motivo: 'desconhecido', aviso: 'QR não reconhecido.' }, { status: 404 })
  if (ing.usuario_id !== user.id) return forbidden()

  // Nome da categoria (para o feedback da portaria).
  const { data: cat } = await admin.from('ingressos_categorias').select('nome, lote_nome').eq('id', ing.categoria_id).maybeSingle()
  const dados = { id: ing.id, nome: ing.comprador_nome || 'Portador', categoria: cat?.nome || '—', status: ing.status }

  if (ing.status === 'cancelado') {
    return Response.json({ error: 'recusado', motivo: 'cancelado', bloqueante: true, aviso: 'Ingresso cancelado/reembolsado.', ingresso: dados }, { status: 409 })
  }
  if (ing.status === 'reservado') {
    return Response.json({ error: 'recusado', motivo: 'nao_pago', bloqueante: true, aviso: 'Ingresso ainda não foi pago.', ingresso: dados }, { status: 409 })
  }
  if (ing.status === 'checkin' && !force) {
    return Response.json({ error: 'recusado', motivo: 'duplicado', bloqueante: true, aviso: 'Check-in já realizado.', ingresso: dados, checkin_em: ing.checkin_em }, { status: 409 })
  }

  const agoraIso = new Date().toISOString()
  await admin.from('ingressos').update({ status: 'checkin', checkin_em: agoraIso }).eq('id', ing.id)
  // Reflete na credencial (se houver) — denormalização leve p/ a lotação do Acesso.
  if (ing.credencial_id) {
    try { await admin.from('credenciais').update({ status: 'checkin' }).eq('id', ing.credencial_id).neq('status', 'bloqueada') } catch { /* acesso ausente */ }
  }

  return Response.json({ ok: true, ingresso: { ...dados, status: 'checkin' }, checkin_em: agoraIso, reentrada: ing.status === 'checkin' })
}
