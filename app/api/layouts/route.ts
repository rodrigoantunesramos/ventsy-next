import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getAuthUser, unauthorized, forbidden } from '@/lib/apiAuth'
import {
  mesclarPlanta, mesclarMapa, mesasDaPlanta, lugaresDaPlanta,
  distribuirConvidados, convidadosAnonimos, isMissingTable,
} from '@/lib/layouts'

// Operações AUTORITATIVAS de Layouts, Plantas & Capacidade:
//   • POST { action:'aplicar' }   — get-or-create do `evento_layout` (1:1 com o
//       evento, race-safe via UNIQUE(evento_id)); valida posse do evento e do
//       layout; ao trocar de layout, reseta o mapa de mesas; pode auto-distribuir
//       os convidados do evento nas mesas (auto_distribuir).
//   • POST { action:'publicar_capacidade' } — publica a capacidade do layout na
//       zona `geral` (perímetro) do evento em `acesso_zonas`, fazendo a
//       capacidade por arranjo "conversar" com a lotação do /painel/acesso.
//       Degrada (200, publicado:false) se o módulo Acesso ainda não foi ativado.
// O CRUD de layouts e a edição do mapa de mesas são feitos pelo client via RLS.
// Espelha /api/producao (service-role + getAuthUser).

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const admin = supabaseAdmin as any

const SEL_EVL = 'id,usuario_id,evento_id,layout_id,mapa_mesas,ajustes,criado_em,atualizado_em'
const SEL_LAYOUT = 'id,usuario_id,propriedade_id,espaco_id,nome,tipo_setup,capacidade,area_m2,elementos'
const SEL_EVENTO = 'id,usuario_id,nome_evento,tipo_evento,data_inicio,qtd_adultos,qtd_criancas'

function badRequest(msg: string) { return Response.json({ error: msg }, { status: 400 }) }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function carregarEvento(id: string, userId: string): Promise<any | null> {
  const { data } = await admin.from('clientes_eventos').select(SEL_EVENTO).eq('id', id).maybeSingle()
  if (!data || data.usuario_id !== userId) return null
  return data
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function carregarLayout(id: string, userId: string): Promise<any | null> {
  const { data } = await admin.from('layouts').select(SEL_LAYOUT).eq('id', id).maybeSingle()
  if (!data || data.usuario_id !== userId) return null
  return data
}
async function selectEventoLayout(evento_id: string, userId: string) {
  const { data } = await admin.from('evento_layout').select(SEL_EVL)
    .eq('evento_id', evento_id).eq('usuario_id', userId).maybeSingle()
  return data || null
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return unauthorized()

  const body = await req.json().catch(() => ({}))
  const action = String(body.action || 'aplicar')

  if (action === 'aplicar') return aplicar(user.id, body)
  if (action === 'publicar_capacidade') return publicarCapacidade(user.id, body)
  return badRequest('ação inválida')
}

// ── Aplicar um layout ao evento (get-or-create + opcional auto-distribuir) ────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function aplicar(userId: string, body: any) {
  const evento_id = String(body.evento_id || '')
  const layout_id = body.layout_id ? String(body.layout_id) : null
  if (!evento_id) return badRequest('evento_id é obrigatório')

  const evento = await carregarEvento(evento_id, userId)
  if (!evento) return forbidden()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let layout: any = null
  if (layout_id) {
    layout = await carregarLayout(layout_id, userId)
    if (!layout) return forbidden()
  }

  // Mapa semeado a partir do layout escolhido (vazio ou auto-distribuído).
  const semearMapa = () => {
    if (!layout) return { mesas: {}, naoAlocados: [] }
    const itens = mesclarPlanta(layout.elementos).itens
    const mesas = mesasDaPlanta(itens)
    if (body.auto_distribuir && mesas.length) {
      const total = (Number(evento.qtd_adultos) || 0) + (Number(evento.qtd_criancas) || 0)
      return distribuirConvidados(itens, convidadosAnonimos(total))
    }
    return { mesas: {}, naoAlocados: [] }
  }

  let evl = await selectEventoLayout(evento_id, userId)
  if (!evl) {
    const ins = await admin.from('evento_layout')
      .insert({ usuario_id: userId, evento_id, layout_id, mapa_mesas: semearMapa() })
      .select(SEL_EVL).single()
    if (ins.error) {
      if (ins.error.code === '23505') evl = await selectEventoLayout(evento_id, userId) // race
      else if (isMissingTable(ins.error)) return Response.json({ error: ins.error.message }, { status: 500 })
      else return Response.json({ error: ins.error.message }, { status: 500 })
    } else {
      evl = ins.data
    }
  }
  if (!evl) return Response.json({ error: 'falha ao aplicar layout' }, { status: 500 })

  // Já existia: trocar de layout reseta o mapa (as mesas mudaram); auto_distribuir força re-semear.
  const trocouLayout = (evl.layout_id || null) !== layout_id
  if (trocouLayout || body.auto_distribuir) {
    const upd = await admin.from('evento_layout')
      .update({ layout_id, mapa_mesas: semearMapa() }).eq('id', evl.id).select(SEL_EVL).single()
    if (!upd.error && upd.data) evl = upd.data
  }

  return Response.json({ data: evl })
}

// ── Publicar a capacidade do layout na zona `geral` do Acesso ────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function publicarCapacidade(userId: string, body: any) {
  const evento_id = String(body.evento_id || '')
  const layout_id = String(body.layout_id || '')
  if (!evento_id || !layout_id) return badRequest('evento_id e layout_id são obrigatórios')

  const evento = await carregarEvento(evento_id, userId)
  if (!evento) return forbidden()
  const layout = await carregarLayout(layout_id, userId)
  if (!layout) return forbidden()

  const capacidade = Math.max(
    0,
    layout.capacidade != null ? Math.round(Number(layout.capacidade) || 0)
                              : lugaresDaPlanta(mesclarPlanta(layout.elementos)),
  )

  // Upsert da zona `geral` (perímetro) do evento. Degrada se Acesso não está ativo.
  const existente = await admin.from('acesso_zonas').select('id')
    .eq('usuario_id', userId).eq('evento_id', evento_id).eq('codigo', 'geral').maybeSingle()
  if (existente.error && isMissingTable(existente.error)) {
    return Response.json({ publicado: false, motivo: 'acesso_inativo' })
  }

  if (existente.data?.id) {
    const upd = await admin.from('acesso_zonas')
      .update({ capacidade, nome: 'Perímetro (lotação total)' }).eq('id', existente.data.id)
    if (upd.error) return Response.json({ error: upd.error.message }, { status: 500 })
  } else {
    const ins = await admin.from('acesso_zonas').insert({
      usuario_id: userId, evento_id, codigo: 'geral',
      nome: 'Perímetro (lotação total)', capacidade, ordem: 0, ativo: true,
    })
    if (ins.error) {
      if (isMissingTable(ins.error)) return Response.json({ publicado: false, motivo: 'acesso_inativo' })
      return Response.json({ error: ins.error.message }, { status: 500 })
    }
  }
  return Response.json({ publicado: true, capacidade })
}
