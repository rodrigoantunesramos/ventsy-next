import { supabaseRest as supabase } from '@/lib/supabaseServer'

export async function GET() {
  const { data, error } = await supabase
    .from('pagamentos')
    .select('*')

  return Response.json({ data, error })
}