import { supabase } from '@/lib/supabase/supabase'

export async function getAnalytics() {
  const { data, error } = await supabase
    .from('analytics_events')
    .select('*')

  if (error) throw error

  return data
}