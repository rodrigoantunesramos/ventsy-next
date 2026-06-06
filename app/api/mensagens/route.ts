import { NextRequest } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin'
import { getAuthUser, unauthorized, forbidden } from '@/lib/apiAuth'

// POST /api/mensagens — enviar mensagem (somente participante da conversa).
// O remetente é SEMPRE o usuário autenticado — sender_id do cliente é ignorado.
export async function POST(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return unauthorized()

  const { conversation_id, text } = await req.json()

  if (!conversation_id || !text?.trim()) {
    return Response.json(
      { error: 'conversation_id e text são obrigatórios' },
      { status: 400 },
    )
  }

  // Verificar que o autor é participante da conversa
  const { data: conversa } = await supabase
    .from('conversas')
    .select('user_id, owner_id')
    .eq('id', conversation_id)
    .maybeSingle()

  if (!conversa) {
    return Response.json({ error: 'Conversa não encontrada' }, { status: 404 })
  }
  if (conversa.user_id !== user.id && conversa.owner_id !== user.id) {
    return forbidden()
  }

  const { data, error } = await supabase
    .from('mensagens')
    .insert({ conversation_id, sender_id: user.id, text: text.trim() })
    .select()
    .single()

  if (!error) {
    // Atualizar última mensagem na conversa
    await supabase
      .from('conversas')
      .update({
        ultima_mensagem:    text.trim().slice(0, 100),
        ultima_mensagem_em: new Date().toISOString(),
      })
      .eq('id', conversation_id)
  }

  return Response.json({ data, error })
}
