import { supabase } from '@/lib/supabase'

export async function GET() {
  const { data, error } = await supabase
    .from('creditos_bonus')
    .select('*')

  return Response.json({ data, error })
}