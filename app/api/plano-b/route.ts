import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getAuthUser, unauthorized, forbidden } from '@/lib/apiAuth'
import {
  parseOpenMeteo, previsaoDisponivel, diaDe, urlOpenMeteo,
  type ClimaResumo,
} from '@/lib/plano-b'

// Busca a PREVISÃO do tempo para a data/local de um evento e cacheia o snapshot.
//   • POST { evento_id } — resolve o local (lat/long da propriedade do evento) e
//     a janela de horário, chama a API de meteorologia (Open-Meteo, sem chave),
//     normaliza a resposta (parseOpenMeteo — puro) e faz upsert em
//     `clima_snapshots` (1 por evento). Degrada com `motivo` quando não dá:
//     sem coordenadas, data fora do horizonte de previsão (~16d) ou falha da API
//     (devolve o último snapshot cacheado se houver).
// A identidade é SEMPRE user.id (service-role ignora RLS). O CRUD de planos e a
// previsão MANUAL são feitos pelo client via RLS. Espelha /api/producao.

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const admin = supabaseAdmin as any

const SEL_EVENTO = 'id,usuario_id,nome_evento,data_inicio,horario_inicio,horario_fim,propriedade_id'
const SEL_PROP = 'id,nome,cidade,estado,latitude,longitude'
const FETCH_TIMEOUT_MS = 9000

function badRequest(msg: string) { return Response.json({ error: msg }, { status: 400 }) }
function hojeYMD(): string { return new Date().toISOString().slice(0, 10) }

type EventoRow = {
  id: string; usuario_id: string; nome_evento: string | null
  data_inicio: string | null; horario_inicio: string | null; horario_fim: string | null
  propriedade_id: number | null
}
type PropRow = { id: number; nome: string | null; cidade: string | null; estado: string | null; latitude: number | null; longitude: number | null }

async function carregarEvento(id: string, userId: string): Promise<EventoRow | null> {
  const { data } = await admin.from('clientes_eventos').select(SEL_EVENTO).eq('id', id).maybeSingle()
  if (!data || data.usuario_id !== userId) return null
  return data as EventoRow
}

/** Busca a previsão (com timeout). Lança em erro de rede/HTTP. */
async function fetchPrevisao(url: string): Promise<unknown> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { Accept: 'application/json' } })
    if (!res.ok) throw new Error(`meteo HTTP ${res.status}`)
    return await res.json()
  } finally {
    clearTimeout(t)
  }
}

async function snapshotCacheado(eventoId: string): Promise<{ previsao: ClimaResumo; capturado_em: string } | null> {
  const { data } = await admin.from('clima_snapshots').select('previsao,capturado_em').eq('evento_id', eventoId).maybeSingle()
  if (!data?.previsao) return null
  return { previsao: data.previsao as ClimaResumo, capturado_em: data.capturado_em }
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return unauthorized()

  const body = await req.json().catch(() => ({}))
  const evento_id = String(body.evento_id || '')
  if (!evento_id) return badRequest('evento_id é obrigatório')

  const evento = await carregarEvento(evento_id, user.id)
  if (!evento) return forbidden()

  const dia = diaDe(evento.data_inicio)
  if (!dia) return Response.json({ data: { resumo: null, motivo: 'sem_data' } })

  // Local: coordenadas da propriedade do evento.
  let prop: PropRow | null = null
  if (evento.propriedade_id != null) {
    // O evento já foi confirmado como do usuário; lemos só as coordenadas da sua propriedade.
    const { data } = await admin.from('propriedades').select(SEL_PROP).eq('id', evento.propriedade_id).maybeSingle()
    prop = (data as PropRow) || null
  }
  const lat = prop?.latitude
  const lon = prop?.longitude
  const local = [prop?.nome, prop?.cidade, prop?.estado].filter(Boolean).join(' · ') || null

  if (lat == null || lon == null) {
    return Response.json({ data: { resumo: null, motivo: 'sem_coordenadas', local, propriedade_id: evento.propriedade_id } })
  }

  // Horizonte: Open-Meteo só prevê ~16 dias à frente.
  if (!previsaoDisponivel(dia, hojeYMD())) {
    const cache = await snapshotCacheado(evento_id)
    return Response.json({ data: { resumo: cache?.previsao || null, motivo: 'fora_do_horizonte', local, dia } })
  }

  // Busca + normaliza + cacheia.
  try {
    const json = await fetchPrevisao(urlOpenMeteo(Number(lat), Number(lon), dia))
    const capturadoEm = new Date().toISOString()
    const resumo = parseOpenMeteo(json, dia, { inicio: evento.horario_inicio, fim: evento.horario_fim }, capturadoEm)

    await admin.from('clima_snapshots').upsert({
      usuario_id: user.id, evento_id, fonte: 'open-meteo',
      latitude: Number(lat), longitude: Number(lon), dia,
      previsao: resumo, capturado_em: capturadoEm,
    }, { onConflict: 'evento_id' })

    return Response.json({ data: { resumo, motivo: null, local, dia } })
  } catch (e) {
    // Falha da API: devolve o último snapshot cacheado, se houver.
    const cache = await snapshotCacheado(evento_id)
    return Response.json({
      data: { resumo: cache?.previsao || null, motivo: 'falha_api', local, dia, detalhe: (e as Error)?.message || null },
    })
  }
}
