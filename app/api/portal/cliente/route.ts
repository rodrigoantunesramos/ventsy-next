import { NextRequest } from 'next/server'
import { MercadoPagoConfig, Payment } from 'mercadopago'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getAuthUser, unauthorized, forbidden } from '@/lib/apiAuth'
import { resolverTokenMpDono, baixarParcela } from '@/lib/portalServer'
import { modulosVisiveis, parcelaPaga, parcelaCancelada } from '@/lib/portal'

// Rota AUTENTICADA do CONTRATANTE (área (client)/eventos). É a ÚNICA porta de
// entrada do cliente aos dados do evento — tudo passa por aqui (service-role) e
// SEMPRE valida o acesso via portal_acessos (user_id = JWT). Assim o cliente só
// enxerga o próprio evento, sem precisar abrir RLS cross-tenant nas tabelas-âncora.
//   POST { action:'meus_eventos', token? }            → lista + auto-claim do convite
//   POST { action:'evento', evento_id }               → painel completo do evento
//   POST { action:'rsvp', evento_id, op, convidado }  → CRUD/RSVP de convidados
//   POST { action:'pagar_parcela', evento_id, parcela_id } → PIX via Mercado Pago
//   POST { action:'abrir_conversa', evento_id }       → cria/obtém a conversa com o dono

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const admin = supabaseAdmin as any

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Acesso válido do usuário a um evento (não revogado). Carrega evento + config do
// dono. Retorna sempre o mesmo formato; `erro` preenchido = barrar a requisição.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function carregarAcesso(uid: string, eventoId: string): Promise<{ erro: Response | null; ac: any; ev: any; cfg: any }> {
  const { data: ac } = await admin
    .from('portal_acessos')
    .select('*')
    .eq('evento_id', eventoId)
    .eq('user_id', uid)
    .neq('status', 'revogado')
    .maybeSingle()
  if (!ac) return { erro: forbidden(), ac: null, ev: null, cfg: null }

  const { data: ev } = await admin.from('clientes_eventos').select('*').eq('id', eventoId).maybeSingle()
  if (!ev) return { erro: Response.json({ error: 'Evento não encontrado.' }, { status: 404 }), ac, ev: null, cfg: null }

  const { data: cfg } = await admin.from('portal_config').select('*').eq('usuario_id', ev.usuario_id).maybeSingle()
  if (cfg && cfg.ativo === false) return { erro: Response.json({ error: 'O portal está indisponível no momento.' }, { status: 423 }), ac, ev, cfg }

  return { erro: null, ac, ev, cfg: cfg || null }
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return unauthorized()
  const email = (user.email || '').trim().toLowerCase()

  const body = await req.json().catch(() => ({}))
  const action = String(body.action || '')

  // ── Lista os eventos do contratante + vincula o convite (claim) ────────────
  if (action === 'meus_eventos') {
    // 1) Auto-claim por e-mail: convites pendentes endereçados a este e-mail.
    if (email) {
      try {
        await admin
          .from('portal_acessos')
          .update({ user_id: user.id, status: 'ativo', aceito_em: new Date().toISOString() })
          .eq('email', email)
          .is('user_id', null)
          .neq('status', 'revogado')
      } catch { /* best-effort */ }
    }
    // 2) Claim explícito por token (link do convite — cobre e-mail divergente).
    const token = String(body.token || '').trim()
    if (token) {
      const { data: porToken } = await admin.from('portal_acessos').select('id, user_id, status').eq('token', token).maybeSingle()
      if (porToken && !porToken.user_id && porToken.status !== 'revogado') {
        await admin.from('portal_acessos')
          .update({ user_id: user.id, status: 'ativo', aceito_em: new Date().toISOString() })
          .eq('id', porToken.id)
      }
    }

    // 3) Lista os acessos vinculados a este usuário.
    const { data: acessos } = await admin
      .from('portal_acessos').select('*').eq('user_id', user.id).neq('status', 'revogado')
    const lista = (acessos || []) as Record<string, unknown>[]
    if (!lista.length) return Response.json({ eventos: [] })

    const eventoIds = lista.map((a) => a.evento_id)
    const { data: eventos } = await admin
      .from('clientes_eventos')
      .select('id, usuario_id, nome_evento, tipo_evento, data_inicio, data_fim, status, propriedade_id')
      .in('id', eventoIds)
    const evById = new Map((eventos || []).map((e: Record<string, unknown>) => [e.id, e]))

    const propIds = [...new Set((eventos || []).map((e: Record<string, unknown>) => e.propriedade_id).filter(Boolean))]
    const { data: props } = propIds.length
      ? await admin.from('propriedades').select('id, nome, cidade, estado').in('id', propIds)
      : { data: [] }
    const propById = new Map((props || []).map((p: Record<string, unknown>) => [p.id, p]))

    const donoIds = [...new Set((eventos || []).map((e: Record<string, unknown>) => e.usuario_id).filter(Boolean))]
    const { data: cfgs } = donoIds.length
      ? await admin.from('portal_config').select('usuario_id, ativo').in('usuario_id', donoIds)
      : { data: [] }
    const cfgByDono = new Map((cfgs || []).map((c: Record<string, unknown>) => [c.usuario_id, c]))

    const eventosOut = lista
      .map((a) => {
        const ev = evById.get(a.evento_id) as Record<string, unknown> | undefined
        if (!ev) return null
        const prop = propById.get(ev.propriedade_id) as Record<string, unknown> | undefined
        const cfg = cfgByDono.get(ev.usuario_id) as Record<string, unknown> | undefined
        return {
          acesso_id: a.id,
          evento_id: ev.id,
          nome_evento: ev.nome_evento,
          tipo_evento: ev.tipo_evento,
          data_inicio: ev.data_inicio,
          data_fim: ev.data_fim,
          status: ev.status,
          propriedade: prop ? { nome: prop.nome, cidade: prop.cidade, estado: prop.estado } : null,
          portal_ativo: cfg ? cfg.ativo !== false : true,
        }
      })
      .filter(Boolean)

    return Response.json({ eventos: eventosOut })
  }

  // Daqui pra baixo, tudo exige evento_id + acesso válido.
  const eventoId = String(body.evento_id || '').trim()
  if (!eventoId) return Response.json({ error: 'evento_id é obrigatório.' }, { status: 400 })

  // ── Painel completo de um evento ───────────────────────────────────────────
  if (action === 'evento') {
    const { erro, ac, ev, cfg } = await carregarAcesso(user.id, eventoId)
    if (erro) return erro

    const vis = modulosVisiveis(cfg, ac)
    const donoId = ev.usuario_id as string

    // Dono + propriedade (dados públicos do anfitrião)
    const [{ data: dono }, { data: prop }] = await Promise.all([
      admin.from('usuarios').select('nome').eq('id', donoId).maybeSingle(),
      ev.propriedade_id
        ? admin.from('propriedades').select('id, nome, cidade, estado, endereco, bairro').eq('id', ev.propriedade_id).maybeSingle()
        : Promise.resolve({ data: null }),
    ])

    // Financeiro (só se o módulo estiver visível)
    let parcelas: unknown[] = []
    if (vis.financeiro) {
      const { data } = await admin
        .from('parcelas')
        .select('id, numero, descricao, valor, vencimento, status, pago_em, metodo_pagamento')
        .eq('evento_id', eventoId)
        .order('vencimento', { nullsFirst: false })
      parcelas = (data || []).map((p: Record<string, unknown>) => ({ ...p, id: Number(p.id), valor: Number(p.valor) || 0 }))
    }

    // Contrato (só os campos que o cliente precisa p/ ver e assinar)
    let contrato: Record<string, unknown> | null = null
    if (vis.contrato) {
      const { data } = await admin
        .from('contratos')
        .select('id, numero, titulo, status, link_token, assinado_em, valor_num, moeda')
        .eq('evento_id', eventoId)
        .order('criado_em', { ascending: false })
        .limit(1)
        .maybeSingle()
      contrato = data || null
    }

    // Convidados
    let convidados: unknown[] = []
    if (vis.convidados) {
      const { data } = await admin
        .from('convidados')
        .select('id, nome, email, telefone, status, acompanhantes, mesa, restricao_alimentar, observacao, origem')
        .eq('evento_id', eventoId)
        .order('criado_em', { ascending: true })
      convidados = data || []
    }

    // Conversa existente com o dono (para o módulo mensagens)
    let conversaId: string | null = null
    if (vis.mensagens && ev.propriedade_id) {
      const { data: conv } = await admin
        .from('conversas').select('id').eq('user_id', user.id).eq('propriedade_id', ev.propriedade_id).maybeSingle()
      conversaId = conv?.id || null
    }

    // Disponibilidade de pagamento online (sem vazar o token)
    const { token: mpToken } = await resolverTokenMpDono(donoId)
    const mpDisponivel = !!mpToken

    // Marca o último acesso (best-effort)
    admin.from('portal_acessos').update({ ultimo_acesso_em: new Date().toISOString() }).eq('id', ac.id).then(() => {}, () => {})

    return Response.json({
      acesso: { status: ac.status, modulos: ac.modulos ?? null, boas_vindas: ac.boas_vindas ?? null },
      config: cfg ? { cor: cfg.cor, boas_vindas: cfg.boas_vindas, modulos: cfg.modulos } : null,
      modulos: vis,
      evento: ev,
      propriedade: prop,
      dono: dono ? { nome: dono.nome } : null,
      parcelas,
      contrato,
      convidados,
      conversa_id: conversaId,
      mp_disponivel: mpDisponivel,
    })
  }

  // ── RSVP / CRUD de convidados pelo cliente ─────────────────────────────────
  if (action === 'rsvp') {
    const { erro, ac, ev, cfg } = await carregarAcesso(user.id, eventoId)
    if (erro) return erro
    if (!modulosVisiveis(cfg, ac).convidados) return forbidden()

    const op = String(body.op || '')
    const donoId = ev.usuario_id as string
    const c = (body.convidado || {}) as Record<string, unknown>

    const camposLimpos = () => ({
      nome: String(c.nome || '').slice(0, 160),
      email: c.email ? String(c.email).slice(0, 200) : null,
      telefone: c.telefone ? String(c.telefone).slice(0, 40) : null,
      status: ['convidado', 'confirmado', 'recusado'].includes(String(c.status)) ? String(c.status) : 'convidado',
      acompanhantes: Math.max(0, Math.min(50, Number(c.acompanhantes) || 0)),
      mesa: c.mesa ? String(c.mesa).slice(0, 40) : null,
      restricao_alimentar: c.restricao_alimentar ? String(c.restricao_alimentar).slice(0, 240) : null,
      observacao: c.observacao ? String(c.observacao).slice(0, 240) : null,
    })

    if (op === 'add') {
      const campos = camposLimpos()
      if (!campos.nome) return Response.json({ error: 'O nome do convidado é obrigatório.' }, { status: 422 })
      const { error } = await admin.from('convidados').insert({
        usuario_id: donoId, evento_id: eventoId, origem: 'cliente', ...campos,
      })
      if (error) return Response.json({ error: 'Não foi possível adicionar o convidado.', detail: error.message }, { status: 500 })
    } else if (op === 'update' || op === 'set_status') {
      const id = String(c.id || '')
      if (!id) return Response.json({ error: 'id do convidado é obrigatório.' }, { status: 400 })
      const { data: alvo } = await admin.from('convidados').select('id, evento_id').eq('id', id).maybeSingle()
      if (!alvo || alvo.evento_id !== eventoId) return Response.json({ error: 'Convidado não encontrado.' }, { status: 404 })
      const upd = op === 'set_status'
        ? { status: ['convidado', 'confirmado', 'recusado'].includes(String(c.status)) ? String(c.status) : 'convidado' }
        : camposLimpos()
      const { error } = await admin.from('convidados').update(upd).eq('id', id)
      if (error) return Response.json({ error: 'Não foi possível atualizar.', detail: error.message }, { status: 500 })
    } else if (op === 'remove') {
      const id = String(c.id || '')
      const { data: alvo } = await admin.from('convidados').select('id, evento_id').eq('id', id).maybeSingle()
      if (!alvo || alvo.evento_id !== eventoId) return Response.json({ error: 'Convidado não encontrado.' }, { status: 404 })
      await admin.from('convidados').delete().eq('id', id)
    } else {
      return Response.json({ error: 'Operação de RSVP inválida.' }, { status: 400 })
    }

    const { data: convidados } = await admin
      .from('convidados')
      .select('id, nome, email, telefone, status, acompanhantes, mesa, restricao_alimentar, observacao, origem')
      .eq('evento_id', eventoId)
      .order('criado_em', { ascending: true })
    return Response.json({ ok: true, convidados: convidados || [] })
  }

  // ── Pagar uma parcela via PIX (Mercado Pago) ───────────────────────────────
  if (action === 'pagar_parcela') {
    const { erro, ac, ev, cfg } = await carregarAcesso(user.id, eventoId)
    if (erro) return erro
    if (!modulosVisiveis(cfg, ac).financeiro) return forbidden()

    const parcelaId = body.parcela_id
    const { data: p } = await admin
      .from('parcelas').select('id, evento_id, usuario_id, numero, descricao, valor, status').eq('id', parcelaId).maybeSingle()
    if (!p || p.evento_id !== eventoId) return Response.json({ error: 'Parcela não encontrada.' }, { status: 404 })
    if (parcelaPaga(p.status)) return Response.json({ error: 'Esta parcela já está paga.' }, { status: 409 })
    if (parcelaCancelada(p.status)) return Response.json({ error: 'Esta parcela está cancelada.' }, { status: 409 })
    const valor = Number(p.valor) || 0
    if (valor <= 0) return Response.json({ error: 'Valor da parcela inválido.' }, { status: 422 })

    const donoId = ev.usuario_id as string
    const { token } = await resolverTokenMpDono(donoId)
    if (!token) {
      // Degrade: pagamento online indisponível — a UI mostra os dados p/ pagar direto.
      return Response.json({ error: 'Pagamento online indisponível. Combine o pagamento com o organizador.', code: 'mp_indisponivel' }, { status: 503 })
    }

    const origin = (process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin || 'https://ventsy.com.br').replace(/\/$/, '')
    const mp = new MercadoPagoConfig({ accessToken: token })
    const payment = new Payment(mp)
    try {
      const result = await payment.create({
        body: {
          transaction_amount: valor,
          description: `${ev.nome_evento || 'Evento'} — ${(p.descricao || `Parcela ${p.numero ?? ''}`).toString().trim()}`,
          payment_method_id: 'pix',
          payer: { email: email || `cliente+${user.id}@ventsy.com.br`, first_name: (user.email || 'Cliente').split('@')[0] },
          external_reference: `parcela:${p.id}`,
          notification_url: `${origin}/api/pagamentos/webhook`,
          metadata: { tipo: 'parcela', parcela_id: Number(p.id), usuario_id: donoId },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const res = result as any
      const status: string = res.status

      // Recibo p/ o webhook reconciliar (acha por mp_payment_id).
      try {
        await admin.from('pagamentos').insert({
          usuario_id: donoId, parcela_id: Number(p.id), valor, metodo: 'pix',
          status, mp_payment_id: String(res.id), mp_status: status, mp_status_detail: res.status_detail,
        })
      } catch { /* ignora erro do recibo */ }

      // PIX aprovado na hora é raro, mas cobre cartão/edge: baixa já.
      if (status === 'approved') {
        await baixarParcela(p.id, { metodo: 'Pix (Portal)', pagoEm: ymd(new Date()) })
      }

      const pix = res.point_of_interaction?.transaction_data
      return Response.json({
        status,
        payment_id: res.id,
        pix: pix ? { qr_code: pix.qr_code, qr_code_base64: pix.qr_code_base64, ticket_url: pix.ticket_url } : null,
      })
    } catch (e) {
      return Response.json({ error: e instanceof Error ? e.message : 'Falha ao gerar o pagamento.' }, { status: 500 })
    }
  }

  // ── Abrir / obter a conversa com o organizador ─────────────────────────────
  if (action === 'abrir_conversa') {
    const { erro, ev } = await carregarAcesso(user.id, eventoId)
    if (erro) return erro
    const propriedadeId = ev.propriedade_id
    if (!propriedadeId) return Response.json({ error: 'Evento sem espaço vinculado para conversa.' }, { status: 422 })

    const { data: existing } = await admin
      .from('conversas').select('id').eq('user_id', user.id).eq('propriedade_id', propriedadeId).maybeSingle()
    if (existing) return Response.json({ ok: true, conversa_id: existing.id })

    const { data: prop } = await admin.from('propriedades').select('usuario_id').eq('id', propriedadeId).maybeSingle()
    const { data: nova, error } = await admin
      .from('conversas')
      .insert({ user_id: user.id, owner_id: prop?.usuario_id ?? ev.usuario_id, propriedade_id: propriedadeId })
      .select('id')
      .single()
    if (error) return Response.json({ error: 'Não foi possível abrir a conversa.' }, { status: 500 })
    return Response.json({ ok: true, conversa_id: nova.id })
  }

  return Response.json({ error: 'Ação inválida.' }, { status: 400 })
}
