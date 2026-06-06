import { NextRequest } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin'
import { getAuthUser, unauthorized } from '@/lib/apiAuth'

// GET /api/conversas — conversas do usuário autenticado
export async function GET(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return unauthorized()

  const { data, error } = await supabase
    .from('conversas')
    .select('*, propriedade:propriedades(id,nome,cidade,estado,foto_capa,imagem_url)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  return Response.json({ data, error })
}

// POST /api/conversas — iniciar ou obter conversa para o usuário autenticado.
// owner_id é derivado da propriedade no servidor — nunca confiado do cliente.
export async function POST(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return unauthorized()

  const { propriedade_id } = await req.json()

  if (!propriedade_id) {
    return Response.json({ error: 'propriedade_id é obrigatório' }, { status: 400 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: prop } = await (supabase as any)
    .from('propriedades')
    .select('usuario_id')
    .eq('id', propriedade_id)
    .maybeSingle()

  if (!prop) {
    return Response.json({ error: 'Propriedade não encontrada' }, { status: 404 })
  }

  // Verificar se já existe
  const { data: existing } = await supabase
    .from('conversas')
    .select('*')
    .eq('user_id', user.id)
    .eq('propriedade_id', propriedade_id)
    .maybeSingle()

  if (existing) return Response.json({ data: existing, error: null })

  const { data, error } = await supabase
    .from('conversas')
    .insert({ user_id: user.id, owner_id: prop.usuario_id, propriedade_id })
    .select()
    .single()

  return Response.json({ data, error })
}
