import { supabase } from '@/lib/supabase'

export async function GET() {
  const { data, error } = await supabase
    .from('cadastros_imcompletos')
    .select('*')

  return Response.json({ data, error })
}