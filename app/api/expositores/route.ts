import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getAuthUser, unauthorized, forbidden } from '@/lib/apiAuth'
import { podeTransicionarEstande, exigeExpositor } from '@/lib/expositores'

// Operações AUTORITATIVAS de Expositores & Patrocínios (service-role + getAuthUser).
// Dispatch por `action` no corpo do POST:
//   • estande   — comercializa um ponto do mapa (vender/reservar/bloquear/liberar)
//                 validando a transição e mantendo expo_mapa↔expositores em
//                 SINCRONIA (libera o estande anterior, desvincula o ocupante).
//   • faturar   — gera a RECEITA do expositor/patrocinador em `lancamentos`
//                 (idempotente por expositor_id/patrocinador_id; reversível).
//   • estornar  — desfaz a fatura (remove o lançamento, volta o status).
//   • credenciar— emite uma credencial de expositor (→ módulo Acesso) — best-effort.
//   • contrato  — gera um contrato rascunho (→ módulo Contratos) — best-effort.
//   • logistica — manda as necessidades técnicas p/ a checklist de Produção
//                 (categoria 'logistica') — best-effort.
// As integrações best-effort degradam em silêncio se o módulo-alvo não existir.
// O CRUD demais (criar estande/expositor/cota, marcar entregável) é feito pelo
// client via RLS. Espelha /api/producao e /api/estacionamento/receita.

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const admin = supabaseAdmin as any

const SEL_ESTANDE = 'id,usuario_id,evento_id,codigo,tipo,area_m2,preco_num,status,expositor_id,posicao,cor,obs,criado_em,atualizado_em'
const SEL_EXPOSITOR = 'id,usuario_id,evento_id,empresa,contato,email,telefone,doc,estande_id,contrato_id,credencial_id,lancamento_id,valor_num,status,necessidades,obs,criado_em,atualizado_em'
const SEL_PATRO = 'id,usuario_id,evento_id,cota_id,marca,contato,email,telefone,contrato_id,lancamento_id,valor_num,status,entregaveis_status,obs,criado_em,atualizado_em'

const ESTANDE_STATUS = new Set(['disponivel', 'reservado', 'vendido', 'bloqueado'])

function badRequest(msg: string) { return Response.json({ error: msg }, { status: 400 }) }
function ymd(d = new Date()): string { return d.toISOString().slice(0, 10) }

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return unauthorized()

  const body = await req.json().catch(() => ({}))
  const action = String(body.action || '')

  switch (action) {
    case 'estande':   return comercializarEstande(user.id, body)
    case 'faturar':   return faturar(user.id, body)
    case 'estornar':  return estornar(user.id, body)
    case 'credenciar':return credenciar(user.id, body)
    case 'contrato':  return gerarContrato(user.id, body)
    case 'logistica': return enviarLogistica(user.id, body)
    default:          return badRequest('action inválida')
  }
}

// ── estande: comercializa um ponto do mapa (transição + sincronia) ───────────
async function comercializarEstande(userId: string, body: Record<string, unknown>) {
  const estandeId = String(body.estande_id || '')
  const novo = String(body.status || '')
  if (!estandeId) return badRequest('estande_id é obrigatório')
  if (!ESTANDE_STATUS.has(novo)) return badRequest('status inválido')

  const { data: estande } = await admin.from('expo_mapa').select(SEL_ESTANDE).eq('id', estandeId).maybeSingle()
  if (!estande) return Response.json({ error: 'estande não encontrado' }, { status: 404 })
  if (estande.usuario_id !== userId) return forbidden()

  const force = body.force === true
  if (!force && !podeTransicionarEstande(estande.status, novo)) {
    return Response.json({ error: 'transicao_invalida', de: estande.status, para: novo }, { status: 409 })
  }

  const tocados: string[] = []                 // expositor ids a recarregar no client
  let expositorId: string | null = null

  if (exigeExpositor(novo)) {
    expositorId = body.expositor_id ? String(body.expositor_id) : null
    if (!expositorId) return badRequest('expositor_id é obrigatório para vender/reservar')
    const { data: exp } = await admin.from('expositores').select('id,usuario_id,evento_id,estande_id,status').eq('id', expositorId).maybeSingle()
    if (!exp) return Response.json({ error: 'expositor não encontrado' }, { status: 404 })
    if (exp.usuario_id !== userId) return forbidden()
    if (exp.evento_id !== estande.evento_id) return badRequest('expositor é de outro evento')

    // Libera o estande anterior deste expositor (se for outro).
    if (exp.estande_id && exp.estande_id !== estandeId) {
      await admin.from('expo_mapa').update({ status: 'disponivel', expositor_id: null }).eq('id', exp.estande_id).eq('usuario_id', userId)
    }
    // Desvincula o ocupante anterior deste estande (se for outro expositor).
    if (estande.expositor_id && estande.expositor_id !== expositorId) {
      await admin.from('expositores').update({ estande_id: null }).eq('id', estande.expositor_id).eq('usuario_id', userId)
      tocados.push(estande.expositor_id)
    }
    // Vincula e (ao vender) promove o expositor a confirmado, sem rebaixar faturado.
    const patchExp: Record<string, unknown> = { estande_id: estandeId }
    if (novo === 'vendido' && (exp.status === 'prospecto' || exp.status === 'proposta')) patchExp.status = 'confirmado'
    await admin.from('expositores').update(patchExp).eq('id', expositorId).eq('usuario_id', userId)
    tocados.push(expositorId)
  } else if (estande.expositor_id) {
    // Liberar/bloquear: desvincula o ocupante.
    await admin.from('expositores').update({ estande_id: null }).eq('id', estande.expositor_id).eq('usuario_id', userId)
    tocados.push(estande.expositor_id)
  }

  const { data: updated, error } = await admin.from('expo_mapa')
    .update({ status: novo, expositor_id: expositorId }).eq('id', estandeId).select(SEL_ESTANDE).single()
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ data: updated, expositores_tocados: Array.from(new Set(tocados)) })
}

// ── faturar / estornar: receita no financeiro do evento ──────────────────────
async function eventoCtx(eventoId: string) {
  const { data } = await admin.from('clientes_eventos').select('nome_evento,tipo_evento,propriedade_id').eq('id', eventoId).maybeSingle()
  return data || {}
}

async function faturar(userId: string, body: Record<string, unknown>) {
  const tipo = String(body.tipo || '')           // 'expositor' | 'patrocinador'
  const id = String(body.id || '')
  if (!id || (tipo !== 'expositor' && tipo !== 'patrocinador')) return badRequest('tipo/id inválidos')

  const tabela = tipo === 'expositor' ? 'expositores' : 'patrocinadores'
  const sel = tipo === 'expositor' ? SEL_EXPOSITOR : SEL_PATRO
  const refCol = tipo === 'expositor' ? 'expositor_id' : 'patrocinador_id'
  const { data: row } = await admin.from(tabela).select(sel).eq('id', id).maybeSingle()
  if (!row) return Response.json({ error: 'registro não encontrado' }, { status: 404 })
  if (row.usuario_id !== userId) return forbidden()

  // Valor: o próprio valor_num; p/ patrocinador, cai p/ o preço da cota.
  let valor = Number(row.valor_num) || 0
  if (valor <= 0 && tipo === 'patrocinador' && row.cota_id) {
    const { data: cota } = await admin.from('patrocinio_cotas').select('preco_num').eq('id', row.cota_id).maybeSingle()
    valor = Number(cota?.preco_num) || 0
  }
  if (valor <= 0) return badRequest('valor a faturar precisa ser maior que zero')

  // Idempotente: já existe lançamento p/ este registro?
  const { data: jaLancado } = await admin.from('lancamentos').select('id').eq(refCol, id).maybeSingle()
  if (jaLancado) {
    await admin.from(tabela).update({ status: 'faturado', lancamento_id: jaLancado.id }).eq('id', id)
    return Response.json({ ok: true, lancamento_id: jaLancado.id, valor, ja_faturado: true })
  }

  const ev = await eventoCtx(row.evento_id)
  const nome = tipo === 'expositor' ? (row.empresa || 'Expositor') : (row.marca || 'Patrocinador')
  const categoria = tipo === 'expositor' ? 'Expositores' : 'Patrocínio'
  const insert: Record<string, unknown> = {
    usuario_id: userId, tipo: 'receita', categoria,
    descricao: `${categoria} — ${nome} · ${ev.nome_evento || 'evento'}`,
    tipo_evento: ev.tipo_evento || null, valor, status: 'pago', data: ymd(),
    metodo_pagamento: body.metodo || 'A combinar', prop_id: ev.propriedade_id ?? null,
    [refCol]: id,
  }
  const { data: lanc, error } = await admin.from('lancamentos').insert(insert).select('id').single()
  if (error || !lanc) return Response.json({ error: 'falha ao lançar a receita no caixa' }, { status: 500 })

  await admin.from(tabela).update({ status: 'faturado', lancamento_id: lanc.id }).eq('id', id)
  return Response.json({ ok: true, lancamento_id: lanc.id, valor })
}

async function estornar(userId: string, body: Record<string, unknown>) {
  const tipo = String(body.tipo || '')
  const id = String(body.id || '')
  if (!id || (tipo !== 'expositor' && tipo !== 'patrocinador')) return badRequest('tipo/id inválidos')
  const tabela = tipo === 'expositor' ? 'expositores' : 'patrocinadores'
  const refCol = tipo === 'expositor' ? 'expositor_id' : 'patrocinador_id'

  const { data: row } = await admin.from(tabela).select('id,usuario_id,lancamento_id').eq('id', id).maybeSingle()
  if (!row) return Response.json({ error: 'registro não encontrado' }, { status: 404 })
  if (row.usuario_id !== userId) return forbidden()

  // Remove o(s) lançamento(s) atrelado(s) e volta o status p/ confirmado.
  await admin.from('lancamentos').delete().eq(refCol, id).eq('usuario_id', userId)
  await admin.from(tabela).update({ lancamento_id: null, status: 'confirmado' }).eq('id', id)
  return Response.json({ ok: true, estornado: true })
}

// ── credenciar: emite credencial de expositor (→ Acesso) — best-effort ───────
async function credenciar(userId: string, body: Record<string, unknown>) {
  const id = String(body.expositor_id || '')
  if (!id) return badRequest('expositor_id é obrigatório')
  const { data: exp } = await admin.from('expositores').select(SEL_EXPOSITOR).eq('id', id).maybeSingle()
  if (!exp) return Response.json({ error: 'expositor não encontrado' }, { status: 404 })
  if (exp.usuario_id !== userId) return forbidden()
  if (exp.credencial_id) return Response.json({ ok: true, credencial_id: exp.credencial_id, ja_emitida: true })

  try {
    const token = (globalThis.crypto?.randomUUID?.() || `tok-${Date.now()}`).replace(/-/g, '')
    const { data: cred, error } = await admin.from('credenciais').insert({
      usuario_id: userId, evento_id: exp.evento_id, tipo: 'expositor',
      nome: exp.contato || exp.empresa, empresa: exp.empresa, doc: exp.doc,
      qr_token: token, zonas: [], status: 'emitida',
    }).select('id').single()
    if (error || !cred) throw error || new Error('sem retorno')
    await admin.from('expositores').update({ credencial_id: cred.id }).eq('id', id)
    return Response.json({ ok: true, credencial_id: cred.id })
  } catch {
    // Módulo Acesso ausente — degrada sem quebrar.
    return Response.json({ error: 'modulo_acesso_indisponivel' }, { status: 409 })
  }
}

// ── contrato: gera rascunho (→ Contratos) — best-effort ──────────────────────
async function gerarContrato(userId: string, body: Record<string, unknown>) {
  const tipo = String(body.tipo || '')
  const id = String(body.id || '')
  if (!id || (tipo !== 'expositor' && tipo !== 'patrocinador')) return badRequest('tipo/id inválidos')
  const tabela = tipo === 'expositor' ? 'expositores' : 'patrocinadores'
  const sel = tipo === 'expositor' ? SEL_EXPOSITOR : SEL_PATRO
  const { data: row } = await admin.from(tabela).select(sel).eq('id', id).maybeSingle()
  if (!row) return Response.json({ error: 'registro não encontrado' }, { status: 404 })
  if (row.usuario_id !== userId) return forbidden()
  if (row.contrato_id) return Response.json({ ok: true, contrato_id: row.contrato_id, ja_gerado: true })

  const ev = await eventoCtx(row.evento_id)
  const nome = tipo === 'expositor' ? row.empresa : row.marca
  const ano = new Date().getFullYear()
  const numero = `EXP-${ano}-${String(id).replace(/-/g, '').slice(0, 6).toUpperCase()}`
  let valor = Number(row.valor_num) || 0
  if (valor <= 0 && tipo === 'patrocinador' && row.cota_id) {
    const { data: cota } = await admin.from('patrocinio_cotas').select('preco_num').eq('id', row.cota_id).maybeSingle()
    valor = Number(cota?.preco_num) || 0
  }

  try {
    const titulo = `${tipo === 'expositor' ? 'Contrato de Expositor' : 'Contrato de Patrocínio'} — ${nome} · ${ev.nome_evento || 'evento'}`
    const { data: ctr, error } = await admin.from('contratos').insert({
      usuario_id: userId, evento_id: row.evento_id, numero, titulo,
      valor_num: valor, status: 'rascunho',
    }).select('id').single()
    if (error || !ctr) throw error || new Error('sem retorno')
    await admin.from(tabela).update({ contrato_id: ctr.id }).eq('id', id)
    return Response.json({ ok: true, contrato_id: ctr.id, numero })
  } catch {
    return Response.json({ error: 'modulo_contratos_indisponivel' }, { status: 409 })
  }
}

// ── logistica: necessidades técnicas → checklist de Produção — best-effort ───
async function enviarLogistica(userId: string, body: Record<string, unknown>) {
  const id = String(body.expositor_id || '')
  if (!id) return badRequest('expositor_id é obrigatório')
  const { data: exp } = await admin.from('expositores').select(SEL_EXPOSITOR).eq('id', id).maybeSingle()
  if (!exp) return Response.json({ error: 'expositor não encontrado' }, { status: 404 })
  if (exp.usuario_id !== userId) return forbidden()

  const nec = (exp.necessidades || {}) as Record<string, unknown>
  const itens: string[] = []
  if (Number(nec.energia_kva) > 0) itens.push(`Energia ${nec.energia_kva} kVA — estande ${exp.empresa}`)
  if (nec.internet) itens.push(`Ponto de internet — estande ${exp.empresa}`)
  if (nec.agua) itens.push(`Ponto de água — estande ${exp.empresa}`)
  if (nec.montagem) itens.push(`Montagem/desmontagem — estande ${exp.empresa}`)
  if (typeof nec.obs === 'string' && nec.obs.trim()) itens.push(`${nec.obs.trim()} — estande ${exp.empresa}`)
  if (!itens.length) return badRequest('nenhuma necessidade técnica marcada neste expositor')

  try {
    // Garante a `producao` 1:1 do evento (get-or-create) e insere as tarefas.
    let producaoId: string | null = null
    const { data: prod } = await admin.from('producao').select('id').eq('evento_id', exp.evento_id).eq('usuario_id', userId).maybeSingle()
    if (prod) producaoId = prod.id
    else {
      const ins = await admin.from('producao').insert({ usuario_id: userId, evento_id: exp.evento_id, status: 'planejamento', briefing: {} }).select('id').single()
      if (ins.error) {
        if (ins.error.code === '23505') {
          const { data: again } = await admin.from('producao').select('id').eq('evento_id', exp.evento_id).eq('usuario_id', userId).maybeSingle()
          producaoId = again?.id || null
        } else throw ins.error
      } else producaoId = ins.data.id
    }
    if (!producaoId) throw new Error('sem produção')

    const rows = itens.map((titulo, i) => ({
      usuario_id: userId, producao_id: producaoId, titulo, categoria: 'logistica',
      responsavel: 'producao', prioridade: 'normal', ordem: 1000 + i,
    }))
    const { error } = await admin.from('producao_tarefas').insert(rows)
    if (error) throw error
    return Response.json({ ok: true, tarefas: rows.length, producao_id: producaoId })
  } catch {
    return Response.json({ error: 'modulo_producao_indisponivel' }, { status: 409 })
  }
}
