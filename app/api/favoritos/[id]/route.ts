import { NextRequest } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin'
import { getAuthUser, unauthorized } from '@/lib/apiAuth'

// DELETE /api/favoritos/[id] — remove um favorito DO usuário autenticado.
// [id] = property_id (padrão) ou id do registro quando ?by=record.
// Toda remoção é escopada ao usuário autenticado (não confia em user_id do cliente).
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const user = await getAuthUser(req)
  if (!user) return unauthorized()

  const { searchParams } = new URL(req.url)

  if (searchParams.get('by') === 'record') {
    const { error } = await supabase
      .from('favoritos')
      .delete()
      .eq('id', params.id)
      .eq('user_id', user.id)
    return Response.json({ error })
  }

  const { error } = await supabase
    .from('favoritos')
    .delete()
    .eq('user_id', user.id)
    .eq('property_id', Number(params.id))

  return Response.json({ error })
}
