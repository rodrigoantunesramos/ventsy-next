import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'

// GET /api/conversas/[id] — mensagens de uma conversa
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const { data: conversa, error: cErr } = await supabase
    .from('conversas')
    .select('*, propriedade:propriedades(id,nome,cidade,estado,foto_capa,imagem_url)')
    .eq('id', params.id)
    .single()

  if (cErr || !conversa) {
    return Response.json({ error: 'Conversa não encontrada' }, { status: 404 })
  }

  const { data: mensagens, error: mErr } = await supabase
    .from('mensagens')
    .select('*')
    .eq('conversation_id', params.id)
    .order('created_at', { ascending: true })

  return Response.json({ data: { conversa, mensagens: mensagens || [] }, error: mErr })
}
