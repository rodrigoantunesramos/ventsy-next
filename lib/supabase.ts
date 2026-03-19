import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://hxvlfalgrduitevbhqvq.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh4dmxmYWxncmR1aXRldmJocXZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyMDA2MDYsImV4cCI6MjA4ODc3NjYwNn0.AUUY8k1dM3rzanf6qdiqk9kcFztDFFm-SuEv2aoBbQQ'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
