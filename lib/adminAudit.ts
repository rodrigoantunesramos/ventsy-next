import { supabaseAdminAny } from '@/lib/supabaseAdmin'

// Registra uma ação do admin na trilha de auditoria (public.admin_auditoria).
// Best-effort: NUNCA lança nem bloqueia a operação principal — espelha o padrão
// de lib/auditServer do app.
export async function registrarAcaoAdmin(
  ator: { userId: string; email: string | null },
  modulo: string,
  acao: string,
  alvo?: string | null,
  detalhe?: Record<string, unknown>,
): Promise<void> {
  try {
    await supabaseAdminAny.from('admin_auditoria').insert({
      ator_id: ator.userId,
      ator_email: ator.email,
      modulo,
      acao,
      alvo: alvo ?? null,
      detalhe: detalhe ?? null,
    })
  } catch {
    /* auditoria nunca quebra a ação principal */
  }
}
