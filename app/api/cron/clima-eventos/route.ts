import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { parseOpenMeteo, previsaoDisponivel, diaDe, urlOpenMeteo } from '@/lib/plano-b'

// Atualiza diariamente a PREVISÃO dos próximos eventos que já têm um plano de
// contingência (ver vercel.json). Assim o semáforo de risco (verde/amarelo/
// vermelho) do /painel/plano-b fica fresco sem depender de quem abrir a página.
//
// Para cada evento com `plano_contingencia`, data dentro do horizonte (~16 dias)
// e propriedade com lat/long, busca o Open-Meteo e faz upsert em
// `clima_snapshots`. Idempotente e limitado (LIMITE). Não toca em previsões
// MANUAIS. Segurança: exige CRON_SECRET (Bearer ou ?secret=). Simulação: ?dry=1.

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const admin = supabaseAdmin as any

const LIMITE = 80
const FETCH_TIMEOUT_MS = 9000

function autorizado(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const bearer = (req.headers.get('authorization') || '').replace('Bearer ', '').trim()
  const qs = new URL(req.url).searchParams.get('secret') || ''
  return bearer === secret || qs === secret
}

async function fetchJson(url: string): Promise<unknown> {
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

export async function GET(req: NextRequest) {
  if (!autorizado(req)) return Response.json({ error: 'não autorizado' }, { status: 401 })
  const dry = new URL(req.url).searchParams.get('dry') === '1'
  const hoje = new Date().toISOString().slice(0, 10)
  const limite = addDias(hoje, 16)

  // Sonda: módulo ativado?
  const probe = await admin.from('plano_contingencia').select('evento_id').limit(1)
  if (probe.error?.code === 'PGRST205' || probe.error?.code === '42P01') {
    return Response.json({ skipped: 'plano_contingencia ausente' })
  }

  // Eventos distintos que têm plano e estão dentro do horizonte.
  const planos = await admin.from('plano_contingencia').select('usuario_id,evento_id')
  const eventoIds = Array.from(new Set((planos.data || []).map((p: { evento_id: string }) => p.evento_id)))
  if (!eventoIds.length) return Response.json({ hoje, eventos: 0, atualizados: 0 })

  const evRes = await admin.from('clientes_eventos')
    .select('id,usuario_id,data_inicio,horario_inicio,horario_fim,propriedade_id')
    .in('id', eventoIds)
    .gte('data_inicio', hoje)
    .lte('data_inicio', limite)
    .limit(LIMITE)
  const eventos = (evRes.data || []) as Array<{
    id: string; usuario_id: string; data_inicio: string | null
    horario_inicio: string | null; horario_fim: string | null; propriedade_id: number | null
  }>

  if (dry) {
    return Response.json({ dry: true, hoje, limite, candidatos: eventos.length })
  }

  let atualizados = 0
  let semCoord = 0
  let falhas = 0
  for (const ev of eventos) {
    const dia = diaDe(ev.data_inicio)
    if (!dia || !previsaoDisponivel(dia, hoje)) continue
    if (ev.propriedade_id == null) { semCoord++; continue }
    const prop = await admin.from('propriedades').select('latitude,longitude').eq('id', ev.propriedade_id).maybeSingle()
    const lat = prop.data?.latitude
    const lon = prop.data?.longitude
    if (lat == null || lon == null) { semCoord++; continue }
    try {
      const json = await fetchJson(urlOpenMeteo(Number(lat), Number(lon), dia))
      const capturadoEm = new Date().toISOString()
      const resumo = parseOpenMeteo(json, dia, { inicio: ev.horario_inicio, fim: ev.horario_fim }, capturadoEm)
      await admin.from('clima_snapshots').upsert({
        usuario_id: ev.usuario_id, evento_id: ev.id, fonte: 'open-meteo',
        latitude: Number(lat), longitude: Number(lon), dia,
        previsao: resumo, capturado_em: capturadoEm,
      }, { onConflict: 'evento_id' })
      atualizados++
    } catch {
      falhas++
    }
  }

  return Response.json({ hoje, limite, candidatos: eventos.length, atualizados, sem_coordenadas: semCoord, falhas })
}

/** 'YYYY-MM-DD' + n dias (local, sem off-by-one). */
function addDias(ymd: string, n: number): string {
  const d = new Date(`${ymd}T12:00:00`)
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}
