import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getAuthUser, unauthorized, forbidden } from '@/lib/apiAuth'
import { num, round2, parseRestricoesTexto, isMissingTable } from '@/lib/catering'

// Operações AUTORITATIVAS de Catering, Buffet & Bar (service-role + getAuthUser).
// Espelha /api/producao e /api/estoque. A identidade é SEMPRE user.id.
//
//   • op 'ensure'    — get-or-create do catering_evento + bar_evento (1:1 com o
//                      evento, race-safe via UNIQUE(evento_id)); semeia convidados
//                      e restrições a partir de clientes_eventos.
//   • op 'requisicao'— gera uma requisição de compras (requisicoes +
//                      requisicao_itens) a partir do dimensionamento; grava
//                      requisicao_id no catering_evento. 409 se Compras ausente.
//   • op 'consumir'  — baixa o Estoque: insere SAÍDAS em estoque_mov (evento_id),
//                      valida posse + saldo (salvo force); o custo REAL é o que o
//                      trigger valora. 409 se Estoque ausente / saldo insuficiente.
//   • op 'estornar'  — apaga as saídas geradas e zera o consumo do evento.
//
// O cardápio (cardapios), a edição de convidados/restrições (catering_evento) e
// o bar (bar_evento) são gravados pelo client via RLS — só o que cruza módulos
// (Compras/Estoque) e o get-or-create race-safe passam por aqui.

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const admin = supabaseAdmin as any

const SEL_CAT = 'id,usuario_id,evento_id,cardapio_id,convidados,fator_ajuste,restricoes,ajustes,custo_previsto_num,receita_num,custo_real_num,requisicao_id,consumo_movs,baixado_em,obs,criado_em,atualizado_em'
const SEL_BAR = 'id,usuario_id,evento_id,tipo,drinks,consumo,perdas_num,custo_num,receita_num,obs,criado_em,atualizado_em'
const SEL_EVENTO = 'id,usuario_id,tipo_evento,data_inicio,qtd_adultos,qtd_criancas,restricoes_alimentares'

function badRequest(msg: string) { return Response.json({ error: msg }, { status: 400 }) }

// ── Evento do dono (semente p/ ensure) ───────────────────────────────────────
async function carregarEvento(id: string, userId: string) {
  const { data } = await admin.from('clientes_eventos').select(SEL_EVENTO).eq('id', id).maybeSingle()
  if (!data || data.usuario_id !== userId) return null
  return data
}

async function selectCatering(evento_id: string, userId: string) {
  const { data } = await admin.from('catering_evento').select(SEL_CAT)
    .eq('evento_id', evento_id).eq('usuario_id', userId).maybeSingle()
  return data || null
}
async function selectBar(evento_id: string, userId: string) {
  const { data } = await admin.from('bar_evento').select(SEL_BAR)
    .eq('evento_id', evento_id).eq('usuario_id', userId).maybeSingle()
  return data || null
}

// ── POST: roteia por `op` ────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return unauthorized()

  const body = await req.json().catch(() => ({}))
  const op = String(body.op || 'ensure')
  const evento_id = String(body.evento_id || '')
  if (!evento_id) return badRequest('evento_id é obrigatório')

  const evento = await carregarEvento(evento_id, user.id)
  if (!evento) return forbidden()

  if (op === 'ensure') return ensure(user.id, evento)
  if (op === 'requisicao') return gerarRequisicao(user.id, evento_id, body)
  if (op === 'consumir') return consumir(user.id, evento_id, body)
  if (op === 'estornar') return estornar(user.id, evento_id)
  return badRequest('op inválida')
}

// ── ensure: get-or-create catering_evento + bar_evento (1:1, race-safe) ──────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function ensure(userId: string, evento: any) {
  const evento_id = String(evento.id)

  let catering = await selectCatering(evento_id, userId)
  if (!catering) {
    const convidados = Math.max(0, (Number(evento.qtd_adultos) || 0) + (Number(evento.qtd_criancas) || 0))
    // Restrições detectadas no texto do CRM viram linhas (quantidade 1 — ajustável).
    const restricoes = parseRestricoesTexto(evento.restricoes_alimentares).map((r) => ({ restricao: r, quantidade: 1 }))
    const ins = await admin.from('catering_evento')
      .insert({ usuario_id: userId, evento_id, convidados, restricoes })
      .select(SEL_CAT).single()
    if (ins.error) {
      if (isMissingTable(ins.error)) return Response.json({ error: ins.error.message }, { status: 500 })
      if (ins.error.code === '23505') catering = await selectCatering(evento_id, userId)
      else return Response.json({ error: ins.error.message }, { status: 500 })
    } else {
      catering = ins.data
    }
  }
  if (!catering) return Response.json({ error: 'falha ao criar A&B do evento' }, { status: 500 })

  let bar = await selectBar(evento_id, userId)
  if (!bar) {
    const ins = await admin.from('bar_evento')
      .insert({ usuario_id: userId, evento_id, tipo: 'sem_bar' })
      .select(SEL_BAR).single()
    if (ins.error) {
      if (ins.error.code === '23505') bar = await selectBar(evento_id, userId)
      else if (!isMissingTable(ins.error)) return Response.json({ error: ins.error.message }, { status: 500 })
    } else {
      bar = ins.data
    }
  }

  return Response.json({ data: { catering, bar } })
}

// ── requisicao: dimensionamento → requisição de compras ──────────────────────
async function gerarRequisicao(userId: string, evento_id: string, body: Record<string, unknown>) {
  const catering = await selectCatering(evento_id, userId)
  if (!catering) return badRequest('A&B do evento não inicializado')

  const linhas = normalizarLinhas(body.linhas)
  if (linhas.length === 0) return badRequest('nada para requisitar — defina a ficha técnica do cardápio')

  // Compras disponível?
  const probe = await admin.from('requisicoes').select('id', { head: true, count: 'exact' }).limit(1)
  if (probe.error && isMissingTable(probe.error)) {
    return Response.json({ error: 'compras_indisponivel' }, { status: 409 })
  }

  const total = round2(linhas.reduce((s, l) => s + l.custo_total_num, 0))
  const numero = await proximoNumeroReq(userId)
  const justificativa = `A&B — ${String(body.cardapio_nome || 'cardápio')} · ${linhas.length} insumo(s)`

  const reqIns = await admin.from('requisicoes').insert({
    usuario_id: userId, numero, solicitante: 'Catering', evento_id,
    justificativa, prioridade: 'media', status: 'aberta', valor_estimado_num: total,
    obs: body.obs ? String(body.obs) : null,
  }).select('id,numero').single()
  if (reqIns.error) return Response.json({ error: reqIns.error.message }, { status: 500 })

  const itens = linhas.map((l) => ({
    requisicao_id: reqIns.data.id, usuario_id: userId,
    produto_id: l.produto_id, descricao: l.nome, quantidade: l.qtd_total,
    unidade: l.unidade, valor_estimado_num: l.custo_total_num,
  }))
  const itIns = await admin.from('requisicao_itens').insert(itens)
  if (itIns.error) {
    // rollback best-effort para não deixar requisição órfã
    await admin.from('requisicoes').delete().eq('id', reqIns.data.id)
    return Response.json({ error: itIns.error.message }, { status: 500 })
  }

  await admin.from('catering_evento')
    .update({ requisicao_id: reqIns.data.id, custo_previsto_num: total })
    .eq('id', catering.id)

  return Response.json({ data: { requisicao_id: reqIns.data.id, numero: reqIns.data.numero, itens: itens.length, total } })
}

async function proximoNumeroReq(userId: string): Promise<string> {
  const { count } = await admin.from('requisicoes').select('id', { count: 'exact', head: true }).eq('usuario_id', userId)
  return `REQ-${String((count || 0) + 1).padStart(4, '0')}`
}

// ── consumir: baixa o Estoque (saídas valoradas pelo trigger) ────────────────
async function consumir(userId: string, evento_id: string, body: Record<string, unknown>) {
  const catering = await selectCatering(evento_id, userId)
  if (!catering) return badRequest('A&B do evento não inicializado')
  const force = body.force === true
  if (catering.baixado_em && !force) {
    return Response.json({ error: 'consumo_ja_registrado', custo_real: num(catering.custo_real_num) }, { status: 409 })
  }

  const linhas = normalizarLinhas(body.linhas).filter((l) => l.produto_id && l.qtd_total > 0)
  if (linhas.length === 0) return badRequest('nenhum insumo controlado em Estoque para baixar')

  // Carrega os produtos referenciados (posse + saldo) numa só consulta.
  const ids = [...new Set(linhas.map((l) => l.produto_id as string))]
  const prodRes = await admin.from('produtos').select('id,usuario_id,estoque_atual,local').in('id', ids)
  if (prodRes.error && isMissingTable(prodRes.error)) {
    return Response.json({ error: 'estoque_indisponivel' }, { status: 409 })
  }
  const byId = new Map<string, { usuario_id: string; estoque_atual: number; local: string }>(
    (prodRes.data || []).map((p: { id: string; usuario_id: string; estoque_atual: number; local: string }) =>
      [p.id, { usuario_id: p.usuario_id, estoque_atual: num(p.estoque_atual), local: p.local }]),
  )

  // Valida posse e saldo ANTES de inserir nada (validate-all → insert-all).
  const semSaldo: { produto_id: string; nome: string; saldo: number; solicitado: number }[] = []
  for (const l of linhas) {
    const p = byId.get(l.produto_id as string)
    if (!p || p.usuario_id !== userId) return forbidden()
    if (!force && l.qtd_total > p.estoque_atual) {
      semSaldo.push({ produto_id: l.produto_id as string, nome: l.nome, saldo: p.estoque_atual, solicitado: l.qtd_total })
    }
  }
  if (semSaldo.length > 0) {
    return Response.json({ error: 'saldo_insuficiente', itens: semSaldo }, { status: 409 })
  }

  const rows = linhas.map((l) => ({
    usuario_id: userId, produto_id: l.produto_id, tipo: 'saida', quantidade: l.qtd_total,
    custo_unit_num: 0, motivo: `Consumo A&B${body.cardapio_nome ? ` — ${String(body.cardapio_nome)}` : ''}`,
    evento_id, local_origem: byId.get(l.produto_id as string)?.local || null,
  }))
  const movIns = await admin.from('estoque_mov').insert(rows).select('id,custo_total_num')
  if (movIns.error) return Response.json({ error: movIns.error.message }, { status: 500 })

  const novosIds: string[] = (movIns.data || []).map((m: { id: string }) => m.id)
  const custoReal = round2((movIns.data || []).reduce((s: number, m: { custo_total_num: number }) => s + Math.abs(num(m.custo_total_num)), 0))
  const acumulado: string[] = [...(Array.isArray(catering.consumo_movs) ? catering.consumo_movs : []), ...novosIds]

  await admin.from('catering_evento').update({
    consumo_movs: acumulado,
    custo_real_num: round2(num(catering.custo_real_num) + custoReal),
    baixado_em: new Date().toISOString(),
  }).eq('id', catering.id)

  return Response.json({ data: { movimentos: novosIds.length, custo_real: round2(num(catering.custo_real_num) + custoReal) } })
}

// ── estornar: apaga as saídas geradas e zera o consumo ───────────────────────
async function estornar(userId: string, evento_id: string) {
  const catering = await selectCatering(evento_id, userId)
  if (!catering) return badRequest('A&B do evento não inicializado')
  const movs: string[] = Array.isArray(catering.consumo_movs) ? catering.consumo_movs : []
  if (movs.length > 0) {
    // Só apaga as do próprio dono (defensivo); o trigger recalcula os saldos.
    await admin.from('estoque_mov').delete().eq('usuario_id', userId).in('id', movs)
  }
  await admin.from('catering_evento')
    .update({ consumo_movs: [], custo_real_num: 0, baixado_em: null })
    .eq('id', catering.id)
  return Response.json({ data: { estornados: movs.length } })
}

// ── Normalização das linhas do dimensionamento vindas do client ──────────────
type Linha = { produto_id: string | null; nome: string; unidade: string; qtd_total: number; custo_total_num: number }
function normalizarLinhas(raw: unknown): Linha[] {
  if (!Array.isArray(raw)) return []
  const out: Linha[] = []
  for (const r of raw) {
    if (!r || typeof r !== 'object') continue
    const o = r as Record<string, unknown>
    const qtd = round2(num(o.qtd_total))
    if (qtd <= 0) continue
    out.push({
      produto_id: o.produto_id ? String(o.produto_id) : null,
      nome: String(o.nome || 'Insumo').slice(0, 200),
      unidade: String(o.unidade || 'un').slice(0, 20),
      qtd_total: qtd,
      custo_total_num: round2(num(o.custo_total_num)),
    })
  }
  return out
}
