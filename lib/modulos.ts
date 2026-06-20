// Catálogo de módulos do painel + ENGINE PURA de entitlement por plano.
// ----------------------------------------------------------------------------
// Eixo de PLANO (o que a assinatura/add-ons do dono liberam), distinto do eixo
// de PAPEL/RBAC em lib/rbac.ts (o que um membro da equipe pode tocar). Ambos
// precisam passar. Esta engine é PURA (sem imports server): roda no client
// (cadeado do menu + gate da página) e no server (rotas admin/checkout/webhook).
//
// `key` == primeiro segmento da rota /painel/<key> (e 'painel' p/ a raiz), para
// que moduloDaRota() case com o catálogo sem duplicação.

export type PlanoTier = 'basico' | 'pro' | 'ultra'

export const PLANO_ORDEM: Record<PlanoTier, number> = { basico: 0, pro: 1, ultra: 2 }
export const PLANO_LABEL: Record<PlanoTier, string> = { basico: 'Básico', pro: 'Pro', ultra: 'Ultra' }
export const PLANOS_TIERS: PlanoTier[] = ['basico', 'pro', 'ultra']

export type ModuloDef = {
  key: string
  label: string
  grupo: string
  /** Plano mínimo que inclui o módulo por PADRÃO (admin pode sobrescrever). */
  plano: PlanoTier
  /** Núcleo: sempre liberado, nunca trava (o dono não pode se trancar pra fora). */
  core?: boolean
}

// Catálogo canônico — alinhado ao NAV de app/(proprietario)/painel/layout.tsx.
// A distribuição `plano` é só o DEFAULT inicial (sobreposto pela matriz do admin
// em planos_config.modulos). Núcleo: Painel, Configurações e Planos.
export const MODULOS_PAINEL: ModuloDef[] = [
  // Geral
  { key: 'painel', label: 'Painel', grupo: 'Geral', plano: 'basico', core: true },
  { key: 'minha-propriedade', label: 'Minha Propriedade', grupo: 'Geral', plano: 'basico' },
  { key: 'meus-espacos', label: 'Meus Espaços', grupo: 'Geral', plano: 'basico' },
  { key: 'fotos', label: 'Fotos', grupo: 'Geral', plano: 'basico' },
  // Gestão
  { key: 'calendario', label: 'Calendário', grupo: 'Gestão', plano: 'basico' },
  { key: 'reservas', label: 'Reservas', grupo: 'Gestão', plano: 'basico' },
  { key: 'precificacao', label: 'Precificação', grupo: 'Gestão', plano: 'pro' },
  { key: 'propostas', label: 'Propostas', grupo: 'Gestão', plano: 'pro' },
  { key: 'ganhos', label: 'Ganhos', grupo: 'Gestão', plano: 'basico' },
  { key: 'clientes', label: 'Clientes', grupo: 'Gestão', plano: 'pro' },
  { key: 'conversas', label: 'Mensagens', grupo: 'Gestão', plano: 'basico' },
  { key: 'avaliacoes', label: 'Avaliações', grupo: 'Gestão', plano: 'basico' },
  { key: 'feedbacks', label: 'Feedbacks', grupo: 'Gestão', plano: 'pro' },
  { key: 'leads', label: 'Leads', grupo: 'Gestão', plano: 'basico' },
  { key: 'relatorios', label: 'Relatórios', grupo: 'Gestão', plano: 'pro' },
  { key: 'documentos', label: 'Documentos', grupo: 'Gestão', plano: 'basico' },
  { key: 'contratos', label: 'Contratos', grupo: 'Gestão', plano: 'pro' },
  { key: 'diario', label: 'Diário', grupo: 'Gestão', plano: 'pro' },
  // Marketing
  { key: 'marketing', label: 'Marketing', grupo: 'Marketing', plano: 'pro' },
  { key: 'campanhas', label: 'Campanhas', grupo: 'Marketing', plano: 'pro' },
  { key: 'listas', label: 'Listas Oficiais', grupo: 'Marketing', plano: 'basico' },
  { key: 'pesquisas', label: 'Pesquisas & NPS', grupo: 'Marketing', plano: 'pro' },
  { key: 'portal', label: 'Portal do Cliente', grupo: 'Marketing', plano: 'pro' },
  // Operações
  { key: 'producao', label: 'Produção', grupo: 'Operações', plano: 'ultra' },
  { key: 'logistica', label: 'Logística', grupo: 'Operações', plano: 'ultra' },
  { key: 'acesso', label: 'Acesso & Credenciamento', grupo: 'Operações', plano: 'ultra' },
  { key: 'bilheteria', label: 'Bilheteria', grupo: 'Operações', plano: 'ultra' },
  { key: 'expositores', label: 'Expositores & Patrocínios', grupo: 'Operações', plano: 'ultra' },
  { key: 'catering', label: 'Catering & Bar', grupo: 'Operações', plano: 'ultra' },
  { key: 'estacionamento', label: 'Estacionamento & Mobilidade', grupo: 'Operações', plano: 'ultra' },
  { key: 'layouts', label: 'Layouts & Plantas', grupo: 'Operações', plano: 'ultra' },
  { key: 'plano-b', label: 'Clima & Plano B', grupo: 'Operações', plano: 'ultra' },
  // Pessoas
  { key: 'rh', label: 'RH', grupo: 'Pessoas', plano: 'ultra' },
  { key: 'equipe', label: 'Equipe', grupo: 'Pessoas', plano: 'pro' },
  { key: 'ponto', label: 'Ponto & Escala', grupo: 'Pessoas', plano: 'pro' },
  // Financeiro
  { key: 'financeiro', label: 'Financeiro', grupo: 'Financeiro', plano: 'pro' },
  { key: 'recebiveis', label: 'Contas a pagar/receber', grupo: 'Financeiro', plano: 'pro' },
  { key: 'faturamento', label: 'Faturamento', grupo: 'Financeiro', plano: 'pro' },
  { key: 'comissoes', label: 'Comissões', grupo: 'Financeiro', plano: 'pro' },
  { key: 'contabilidade', label: 'Contabilidade', grupo: 'Financeiro', plano: 'pro' },
  // Suprimentos
  { key: 'fornecedores', label: 'Fornecedores', grupo: 'Suprimentos', plano: 'pro' },
  { key: 'compras', label: 'Compras', grupo: 'Suprimentos', plano: 'pro' },
  { key: 'estoque', label: 'Estoque', grupo: 'Suprimentos', plano: 'pro' },
  { key: 'ativos', label: 'Ativos & Bens', grupo: 'Suprimentos', plano: 'ultra' },
  { key: 'equipamentos', label: 'Equipamentos', grupo: 'Suprimentos', plano: 'ultra' },
  { key: 'manutencao', label: 'Manutenção', grupo: 'Suprimentos', plano: 'ultra' },
  // Conformidade
  { key: 'licencas', label: 'Licenças & Alvarás', grupo: 'Conformidade', plano: 'pro' },
  { key: 'seguros', label: 'Seguros', grupo: 'Conformidade', plano: 'pro' },
  { key: 'sst', label: 'Saúde & Segurança (SST)', grupo: 'Conformidade', plano: 'ultra' },
  { key: 'juridico', label: 'Jurídico & LGPD', grupo: 'Conformidade', plano: 'ultra' },
  // Inteligência
  { key: 'terceiros', label: 'Terceiros (custo × retorno)', grupo: 'Inteligência', plano: 'ultra' },
  // Conta
  { key: 'metas', label: 'Metas & OKR', grupo: 'Conta', plano: 'pro' },
  { key: 'automacoes', label: 'Automações', grupo: 'Conta', plano: 'pro' },
  { key: 'unidades', label: 'Unidades', grupo: 'Conta', plano: 'ultra' },
  { key: 'indique', label: 'Indique & Ganhe', grupo: 'Conta', plano: 'basico' },
  { key: 'integracoes', label: 'Integrações', grupo: 'Conta', plano: 'pro' },
  { key: 'configuracoes', label: 'Configurações', grupo: 'Conta', plano: 'basico', core: true },
  { key: 'auditoria', label: 'Auditoria & Logs', grupo: 'Conta', plano: 'pro' },
  { key: 'planos', label: 'Planos', grupo: 'Conta', plano: 'basico', core: true },
]

const BY_KEY = new Map(MODULOS_PAINEL.map((m) => [m.key, m]))

/** Chaves de núcleo — sempre liberadas, jamais travadas. */
export const MODULOS_CORE: string[] = MODULOS_PAINEL.filter((m) => m.core).map((m) => m.key)

export function moduloDef(key: string): ModuloDef | undefined {
  return BY_KEY.get(key)
}

export function moduloLabel(key: string): string {
  return BY_KEY.get(key)?.label ?? key
}

export function isCore(key: string): boolean {
  return BY_KEY.get(key)?.core === true
}

/** Mapeia uma rota do painel para a chave do módulo. /painel → 'painel'. */
export function moduloDaRota(pathname: string | null | undefined): string | null {
  if (!pathname) return null
  if (pathname !== '/painel' && !pathname.startsWith('/painel/')) return null
  const resto = pathname.slice('/painel'.length).replace(/^\/+/, '')
  if (!resto) return 'painel'
  return resto.split(/[/?#]/)[0] || 'painel'
}

/** Normaliza um plano arbitrário para um tier conhecido (fallback 'basico'). */
export function normalizarPlano(plano: string | null | undefined): PlanoTier {
  const p = (plano || 'basico').toLowerCase()
  return (PLANOS_TIERS as string[]).includes(p) ? (p as PlanoTier) : 'basico'
}

/** Default do catálogo: todos os módulos cujo tier ≤ o do plano (ultra inclui tudo). */
export function modulosDefaultDoPlano(plano: string | null | undefined): string[] {
  const ordem = PLANO_ORDEM[normalizarPlano(plano)]
  return MODULOS_PAINEL.filter((m) => PLANO_ORDEM[m.plano] <= ordem).map((m) => m.key)
}

/**
 * Conjunto efetivo de módulos liberados: núcleo ∪ módulos do plano ∪ add-ons.
 * `planoModulos` vem de planos_config.modulos (ou do default); `extras` são os
 * add-ons ativos do usuário (usuarios_modulos).
 */
export function resolverEntitlement(
  planoModulos: string[] | null | undefined,
  extras?: string[] | null,
): Set<string> {
  const set = new Set<string>(MODULOS_CORE)
  for (const k of planoModulos ?? []) set.add(k)
  for (const k of extras ?? []) set.add(k)
  return set
}

/**
 * Plano mínimo que destrava um módulo, dado o mapa de módulos por plano
 * (planos_config). Cai no default do catálogo se o mapa não cobrir a chave.
 */
export function planoMinimoParaModulo(
  key: string,
  planosModulos?: Partial<Record<PlanoTier, string[]>> | null,
): PlanoTier | null {
  if (planosModulos) {
    for (const tier of PLANOS_TIERS) {
      if (planosModulos[tier]?.includes(key)) return tier
    }
  }
  return BY_KEY.get(key)?.plano ?? null
}
