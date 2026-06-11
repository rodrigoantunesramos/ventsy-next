import { supabaseRest as supabase } from '@/lib/supabaseServer'

export async function GET() {
  const { data, error } = await supabase
    .from('cadastros_incompletos')
    .select('*')

  return Response.json({ data, error })
}