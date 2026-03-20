import { supabase } from '@/lib/supabase'

export async function GET() {
  const { data, error } = await supabase
    .from('pagamentos')
    .select('*')

  return Response.json({ data, error })
}