import { supabase } from '@/lib/supabase'

export async function GET() {
  const { data, error } = await supabase
    .from('cupons')
    .select('*')

  return Response.json({ data, error })
}