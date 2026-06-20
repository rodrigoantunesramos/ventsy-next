import { NextRequest } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin'
import { getAuthUser, unauthorized, forbidden } from '@/lib/apiAuth'

// GET /api/conversas/[id] — mensagens de uma conversa (somente participantes)
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const user = await getAuthUser(req)
  if (!user) return unauthorized()

  const { data: conversa, error: cErr } = await supabase
    .from('conversas')
    .select('*, propriedade:propriedades(id,nome,cidade,estado,imagem_url)')
    .eq('id', params.id)
    .single()

  if (cErr || !conversa) {
    return Response.json({ error: 'Conversa não encontrada' }, { status: 404 })
  }

  // Autorização: apenas o hóspede (user_id) ou o anfitrião (owner_id) da conversa
  if (conversa.user_id !== user.id && conversa.owner_id !== user.id) {
    return forbidden()
  }

  const { data: mensagens, error: mErr } = await supabase
    .from('mensagens')
    .select('*')
    .eq('conversation_id', params.id)
    .order('created_at', { ascending: true })

  // Papel do usuário + nome do outro lado (cabeçalho do inbox, p/ ambos os lados).
  const papel = conversa.owner_id === user.id ? 'dono' : 'cliente'
  const outroId = papel === 'dono' ? conversa.user_id : conversa.owner_id
  let contraparte: { id: string; nome: string | null } | null = null
  if (outroId) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: u } = await (supabase as any).from('usuarios').select('id, nome').eq('id', outroId).maybeSingle()
    contraparte = { id: outroId, nome: u?.nome ?? null }
  }

  return Response.json({
    data: { conversa: { ...conversa, papel, contraparte }, mensagens: mensagens || [] },
    error: mErr,
  })
}
