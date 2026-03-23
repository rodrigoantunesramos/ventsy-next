import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'

// GET /api/conversas?user_id=xxx — conversas do cliente
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const userId = searchParams.get('user_id')

  if (!userId) return Response.json({ error: 'user_id obrigatório' }, { status: 400 })

  const { data, error } = await supabase
    .from('conversas')
    .select('*, propriedade:propriedades(id,nome,cidade,estado,foto_capa,imagem_url)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  return Response.json({ data, error })
}

// POST /api/conversas — iniciar ou obter conversa existente
export async function POST(req: NextRequest) {
  const { user_id, owner_id, propriedade_id } = await req.json()

  if (!user_id || !owner_id || !propriedade_id) {
    return Response.json(
      { error: 'user_id, owner_id e propriedade_id são obrigatórios' },
      { status: 400 },
    )
  }

  // Verificar se já existe
  const { data: existing } = await supabase
    .from('conversas')
    .select('*')
    .eq('user_id', user_id)
    .eq('propriedade_id', propriedade_id)
    .maybeSingle()

  if (existing) return Response.json({ data: existing, error: null })

  const { data, error } = await supabase
    .from('conversas')
    .insert({ user_id, owner_id, propriedade_id })
    .select()
    .single()

  return Response.json({ data, error })
}
