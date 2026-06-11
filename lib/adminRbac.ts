// RBAC do painel do ADMIN — LÓGICA PURA (sem imports server). Pode ser usada
// tanto no client (sidebar/gate visual) quanto no server (requireAdmin), por
// isso NÃO importa supabaseAdmin nem nada server-only.
//   super_admin → acesso total (inclui gerir acessos da equipe).
//   staff       → permissões granulares por módulo (nenhum<leitura<edicao<total).

export type AdminPapel = 'super_admin' | 'staff'
export type AdminNivel = 'nenhum' | 'leitura' | 'edicao' | 'total'
export type AdminAcao = 'ver' | 'criar' | 'editar' | 'excluir' | 'exportar'
export type AdminPermissoes = Partial<Record<string, AdminNivel>>

export type AdminMembro = {
  usuario_id: string
  papel: AdminPapel
  permissoes: AdminPermissoes
  ativo: boolean
}

// Módulos do painel do admin. `pronto` marca os já migrados para o novo shell
// (os demais aparecem como "em breve" na navegação durante a reescrita).
// `acessos` é exclusivo do super_admin (gestão da equipe).
export const ADMIN_MODULOS: { key: string; label: string; pronto?: boolean }[] = [
  { key: 'dashboard', label: 'Dashboard', pronto: true },
  { key: 'usuarios', label: 'Usuários & Contas', pronto: true },
  { key: 'propriedades', label: 'Propriedades & Aprovação', pronto: true },
  { key: 'financeiro', label: 'Assinaturas & Financeiro', pronto: true },
  { key: 'planos', label: 'Planos, Preços & Comissões' },
  { key: 'cupons', label: 'Cupons & Créditos', pronto: true },
  { key: 'comunicacao', label: 'Comunicação' },
  { key: 'moderacao', label: 'Conteúdo & Moderação' },
  { key: 'auditoria', label: 'Auditoria & Logs' },
  { key: 'config', label: 'Configurações & Flags' },
  { key: 'saude', label: 'Saúde do Sistema' },
  { key: 'acessos', label: 'Acessos da Equipe', pronto: true },
]

const NIVEL_ORDEM: Record<AdminNivel, number> = { nenhum: 0, leitura: 1, edicao: 2, total: 3 }
const ACAO_NIVEL: Record<AdminAcao, number> = { ver: 1, criar: 2, editar: 2, exportar: 2, excluir: 3 }

// Pode o membro executar a ação no módulo? super_admin → sempre; 'acessos' →
// só super_admin; staff → nível do módulo ≥ nível exigido pela ação.
export function adminPode(membro: AdminMembro, modulo: string, acao: AdminAcao = 'ver'): boolean {
  if (membro.papel === 'super_admin') return true
  if (modulo === 'acessos') return false
  const nivel = membro.permissoes?.[modulo] ?? 'nenhum'
  return NIVEL_ORDEM[nivel] >= ACAO_NIVEL[acao]
}
