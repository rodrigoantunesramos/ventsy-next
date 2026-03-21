import { supabase } from '@/lib/supabase'

export async function GET() {
  const { data, error } = await supabase
    .from('comodidades')
    .select('*')

  return Response.json({ data, error })
}