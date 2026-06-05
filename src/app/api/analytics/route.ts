import { supabase } from '@/lib/supabase'

export async function POST(req: Request) {
  const body = await req.json()

  const { error } = await supabase.from('analytics_events').insert({
    property_id: body.propertyId,
    event_type: body.type,
    source: body.source,
    city: body.city,
    niche: body.niche,
  })

  if (error) {
    return Response.json({ error }, { status: 500 })
  }

  return Response.json({ ok: true })
}