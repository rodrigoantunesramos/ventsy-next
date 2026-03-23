import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'

// GET /api/favoritos?user_id=xxx — lista favoritos do usuário com dados da propriedade
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const userId = searchParams.get('user_id')

  if (!userId) return Response.json({ error: 'user_id obrigatório' }, { status: 400 })

  const { data, error } = await supabase
    .from('favoritos')
    .select('*, propriedade:propriedades(id,nome,cidade,estado,valor_base,valor_hora,avaliacao,foto_capa,imagem_url,tipo_propriedade,capacidade)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  return Response.json({ data, error })
}

// POST /api/favoritos — favoritar propriedade
export async function POST(req: NextRequest) {
  const { user_id, property_id } = await req.json()

  if (!user_id || !property_id) {
    return Response.json({ error: 'user_id e property_id são obrigatórios' }, { status: 400 })
  }

  // Evitar duplicata
  const { data: existing } = await supabase
    .from('favoritos')
    .select('id')
    .eq('user_id', user_id)
    .eq('property_id', property_id)
    .maybeSingle()

  if (existing) return Response.json({ data: existing, error: null })

  const { data, error } = await supabase
    .from('favoritos')
    .insert({ user_id, property_id })
    .select()
    .single()

  return Response.json({ data, error })
}
