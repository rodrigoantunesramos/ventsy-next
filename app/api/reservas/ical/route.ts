import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getAuthUser, unauthorized, forbidden } from '@/lib/apiAuth'
import { buildICS, ocupaSlot, toRange, statusMeta, type Reserva, type ICSEvent, DIA } from '@/lib/reservas'

// Feed iCal (.ics) por propriedade — para assinar no Google Calendar / Apple
// Calendar e evitar overbooking com canais externos.
//
//   GET /api/reservas/ical?prop=<id>&token=<uuid>  → text/calendar (público; o
//                                                     token é o segredo do feed)
//   GET /api/reservas/ical?prop=<id>   (com Bearer) → { url } p/ copiar/assinar
//
// O token estável vive em propriedades.ical_token (ver migration). Sem token a
// rota exige autenticação e só devolve a URL assinada da própria propriedade.

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const admin = supabaseAdmin as any

// Janela do feed: passado recente (histórico curto) + ~2 anos à frente.
const JANELA_PASSADO = 90 * DIA
const JANELA_FUTURO = 730 * DIA

const SELECT = 'id,propriedade_id,espaco_id,titulo,status,inicio,fim,hold_expira_em,data_inicio,data_fim,modo,horas,nome,tipo_evento'

function feedUrl(origin: string, prop: number, token: string): string {
  return `${origin}/api/reservas/ical?prop=${prop}&token=${token}`
}

export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url)
  const prop = Number(searchParams.get('prop'))
  const token = searchParams.get('token')
  if (!prop) return Response.json({ error: 'prop é obrigatório' }, { status: 400 })

  const base = process.env.NEXT_PUBLIC_SITE_URL || origin

  const { data: propriedade } = await admin
    .from('propriedades')
    .select('id,nome,cidade,estado,usuario_id,ical_token')
    .eq('id', prop)
    .maybeSingle()
  if (!propriedade) return Response.json({ error: 'propriedade não encontrada' }, { status: 404 })

  // Sem token → exige auth e devolve a URL assinada (para "copiar feed").
  if (!token) {
    const user = await getAuthUser(req)
    if (!user) return unauthorized()
    if (propriedade.usuario_id !== user.id) return forbidden()
    if (!propriedade.ical_token) {
      return Response.json({ error: 'token do feed indisponível — rode a migration docs/sql/reservas-multiespaco.sql' }, { status: 409 })
    }
    return Response.json({ url: feedUrl(base, prop, propriedade.ical_token) })
  }

  // Com token → valida e serve o calendário (sem necessidade de Bearer).
  if (!propriedade.ical_token || token !== propriedade.ical_token) return forbidden()

  const nowMs = Date.now()
  const desde = new Date(nowMs - JANELA_PASSADO).toISOString()

  const [{ data: reservas }, { data: espacos }] = await Promise.all([
    admin.from('reservas').select(SELECT).eq('propriedade_id', prop).or(`inicio.gte.${desde},data_inicio.gte.${desde.slice(0, 10)}`),
    admin.from('espacos').select('id,nome').eq('propriedade_id', prop),
  ])

  const nomeEspaco = new Map<number, string>()
  ;(espacos || []).forEach((e: { id: number; nome: string }) => nomeEspaco.set(Number(e.id), e.nome))
  const localBase = [propriedade.nome, propriedade.cidade, propriedade.estado].filter(Boolean).join(', ')

  const limiteFuturo = nowMs + JANELA_FUTURO
  const eventos: ICSEvent[] = []
  for (const r of (reservas || []) as Reserva[]) {
    if (!ocupaSlot(r, nowMs)) continue
    const range = toRange(r)
    if (!range || range.start > limiteFuturo) continue
    const espNome = r.espaco_id != null ? nomeEspaco.get(Number(r.espaco_id)) : null
    const titulo = r.titulo || r.nome || r.tipo_evento || statusMeta(r.status).label
    eventos.push({
      uid: `reserva-${r.id}@ventsy`,
      start: new Date(range.start),
      end: new Date(range.end),
      summary: espNome ? `${titulo} · ${espNome}` : titulo,
      description: [statusMeta(r.status).label, r.tipo_evento].filter(Boolean).join(' — '),
      location: espNome ? `${espNome} — ${localBase}` : localBase,
      status: r.status,
    })
  }

  const ics = buildICS({ calName: `Ventsy · ${propriedade.nome || 'Agenda'}`, eventos, dtstamp: new Date() })

  return new Response(ics, {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `inline; filename="ventsy-${prop}.ics"`,
      'Cache-Control': 'public, max-age=300',
    },
  })
}
