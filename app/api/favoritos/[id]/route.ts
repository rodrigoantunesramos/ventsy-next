import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'

// DELETE /api/favoritos/[id] — remover favorito por id do registro
// ou DELETE /api/favoritos/[id]?user_id=xxx — remover por property_id + user_id
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const { searchParams } = new URL(req.url)
  const userId = searchParams.get('user_id')

  if (userId) {
    // Remover por property_id + user_id
    const { error } = await supabase
      .from('favoritos')
      .delete()
      .eq('user_id', userId)
      .eq('property_id', Number(params.id))
    return Response.json({ error })
  }

  // Remover pelo id do registro
  const { error } = await supabase
    .from('favoritos')
    .delete()
    .eq('id', params.id)

  return Response.json({ error })
}
