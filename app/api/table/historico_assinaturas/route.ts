import { supabase } from '@/lib/supabase'

export async function GET() {
  const { data, error } = await supabase
    .from('historico_assinaturas')
    .select('*')

  return Response.json({ data, error })
}