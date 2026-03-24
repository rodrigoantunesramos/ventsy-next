import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey)

// Untyped client for tables not yet in the generated schema (pending migrations).
// Replace usages with typed equivalents after the corresponding migration is applied.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const supabaseAny = supabase as any
