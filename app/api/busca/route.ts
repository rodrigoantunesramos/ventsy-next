import { createClient } from '@supabase/supabase-js'
import { NextRequest } from 'next/server'

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPA_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q') || ''
  if (!q.trim()) return Response.json({ data: [] })

  // Cria cliente com o token do usuário autenticado, se disponível
  const authHeader = req.headers.get('authorization')
  const supabase = createClient(SUPA_URL, SUPA_ANON, {
    global: authHeader ? { headers: { Authorization: authHeader } } : {},
  })

  // Busca acento-insensível via RPC: casa nome/cidade/bairro ignorando acentos
  // e caixa (antes era ilike só no nome, accent-sensitive).
  const { data, error } = await supabase
    .rpc('buscar_espacos', { termo: q })
    .select('id, nome, cidade, estado, bairro, imagem_url')

  if (error) return Response.json({ data: [] })
  return Response.json({ data: data || [] })
}
