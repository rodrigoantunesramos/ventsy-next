import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'

// POST /api/mensagens — enviar mensagem
export async function POST(req: NextRequest) {
  const { conversation_id, sender_id, text } = await req.json()

  if (!conversation_id || !sender_id || !text?.trim()) {
    return Response.json(
      { error: 'conversation_id, sender_id e text são obrigatórios' },
      { status: 400 },
    )
  }

  const { data, error } = await supabase
    .from('mensagens')
    .insert({ conversation_id, sender_id, text: text.trim() })
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
