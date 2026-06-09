import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getAuthUser, unauthorized, forbidden } from '@/lib/apiAuth'
import {
  type ExigenciaTemplate, type TipoLicenca,
  gerarLicencasDoEvento, tipoLabel,
} from '@/lib/licencas'

// Operações AUTORITATIVAS de Licenças, Alvarás & Compliance (service-role).
// Despacha por `action` no corpo (espelha /api/expositores):
//   • aplicar_checklist — gera as licenças POR EVENTO a partir das exigências de
//     um checklist (tipo/porte), filtradas pelo público estimado. Aditivo e
//     idempotente por TIPO: re-aplicar só insere exigências ainda ausentes (não
//     duplica). Sem `force`, recusa quando o evento já tem licenças (409).
//   • lancar_custo — lança o custo_num da licença como DESPESA em `lancamentos`
//     (categoria "Licenças") — custo de licenças entra no contábil. Idempotente
//     via licencas.lancamento_id.
//   • estornar_custo — remove a despesa e desvincula.
// O CRUD comum das licenças (criar/editar/anexar/mudar status) é feito pelo
// client via RLS — aqui ficam só as operações que cruzam evento/caixa.

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const admin = supabaseAdmin as any

const SEL_LIC =
  'id,usuario_id,propriedade_id,escopo,evento_id,tipo,titulo,orgao,orgao_contato,numero,protocolo,emissao,validade,dias_aviso,custo_num,status,obrigatorio,responsavel,documento_url,documento_nome,lancamento_id,obs,criado_em,atualizado_em'

const TIPOS_VALIDOS = new Set<TipoLicenca>([
  'funcionamento', 'avcb_bombeiros', 'sanitaria', 'ambiental', 'ruido_som',
  'ecad', 'evento_publico', 'policia', 'via_publica', 'anac', 'outro',
])

function badRequest(msg: string) { return Response.json({ error: msg }, { status: 400 }) }
function ymd(v: unknown): string | null {
  const s = typeof v === 'string' ? v : ''
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(s)
  return m ? m[1] : null
}
function hojeYMD(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

// ── Dispatcher ───────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return unauthorized()

  const body = await req.json().catch(() => ({}))
  const action = String(body.action || '')
  switch (action) {
    case 'aplicar_checklist': return aplicarChecklist(user.id, body)
    case 'lancar_custo':      return lancarCusto(user.id, body)
    case 'estornar_custo':    return estornarCusto(user.id, body)
    default:                  return badRequest('ação inválida')
  }
}

// ── Evento (dono + campos p/ propriedade/validade/público) ───────────────────
type EventoRow = {
  id: string; usuario_id: string; tipo_evento: string | null; data_inicio: string | null
  propriedade_id: number | null; qtd_adultos: number | null; qtd_criancas: number | null
  nome_evento: string | null
}
async function carregarEvento(id: string, userId: string): Promise<EventoRow | null> {
  const { data } = await admin.from('clientes_eventos')
    .select('id,usuario_id,tipo_evento,data_inicio,propriedade_id,qtd_adultos,qtd_criancas,nome_evento')
    .eq('id', id).maybeSingle()
  if (!data || data.usuario_id !== userId) return null
  return data as EventoRow
}

// ── aplicar_checklist: gera exigências do evento ─────────────────────────────
async function aplicarChecklist(userId: string, body: Record<string, unknown>) {
  const evento_id = String(body.evento_id || '')
  if (!evento_id) return badRequest('evento_id é obrigatório')

  const evento = await carregarEvento(evento_id, userId)
  if (!evento) return forbidden()

  // Itens do checklist (built-in ou customizado — vêm validados do client).
  const rawItens = Array.isArray(body.itens) ? body.itens : []
  const itens: ExigenciaTemplate[] = rawItens
    .map((i): ExigenciaTemplate | null => {
      const tipo = String((i as ExigenciaTemplate).tipo || 'outro') as TipoLicenca
      if (!TIPOS_VALIDOS.has(tipo)) return null
      const it = i as Partial<ExigenciaTemplate>
      return {
        tipo,
        titulo: String(it.titulo || tipoLabel(tipo)).slice(0, 200),
        obrigatorio: it.obrigatorio !== false,
        publicoMin: Math.max(0, Number(it.publicoMin) || 0),
        orgao: String(it.orgao || '').slice(0, 200),
        dias_aviso: Math.max(0, Number(it.dias_aviso) || 60),
        descricao: String(it.descricao || '').slice(0, 500),
      }
    })
    .filter((x): x is ExigenciaTemplate => x !== null)
  if (!itens.length) return badRequest('nenhuma exigência informada')

  // Público estimado: do corpo ou somado do evento (adultos + crianças).
  const publico = body.publico != null
    ? Math.max(0, Number(body.publico) || 0)
    : (Number(evento.qtd_adultos) || 0) + (Number(evento.qtd_criancas) || 0)

  // Já existem licenças do evento? Sem `force`, recusa (evita aplicar em cima).
  const { data: existentes } = await admin.from('licencas').select(SEL_LIC)
    .eq('usuario_id', userId).eq('evento_id', evento_id).eq('escopo', 'evento')
  const jaTem = (existentes || []) as { tipo: string }[]
  if (jaTem.length > 0 && body.force !== true) {
    return Response.json({ error: 'checklist_ja_aplicado', data: existentes }, { status: 409 })
  }

  // Aditivo por TIPO: insere só exigências cujo tipo ainda não exista no evento.
  const tiposExistentes = new Set(jaTem.map((l) => l.tipo))
  const validade = ymd(evento.data_inicio) // prazo natural = data do evento
  const novas = gerarLicencasDoEvento(itens, publico)
    .filter((g) => !tiposExistentes.has(g.tipo))
    .map((g) => ({
      usuario_id: userId,
      propriedade_id: evento.propriedade_id ?? null,
      escopo: 'evento',
      evento_id,
      tipo: g.tipo,
      titulo: g.titulo,
      orgao: g.orgao || null,
      validade,
      dias_aviso: g.dias_aviso,
      status: 'em_processo',
      obrigatorio: g.obrigatorio,
      obs: g.obs || null,
    }))

  if (novas.length) {
    const { error } = await admin.from('licencas').insert(novas)
    if (error) return Response.json({ error: error.message }, { status: 500 })
  }

  const { data: todas } = await admin.from('licencas').select(SEL_LIC)
    .eq('usuario_id', userId).eq('evento_id', evento_id).eq('escopo', 'evento')
    .order('obrigatorio', { ascending: false }).order('tipo')
  return Response.json({ data: todas || [], geradas: novas.length })
}

// ── Licença (dono) ───────────────────────────────────────────────────────────
type LicRow = {
  id: string; usuario_id: string; escopo: string; evento_id: string | null
  propriedade_id: number | null; tipo: string; titulo: string | null
  custo_num: number | null; lancamento_id: number | null
}
async function carregarLicenca(id: string, userId: string): Promise<LicRow | null> {
  const { data } = await admin.from('licencas')
    .select('id,usuario_id,escopo,evento_id,propriedade_id,tipo,titulo,custo_num,lancamento_id')
    .eq('id', id).maybeSingle()
  if (!data || data.usuario_id !== userId) return null
  return data as LicRow
}

// ── lancar_custo: custo da licença → despesa no caixa (contábil) ─────────────
async function lancarCusto(userId: string, body: Record<string, unknown>) {
  const id = String(body.licenca_id || body.id || '')
  if (!id) return badRequest('licenca_id é obrigatório')

  const lic = await carregarLicenca(id, userId)
  if (!lic) return forbidden()

  // Idempotente: já lançado → devolve o vínculo atual.
  if (lic.lancamento_id) {
    const { data } = await admin.from('licencas').select(SEL_LIC).eq('id', id).single()
    return Response.json({ data, lancamento_id: lic.lancamento_id, ja_lancado: true })
  }
  const valor = Number(lic.custo_num) || 0
  if (valor <= 0) return badRequest('licença sem custo para lançar')

  // tipo_evento do evento (quando escopo='evento') — para o relatório do caixa.
  let tipoEvento: string | null = null
  let nomeEvento = ''
  if (lic.escopo === 'evento' && lic.evento_id) {
    const { data: ev } = await admin.from('clientes_eventos')
      .select('tipo_evento,nome_evento').eq('id', lic.evento_id).maybeSingle()
    tipoEvento = ev?.tipo_evento ?? null
    nomeEvento = ev?.nome_evento ?? ''
  }

  const nome = lic.titulo || tipoLabel(lic.tipo)
  const descricao = `Licença — ${nome}${nomeEvento ? ` · ${nomeEvento}` : ''}`
  const insert = {
    usuario_id: userId, tipo: 'despesa', categoria: 'Licenças',
    descricao, tipo_evento: tipoEvento, valor, status: 'pago',
    data: hojeYMD(), metodo_pagamento: 'Taxa/DAM', prop_id: lic.propriedade_id ?? null,
  }
  const { data: lanc, error } = await admin.from('lancamentos').insert(insert).select('id').single()
  if (error || !lanc) return Response.json({ error: 'falha ao lançar a despesa no caixa' }, { status: 500 })

  const { data } = await admin.from('licencas').update({ lancamento_id: lanc.id }).eq('id', id).select(SEL_LIC).single()
  return Response.json({ data, lancamento_id: lanc.id, valor })
}

// ── estornar_custo: remove a despesa e desvincula ────────────────────────────
async function estornarCusto(userId: string, body: Record<string, unknown>) {
  const id = String(body.licenca_id || body.id || '')
  if (!id) return badRequest('licenca_id é obrigatório')

  const lic = await carregarLicenca(id, userId)
  if (!lic) return forbidden()
  if (lic.lancamento_id) {
    await admin.from('lancamentos').delete().eq('id', lic.lancamento_id).eq('usuario_id', userId)
  }
  const { data } = await admin.from('licencas').update({ lancamento_id: null }).eq('id', id).select(SEL_LIC).single()
  return Response.json({ data, estornado: true })
}
