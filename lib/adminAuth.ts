import type { NextRequest } from 'next/server'
import { getAuthUser } from '@/lib/apiAuth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import {
  adminPode,
  type AdminAcao,
  type AdminMembro,
  type AdminPapel,
  type AdminPermissoes,
} from '@/lib/adminRbac'

// Re-exporta a lógica pura de RBAC (tipos, ADMIN_MODULOS, adminPode) para quem
// importa daqui. SERVER-ONLY (usa supabaseAdmin): não importar em client.
export * from '@/lib/adminRbac'

// Lê o membro de admin (ativo) por id via service-role. null se não for admin.
export async function getAdminMembro(userId: string): Promise<AdminMembro | null> {
  const { data, error } = await supabaseAdmin
    .from('admin_membros')
    .select('usuario_id, papel, permissoes, ativo')
    .eq('usuario_id', userId)
    .maybeSingle()
  if (error || !data || data.ativo !== true) return null
  return {
    usuario_id: data.usuario_id,
    papel: data.papel as AdminPapel,
    permissoes: (data.permissoes ?? {}) as AdminPermissoes,
    ativo: data.ativo,
  }
}

// Resolve o usuário da requisição e exige que seja admin autorizado no módulo.
// Retorna { userId, email, membro } ou null (a rota deve responder forbidden()).
export async function requireAdmin(
  req: NextRequest,
  modulo?: string,
  acao: AdminAcao = 'ver',
): Promise<{ userId: string; email: string | null; membro: AdminMembro } | null> {
  const user = await getAuthUser(req)
  if (!user) return null
  const membro = await getAdminMembro(user.id)
  if (!membro) return null
  if (modulo && !adminPode(membro, modulo, acao)) return null
  return { userId: user.id, email: user.email ?? null, membro }
}
