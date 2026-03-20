import { supabase } from '@/lib/supabase'

export async function GET() {
  const { data, error } = await supabase
    .from('financeiro_restaurante')
    .select('*')

  return Response.json({ data, error })
}