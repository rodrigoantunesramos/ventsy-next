import type { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/adminAuth'
import { forbidden } from '@/lib/apiAuth'
import { supabaseAdminAny } from '@/lib/supabaseAdmin'

// Leitura da trilha de auditoria do admin (somente leitura; a tabela é
// append-only e só acessível via service-role).
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const ctx = await requireAdmin(req, 'auditoria', 'ver')
  if (!ctx) return forbidden()

  const modulo = new URL(req.url).searchParams.get('modulo') || ''
  let q = supabaseAdminAny
    .from('admin_auditoria')
    .select('id, ator_email, modulo, acao, alvo, criado_em')
    .order('criado_em', { ascending: false })
    .limit(200)
  if (modulo) q = q.eq('modulo', modulo)

  const { data } = await q
  return Response.json({ registros: data ?? [] })
}
