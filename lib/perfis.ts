// Detecção de perfil do usuário.
//
// O Ventsy não tem um campo `role` em auth.users: um usuário é PROPRIETÁRIO
// (anunciante) quando possui ao menos uma linha em `propriedades`, e é
// CLIENTE quando usa a área /client (favoritos, eventos, conversas…). Uma
// mesma pessoa pode ser as duas coisas — daí a necessidade de trocar de painel.

import { supabase } from '@/lib/supabase'

/**
 * Retorna true se o usuário possui ao menos uma propriedade cadastrada
 * (ou seja, é proprietário/anunciante). Falha-fechado: em caso de erro,
 * assume que não é proprietário.
 *
 * Usa `select('id').limit(1)` em vez de `head:true` de propósito — HEAD sem
 * corpo mascara erros legíveis do PostgREST.
 */
export async function usuarioTemPropriedade(userId: string): Promise<boolean> {
  try {
    const { data } = await supabase
      .from('propriedades')
      .select('id')
      .eq('usuario_id', userId)
      .limit(1)
    return Array.isArray(data) && data.length > 0
  } catch {
    return false
  }
}
