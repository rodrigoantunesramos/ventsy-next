import { supabaseRest as supabase } from '@/lib/supabaseServer'

export async function GET() {
  const { data, error } = await supabase
    .from('analytics_restaurante')
    .select('*')

  return Response.json({ data, error })
}