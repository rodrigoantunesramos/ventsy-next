import { supabase } from '@/lib/supabase'

export async function GET() {
  const { data, error } = await supabase
    .from('buscas')
    .select('*')

  return Response.json({ data, error })
}