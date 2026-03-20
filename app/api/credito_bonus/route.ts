import { supabase } from '@/lib/supabase'

export async function GET() {
  const { data, error } = await supabase
    .from('credito_bonus')
    .select('*')

  return Response.json({ data, error })
}