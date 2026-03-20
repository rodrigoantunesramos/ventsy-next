import { supabase } from '@/lib/supabase'

export async function GET() {
  const { data, error } = await supabase
    .from('buscas_log')
    .select('*')

  return Response.json({ data, error })
}