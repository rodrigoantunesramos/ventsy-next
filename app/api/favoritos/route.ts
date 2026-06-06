import { NextRequest } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin'
import { getAuthUser, unauthorized } from '@/lib/apiAuth'

// GET /api/favoritos — favoritos do usuário autenticado (com dados da propriedade)
export async function GET(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return unauthorized()

  const { data, error } = await supabase
    .from('favoritos')
    .select('*, propriedade:propriedades(id,nome,cidade,estado,valor_base,valor_hora,avaliacao,foto_capa,imagem_url,tipo_propriedade,capacidade)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  return Response.json({ data, error })
}

// POST /api/favoritos — favoritar propriedade para o usuário autenticado
export async function POST(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return unauthorized()

  const { property_id } = await req.json()

  if (!property_id) {
    return Response.json({ error: 'property_id é obrigatório' }, { status: 400 })
  }

  // Evitar duplicata
  const { data: existing } = await supabase
    .from('favoritos')
    .select('id')
    .eq('user_id', user.id)
    .eq('property_id', property_id)
    .maybeSingle()

  if (existing) return Response.json({ data: existing, error: null })

  const { data, error } = await supabase
    .from('favoritos')
    .insert({ user_id: user.id, property_id })
    .select()
    .single()

  return Response.json({ data, error })
}
