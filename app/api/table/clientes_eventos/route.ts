import { supabaseRest as supabase } from '@/lib/supabaseServer'

export async function GET() {
  const { data, error } = await supabase
    .from('clientes_eventos')
    .select('*')

  return Response.json({ data, error })
}