import { supabase } from '@/lib/supabase'

export async function GET() {
  const { data, error } = await supabase
    .from('planos_anunciantes')
    .select('*')

  return Response.json({ data, error })
}