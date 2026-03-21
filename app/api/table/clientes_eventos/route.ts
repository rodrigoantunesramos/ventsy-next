import { supabase } from '@/lib/supabase'

export async function GET() {
  const { data, error } = await supabase
    .from('clientes_eventos')
    .select('*')

  return Response.json({ data, error })
}