// RBAC — papéis e permissões por módulo do painel.
// Modelo único reutilizado pela UI de Configurações (Equipe & Permissões), pelo
// gate no client e pela checagem nas rotas de API. Níveis cumulativos:
//   nenhum (0) < leitura (1) < edicao (2) < total (3)
// `permissoes` de um membro é um override por módulo; sem override, vale o
// default do papel. O DONO da conta (usuario_id === sessão) tem acesso total.

export type Papel = 'admin' | 'financeiro' | 'comercial' | 'operacional' | 'rh' | 'recepcao' | 'leitura'
export type Nivel = 'nenhum' | 'leitura' | 'edicao' | 'total'
export type Acao = 'ver' | 'criar' | 'editar' | 'excluir' | 'exportar'
export type Permissoes = Partial<Record<string, Nivel>>

export const NIVEIS: { v: Nivel; label: string }[] = [
  { v: 'nenhum', label: 'Sem acesso' },
  { v: 'leitura', label: 'Visualizar' },
  { v: 'edicao', label: 'Editar' },
  { v: 'total', label: 'Total' },
]

const NIVEL_ORDEM: Record<Nivel, number> = { nenhum: 0, leitura: 1, edicao: 2, total: 3 }
const ACAO_NIVEL: Record<Acao, number> = { ver: 1, criar: 2, editar: 2, exportar: 2, excluir: 3 }

// Módulos do painel (chave estável + rótulo). Alinhados ao NAV do layout.
export const MODULOS: { key: string; label: string; grupo: string }[] = [
  { key: 'painel', label: 'Painel', grupo: 'Geral' },
  { key: 'minha-propriedade', label: 'Minha Propriedade', grupo: 'Geral' },
  { key: 'meus-espacos', label: 'Meus Espaços', grupo: 'Geral' },
  { key: 'fotos', label: 'Fotos', grupo: 'Geral' },
  { key: 'calendario', label: 'Calendário', grupo: 'Gestão' },
  { key: 'reservas', label: 'Reservas', grupo: 'Gestão' },
  { key: 'precificacao', label: 'Precificação', grupo: 'Gestão' },
  { key: 'ganhos', label: 'Ganhos', grupo: 'Gestão' },
  { key: 'financeiro', label: 'Financeiro', grupo: 'Gestão' },
  { key: 'recebiveis', label: 'Recebíveis', grupo: 'Gestão' },
  { key: 'contabilidade', label: 'Contabilidade', grupo: 'Financeiro' },
  { key: 'leads', label: 'Leads', grupo: 'Gestão' },
  { key: 'relatorios', label: 'Relatórios', grupo: 'Gestão' },
  { key: 'documentos', label: 'Documentos', grupo: 'Gestão' },
  { key: 'diario', label: 'Diário', grupo: 'Gestão' },
  { key: 'rh', label: 'RH', grupo: 'Pessoas' },
  { key: 'equipe', label: 'Equipe', grupo: 'Pessoas' },
  { key: 'ponto', label: 'Ponto & Escala', grupo: 'Pessoas' },
  { key: 'fornecedores', label: 'Fornecedores', grupo: 'Suprimentos' },
  { key: 'compras', label: 'Compras', grupo: 'Suprimentos' },
  { key: 'configuracoes', label: 'Configurações', grupo: 'Conta' },
  { key: 'planos', label: 'Planos', grupo: 'Conta' },
]

const MODULO_KEYS = MODULOS.map((m) => m.key)
const allModulos = (nivel: Nivel): Permissoes =>
  Object.fromEntries(MODULO_KEYS.map((k) => [k, nivel]))

// Permissões padrão por papel (ponto de partida; editável por membro).
export const PAPEIS: { v: Papel; label: string; desc: string; perms: Permissoes }[] = [
  {
    v: 'admin',
    label: 'Administrador',
    desc: 'Acesso total a tudo, incluindo configurações e equipe.',
    perms: allModulos('total'),
  },
  {
    v: 'financeiro',
    label: 'Financeiro',
    desc: 'Caixa, recebíveis, ganhos e relatórios.',
    perms: {
      ...allModulos('leitura'),
      financeiro: 'total', recebiveis: 'total', ganhos: 'total', relatorios: 'total',
      configuracoes: 'nenhum', equipe: 'leitura',
    },
  },
  {
    v: 'comercial',
    label: 'Comercial',
    desc: 'Leads, reservas, calendário e propostas.',
    perms: {
      ...allModulos('leitura'),
      leads: 'total', reservas: 'total', calendario: 'total', 'minha-propriedade': 'edicao',
      financeiro: 'nenhum', recebiveis: 'nenhum', configuracoes: 'nenhum', equipe: 'nenhum',
    },
  },
  {
    v: 'operacional',
    label: 'Operacional',
    desc: 'Agenda, reservas, documentos e produção.',
    perms: {
      ...allModulos('leitura'),
      calendario: 'edicao', reservas: 'edicao', documentos: 'edicao', diario: 'edicao', ponto: 'edicao',
      financeiro: 'nenhum', recebiveis: 'nenhum', configuracoes: 'nenhum',
    },
  },
  {
    v: 'rh',
    label: 'RH / Pessoas',
    desc: 'Equipe, folha, encargos, ponto e escala.',
    perms: {
      ...allModulos('nenhum'),
      painel: 'leitura', rh: 'total', equipe: 'total', ponto: 'total', diario: 'leitura', relatorios: 'leitura',
    },
  },
  {
    v: 'recepcao',
    label: 'Recepção',
    desc: 'Agenda e reservas do dia a dia.',
    perms: {
      ...allModulos('nenhum'),
      painel: 'leitura', calendario: 'edicao', reservas: 'edicao', leads: 'leitura',
    },
  },
  {
    v: 'leitura',
    label: 'Somente leitura',
    desc: 'Visualiza tudo, sem editar.',
    perms: allModulos('leitura'),
  },
]

const PAPEL_MAP = Object.fromEntries(PAPEIS.map((p) => [p.v, p]))

export function papelLabel(papel: string): string {
  return PAPEL_MAP[papel]?.label ?? papel
}

/** Permissões padrão (clonadas) de um papel. */
export function defaultPerms(papel: Papel): Permissoes {
  return { ...(PAPEL_MAP[papel]?.perms ?? allModulos('leitura')) }
}

/** Nível efetivo de um membro num módulo: override > default do papel. */
export function nivelDe(papel: Papel, permissoes: Permissoes | null | undefined, modulo: string): Nivel {
  const override = permissoes?.[modulo]
  if (override) return override
  return PAPEL_MAP[papel]?.perms[modulo] ?? 'nenhum'
}

/** O membro pode executar a ação no módulo? (owner/admin → sempre true.) */
export function can(
  ctx: { dono?: boolean; papel?: Papel; permissoes?: Permissoes | null },
  modulo: string,
  acao: Acao = 'ver',
): boolean {
  if (ctx.dono || ctx.papel === 'admin') return true
  if (!ctx.papel) return false
  const nivel = nivelDe(ctx.papel, ctx.permissoes, modulo)
  return NIVEL_ORDEM[nivel] >= ACAO_NIVEL[acao]
}
