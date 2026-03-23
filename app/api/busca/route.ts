import { createClient } from '@supabase/supabase-js'
import { NextRequest } from 'next/server'

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://hxvlfalgrduitevbhqvq.supabase.co'
const SUPA_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh4dmxmYWxncmR1aXRldmJocXZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyMDA2MDYsImV4cCI6MjA4ODc3NjYwNn0.AUUY8k1dM3rzanf6qdiqk9kcFztDFFm-SuEv2aoBbQQ'

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q') || ''
  if (!q.trim()) return Response.json({ data: [] })

  // Cria cliente com o token do usuário autenticado, se disponível
  const authHeader = req.headers.get('authorization')
  const supabase = createClient(SUPA_URL, SUPA_ANON, {
    global: authHeader ? { headers: { Authorization: authHeader } } : {},
  })

  const { data, error } = await supabase
    .from('propriedades')
    .select('id, nome, cidade, estado, bairro, imagem_url, foto_capa')
    .eq('publicada', true)
    .ilike('nome', `%${q}%`)
    .limit(8)

  if (error) return Response.json({ data: [] })
  return Response.json({ data: data || [] })
}
