import { supabase } from '@/lib/supabase'

export async function GET() {
  const { data, error } = await supabase
    .from('planos_config')
    .select('*')

  return Response.json({ data, error })
}