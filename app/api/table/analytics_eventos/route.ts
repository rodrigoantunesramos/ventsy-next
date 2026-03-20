import { supabase } from '@/lib/supabase'

export async function GET() {
  const { data, error } = await supabase
    .from('analytics_eventos')
    .select('*')

  return Response.json({ data, error })
}