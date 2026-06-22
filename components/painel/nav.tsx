// Fonte ÚNICA da navegação do painel do proprietário (/painel/*).
// Consumida pelo shell (app/(proprietario)/painel/layout.tsx) e pelo Command
// Palette (⌘K, components/CommandPalette.tsx). Manter a lista aqui evita
// duplicar os ~60 módulos em dois lugares e os deixa sempre em sincronia.
// As LABELS de exibição vêm do dicionário i18n (dict.painel.nav.*) pela `key`;
// o campo `label` é só um rótulo de fallback/legível em PT.

import type { T as PainelDict } from '@/lib/i18n/dictionaries/pt/painel';

export type GroupKey = keyof PainelDict['nav']['grupos'];
export type ItemKey = keyof PainelDict['nav']['itens'];
export type IconName = keyof typeof ICONS;
export type NavItem = { href: string; key: ItemKey; label: string; icon: IconName; enabled?: boolean };
export type NavGroup = { group: string; gkey: GroupKey; items: NavItem[] };

export const NAV: NavGroup[] = [
  {
    group: 'Geral',
    gkey: 'geral',
    items: [
      { href: '/painel', key: 'painel', label: 'Painel', icon: 'home', enabled: true },
      { href: '/painel/minha-propriedade', key: 'minhaPropriedade', label: 'Minha Propriedade', icon: 'building', enabled: true },
      { href: '/painel/meus-espacos', key: 'meusEspacos', label: 'Meus Espaços', icon: 'spaces', enabled: true },
      { href: '/painel/fotos', key: 'fotos', label: 'Fotos', icon: 'image', enabled: true },
    ],
  },
  {
    group: 'Gestão',
    gkey: 'gestao',
    items: [
      { href: '/painel/calendario', key: 'calendario', label: 'Calendário', icon: 'calendar', enabled: true },
      { href: '/painel/reservas', key: 'reservas', label: 'Reservas', icon: 'ticket', enabled: true },
      { href: '/painel/precificacao', key: 'precificacao', label: 'Precificação', icon: 'tag', enabled: true },
      { href: '/painel/propostas', key: 'propostas', label: 'Propostas', icon: 'proposal', enabled: true },
      { href: '/painel/ganhos', key: 'ganhos', label: 'Ganhos', icon: 'coins', enabled: true },
      { href: '/painel/clientes', key: 'clientes', label: 'Clientes', icon: 'contacts', enabled: true },
      { href: '/painel/conversas', key: 'conversas', label: 'Mensagens', icon: 'chat', enabled: true },
      { href: '/painel/avaliacoes', key: 'avaliacoes', label: 'Avaliações', icon: 'star', enabled: true },
      { href: '/painel/feedbacks', key: 'feedbacks', label: 'Feedbacks', icon: 'chat', enabled: true },
      { href: '/painel/leads', key: 'leads', label: 'Leads', icon: 'target', enabled: true },
      { href: '/painel/relatorios', key: 'relatorios', label: 'Relatórios', icon: 'chart', enabled: true },
      { href: '/painel/documentos', key: 'documentos', label: 'Documentos', icon: 'doc', enabled: true },
      { href: '/painel/contratos', key: 'contratos', label: 'Contratos', icon: 'signature', enabled: true },
      { href: '/painel/diario', key: 'diario', label: 'Diário', icon: 'book', enabled: true },
    ],
  },
  {
    group: 'Marketing',
    gkey: 'marketing',
    items: [
      { href: '/painel/marketing', key: 'marketing', label: 'Marketing', icon: 'growth', enabled: true },
      { href: '/painel/campanhas', key: 'campanhas', label: 'Campanhas', icon: 'megaphone', enabled: true },
      { href: '/painel/listas', key: 'listas', label: 'Listas Oficiais', icon: 'list', enabled: true },
      { href: '/painel/pesquisas', key: 'pesquisas', label: 'Pesquisas & NPS', icon: 'poll', enabled: true },
      { href: '/painel/portal', key: 'portal', label: 'Portal do Cliente', icon: 'portal', enabled: true },
    ],
  },
  {
    group: 'Operações',
    gkey: 'operacoes',
    items: [
      { href: '/painel/producao', key: 'producao', label: 'Produção', icon: 'clapper', enabled: true },
      { href: '/painel/logistica', key: 'logistica', label: 'Logística', icon: 'cone', enabled: true },
      { href: '/painel/acesso', key: 'acesso', label: 'Acesso & Credenciamento', icon: 'shield', enabled: true },
      { href: '/painel/bilheteria', key: 'bilheteria', label: 'Bilheteria', icon: 'tickets', enabled: true },
      { href: '/painel/expositores', key: 'expositores', label: 'Expositores & Patrocínios', icon: 'expo', enabled: true },
      { href: '/painel/catering', key: 'catering', label: 'Catering & Bar', icon: 'utensils', enabled: true },
      { href: '/painel/estacionamento', key: 'estacionamento', label: 'Estacionamento & Mobilidade', icon: 'car', enabled: true },
      { href: '/painel/layouts', key: 'layouts', label: 'Layouts & Plantas', icon: 'blueprint', enabled: true },
      { href: '/painel/plano-b', key: 'planoB', label: 'Clima & Plano B', icon: 'cloud', enabled: true },
    ],
  },
  {
    group: 'Pessoas',
    gkey: 'pessoas',
    items: [
      { href: '/painel/rh', key: 'rh', label: 'RH', icon: 'people', enabled: true },
      { href: '/painel/equipe', key: 'equipe', label: 'Equipe', icon: 'users', enabled: true },
      { href: '/painel/ponto', key: 'ponto', label: 'Ponto & Escala', icon: 'clock', enabled: true },
    ],
  },
  {
    group: 'Financeiro',
    gkey: 'financeiro',
    items: [
      { href: '/painel/financeiro', key: 'financeiro', label: 'Financeiro', icon: 'wallet', enabled: true },
      { href: '/painel/recebiveis', key: 'recebiveis', label: 'Contas a pagar/receber', icon: 'receipt', enabled: true },
      { href: '/painel/faturamento', key: 'faturamento', label: 'Faturamento', icon: 'invoice', enabled: true },
      { href: '/painel/comissoes', key: 'comissoes', label: 'Comissões', icon: 'commission', enabled: true },
      { href: '/painel/contabilidade', key: 'contabilidade', label: 'Contabilidade', icon: 'ledger', enabled: true },
    ],
  },
  {
    group: 'Suprimentos',
    gkey: 'suprimentos',
    items: [
      { href: '/painel/fornecedores', key: 'fornecedores', label: 'Fornecedores', icon: 'truck', enabled: true },
      { href: '/painel/compras', key: 'compras', label: 'Compras', icon: 'cart', enabled: true },
      { href: '/painel/estoque', key: 'estoque', label: 'Estoque', icon: 'package', enabled: true },
      { href: '/painel/ativos', key: 'ativos', label: 'Ativos & Bens', icon: 'assets', enabled: true },
      { href: '/painel/equipamentos', key: 'equipamentos', label: 'Equipamentos', icon: 'layers', enabled: true },
      { href: '/painel/manutencao', key: 'manutencao', label: 'Manutenção', icon: 'wrench', enabled: true },
    ],
  },
  {
    group: 'Conformidade',
    gkey: 'conformidade',
    items: [
      { href: '/painel/licencas', key: 'licencas', label: 'Licenças & Alvarás', icon: 'compliance', enabled: true },
      { href: '/painel/seguros', key: 'seguros', label: 'Seguros', icon: 'umbrella', enabled: true },
      { href: '/painel/sst', key: 'sst', label: 'Saúde & Segurança (SST)', icon: 'safety', enabled: true },
      { href: '/painel/juridico', key: 'juridico', label: 'Jurídico & LGPD', icon: 'scale', enabled: true },
    ],
  },
  {
    group: 'Inteligência',
    gkey: 'inteligencia',
    items: [
      { href: '/painel/terceiros', key: 'terceiros', label: 'Terceiros (custo × retorno)', icon: 'exchange', enabled: true },
    ],
  },
  {
    group: 'Conta',
    gkey: 'conta',
    items: [
      { href: '/painel/metas', key: 'metas', label: 'Metas & OKR', icon: 'goal', enabled: true },
      { href: '/painel/automacoes', key: 'automacoes', label: 'Automações', icon: 'bolt', enabled: true },
      { href: '/painel/unidades', key: 'unidades', label: 'Unidades', icon: 'network', enabled: true },
      { href: '/painel/indique', key: 'indique', label: 'Indique & Ganhe', icon: 'gift', enabled: true },
      { href: '/painel/integracoes', key: 'integracoes', label: 'Integrações', icon: 'plug', enabled: true },
      { href: '/painel/configuracoes', key: 'configuracoes', label: 'Configurações', icon: 'cog', enabled: true },
      { href: '/painel/auditoria', key: 'auditoria', label: 'Auditoria & Logs', icon: 'audit', enabled: true },
      { href: '/painel/planos', key: 'planos', label: 'Planos', icon: 'card', enabled: true },
    ],
  },
];

// ── Ícones (stroke, estilo premium) ────────────────────────────────────────
export const ICONS = {
  home: 'M3 9.5 12 3l9 6.5V21a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z',
  building: 'M3 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16M15 21V9h4a2 2 0 0 1 2 2v10M7 7h2M7 11h2M7 15h2',
  image: 'M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Zm0 13 5-5 4 4 4-4 5 5M9 9.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Z',
  calendar: 'M3 9h18M7 3v4M17 3v4M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z',
  wallet: 'M3 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2H3Zm0 0v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2H5M16 13h.01',
  receipt: 'M5 3v18l2.5-1.5L10 21l2-1.5L14 21l2.5-1.5L19 21V3l-2.5 1.5L14 3l-2 1.5L10 3 7.5 4.5 5 3Zm3.5 6h7M8.5 13h7',
  target: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-4a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm0-4a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z',
  chart: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  doc: 'M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Zm0 0v6h6M8 13h8M8 17h6',
  users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm13 10v-2a4 4 0 0 0-3-3.87M16 3.13A4 4 0 0 1 16 11',
  book: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20M4 19.5A2.5 2.5 0 0 0 6.5 22H20V2H6.5A2.5 2.5 0 0 0 4 4.5Z',
  gift: 'M20 12v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-9M2 7h20v5H2zM12 22V7M12 7S8 7 8 4.5 12 7 12 7Zm0 0s4 0 4-2.5S12 7 12 7Z',
  bolt: 'M13 2 3 14h7l-1 8 10-12h-7l1-8Z',
  cog: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm8-3a8 8 0 0 0-.13-1.4l2-1.55-2-3.46-2.36.95a8 8 0 0 0-2.42-1.4L14.7 2h-4l-.39 2.74a8 8 0 0 0-2.42 1.4L5.53 5.2l-2 3.46 2 1.55A8 8 0 0 0 5.4 12a8 8 0 0 0 .13 1.4l-2 1.55 2 3.46 2.36-.95a8 8 0 0 0 2.42 1.4L10.7 22h4l.39-2.74a8 8 0 0 0 2.42-1.4l2.36.95 2-3.46-2-1.55A8 8 0 0 0 20 12Z',
  card: 'M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Zm0 4h18',
  spaces: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
  ticket: 'M4 7h16a1 1 0 0 1 1 1v2a2 2 0 0 0 0 4v2a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-2a2 2 0 0 0 0-4V8a1 1 0 0 1 1-1ZM15 7v12',
  tickets: 'M4 8a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v2a2 2 0 0 0 0 4v2a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-2a2 2 0 0 0 0-4Zm5.5 4.2 1.6 1.6 3.2-3.2',
  coins: 'M3 6h18v12H3zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6',
  contacts: 'M4 4h16a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Zm5.5 6.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM6 16a3.5 3.5 0 0 1 7 0M15.5 9H18M15.5 13H18',
  star: 'M12 3.5l2.6 5.27 5.82.85-4.21 4.1.99 5.79L12 16.77l-5.2 2.73.99-5.79-4.21-4.1 5.82-.85L12 3.5Z',
  chat: 'M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.5 8.5 0 0 1-3.8-.9L3 21l1.9-5.7A8.38 8.38 0 0 1 4 11.5 8.5 8.5 0 0 1 12.5 3 8.38 8.38 0 0 1 21 11.5Z',
  truck: 'M1 3h13v11H1zM14 7h4l3 3v4h-7M6 18.5a2 2 0 1 1-4 0 2 2 0 0 1 4 0Zm12 0a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z',
  cart: 'M3 3h2l2.4 12.3a1 1 0 0 0 1 .7h8.7a1 1 0 0 0 1-.8L21 7H6M10 21a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm8 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z',
  package: 'M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16ZM3.27 6.96 12 12l8.73-5.04M12 22V12',
  layers: 'M12 2 2 7l10 5 10-5-10-5ZM2 17l10 5 10-5M2 12l10 5 10-5',
  wrench: 'M14.7 6.3a4 4 0 0 0-5.4 5.2L3 17.8 6.2 21l6.3-6.3a4 4 0 0 0 5.2-5.4l-2.5 2.5-2.3-2.3 2.5-2.5Z',
  tag: 'M20.59 13.41 12 22l-9-9V3h10l7.59 7.59a2 2 0 0 1 0 2.82ZM7.5 7.5h.01',
  signature: 'M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9l-6-6Zm0 0v6h6M8 16.5c1-1.5 2-1.5 3 0s2 1.5 3 0',
  proposal: 'M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9l-6-6Zm0 0v6h6M9 13l2 2 4-4',
  commission: 'M6 18 18 6M8.5 7.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Zm10 9a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Z',
  invoice: 'M14 3H6a2 2 0 0 0-2 2v16l2.5-1.5L9 21l1.5-1.5L12 21l1.5-1.5L15 21l2.5-1.5V9l-3.5-6ZM14 3v6h3.5M8 12h6M8 15.5h4',
  ledger: 'M5 3h14a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1ZM4 8h16M11 8v13',
  assets: 'M3 21h18M5 21V10M19 21V10M9 21v-5h6v5M12 3 4 8h16l-8-5Z',
  clock: 'M12 7v5l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z',
  people: 'M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM3 20v-1a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v1M16 15h1a4 4 0 0 1 4 4v1',
  cone: 'M10.5 3h3l3.6 17.2a.8.8 0 0 1-.8 1H7.7a.8.8 0 0 1-.8-1L10.5 3ZM9 9.5h6M8 15h8',
  shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3ZM9.5 12l2 2 3.5-4',
  clapper: 'M3 8h18v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8Zm.4-3 14.4-2.6a1 1 0 0 1 1.16.8L19.6 6 3 8.6 2.6 6a1 1 0 0 1 .8-1ZM8 5.2l1 2.6M13 4.3l1 2.6',
  car: 'M5 11l1.6-4.8A2 2 0 0 1 8.5 5h7a2 2 0 0 1 1.9 1.2L19 11m-14 0h14a2 2 0 0 1 2 2v4h-2.5M5 11a2 2 0 0 0-2 2v4h2.5m0 0a2 2 0 0 0 4 0m-4 0h4m6 0a2 2 0 0 0 4 0m-4 0h4M7.5 14h2m5 0h2',
  blueprint: 'M4 3h16a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1ZM3 9h18M9 9v12M14 3v6',
  utensils: 'M4 3v7a2 2 0 0 0 2 2v9M8 3v7a2 2 0 0 1-2 2M6 3v7M16 3c-1.3 0-2.5 1.7-2.5 4.5S14.7 12 16 12v9',
  cloud: 'M17.5 19a4.5 4.5 0 0 0 0-9 6 6 0 0 0-11.6 1.5A4 4 0 0 0 6 19h11.5ZM9 21l-1 1.5M13 21l-1 1.5M16 21l-1 1.5',
  expo: 'M3 9l1.6-4.2A1 1 0 0 1 5.5 4h13a1 1 0 0 1 .9.8L21 9M4 9v10a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V9M3 9h18M9 20v-6h6v6',
  megaphone: 'M3 11v2a1 1 0 0 0 1 1h2l3.5 3.5a1 1 0 0 0 1.7-.7V7.2a1 1 0 0 0-1.7-.7L6 10H4a1 1 0 0 0-1 1ZM15 8a4 4 0 0 1 0 8M18 5a8 8 0 0 1 0 14',
  list: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  poll: 'M5 21V9M12 21V3M19 21v-7M3 21h18',
  growth: 'M3 17l6-6 4 4 7-7M14 8h5v5',
  portal: 'M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3',
  scale: 'M12 3v18M7 21h10M12 6l7 2-2.5 5a3 3 0 0 0 5 0L19 8M12 6 5 8l2.5 5a3 3 0 0 1-5 0L5 8',
  safety: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3ZM12 9v6M9 12h6',
  compliance: 'M12 13a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9ZM8.5 12.2 7 21l5-2.6 5 2.6-1.5-8.8M10 8.6l1.3 1.3 2.7-2.7',
  umbrella: 'M12 2a9 9 0 0 1 9 9H3a9 9 0 0 1 9-9ZM12 11v8a2 2 0 0 0 4 0',
  audit: 'M3 3v5h5M3.05 13A9 9 0 1 0 6 5.3L3 8M12 7v5l3 2',
  network: 'M12 3a2 2 0 1 0 0 4 2 2 0 0 0 0-4ZM5 17a2 2 0 1 0 0 4 2 2 0 0 0 0-4Zm14 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4ZM12 7v4M12 11l-6 4M12 11l6 4',
  goal: 'M6 21V4M6 4.5h11l-2.5 3.5L17 11.5H6',
  plug: 'M9 2v6M15 2v6M7 8h10v4a5 5 0 0 1-10 0V8ZM12 17v5',
  exchange: 'M4 9h13m0 0-3-3m3 3-3 3M20 15H7m0 0 3-3m-3 3 3 3',
} as const;

export function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0"
    >
      <path d={ICONS[name]} />
    </svg>
  );
}
