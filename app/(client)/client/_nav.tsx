// Navegação + ícones da Área do Cliente (contratante). Espelha o padrão do painel
// (grupos + SVG stroke), com identidade própria e mais quente. Um único lugar
// para a sidebar, o menu do avatar e a paleta de atalhos.

import type { ReactNode } from 'react'

export type IconName =
  | 'home' | 'ticket' | 'calendar' | 'chat' | 'clipboard' | 'card' | 'doc'
  | 'heart' | 'star' | 'compass' | 'gift' | 'wallet' | 'user' | 'bell'
  | 'shield' | 'help' | 'building' | 'logout' | 'search' | 'sparkle'

const PATHS: Record<IconName, ReactNode> = {
  home: <path d="M3 10.5 12 3l9 7.5M5 9.5V21h14V9.5" />,
  ticket: <><path d="M3 9a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2 2 2 0 0 0 0 4 2 2 0 0 1-2 2H5a2 2 0 0 1-2-2 2 2 0 0 0 0-4z" /><path d="M14 7v10" strokeDasharray="2 2" /></>,
  calendar: <><path d="M7 3v3M17 3v3" /><rect x="4" y="6" width="16" height="15" rx="2" /><path d="M4 11h16" /></>,
  chat: <path d="M21 11.5a8.4 8.4 0 0 1-8.5 8.5 8.5 8.5 0 0 1-3.7-.8L3 21l1.8-5.3A8.4 8.4 0 0 1 4 11.5 8.5 8.5 0 0 1 12.5 3 8.4 8.4 0 0 1 21 11.5z" />,
  clipboard: <><path d="M9 4h6v3H9z" /><path d="M9 5H6a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1h-3" /><path d="M9 13l2 2 4-4" /></>,
  card: <><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20M6 15h4" /></>,
  doc: <><path d="M14 3H7a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V8z" /><path d="M14 3v5h5M9 13h6M9 17h4" /></>,
  heart: <path d="M12 20s-7-4.5-9.2-8.6C1.3 8.1 3 5 6 5c1.9 0 3.2 1.1 4 2.3C10.8 6.1 12.1 5 14 5c3 0 4.7 3.1 3.2 6.4C19 15.5 12 20 12 20z" />,
  star: <path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 17l-5.2 2.7 1-5.9-4.3-4.1 5.9-.8z" />,
  compass: <><circle cx="12" cy="12" r="9" /><path d="M15.5 8.5l-2 5-5 2 2-5z" /></>,
  gift: <><path d="M20 12v8a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-8" /><rect x="2" y="8" width="20" height="4" rx="1" /><path d="M12 21V8M12 8S10.5 3 8 3.4 6 7.5 12 8zM12 8s1.5-5 4-4.6S18 7.5 12 8z" /></>,
  wallet: <><path d="M3 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v1" /><path d="M3 7v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5a2 2 0 0 0-2-2H5a2 2 0 0 1-2-2z" /><path d="M16 13h.5" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
  bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></>,
  shield: <><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" /><path d="M9.2 12l2 2 3.6-3.6" /></>,
  help: <><circle cx="12" cy="12" r="9" /><path d="M9.6 9a2.5 2.5 0 0 1 4.6 1.3c0 1.7-2.2 2.2-2.2 3.2M12 17h.01" /></>,
  building: <><path d="M4 21V5a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v16" /><path d="M14 9h5a1 1 0 0 1 1 1v11M8 8h2M8 12h2M8 16h2" /></>,
  logout: <><path d="M15 12H4M8 8l-4 4 4 4" /><path d="M14 4h5a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-5" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.2-3.2" /></>,
  sparkle: <path d="M12 3l1.8 4.7L18.5 9.5 13.8 11.3 12 16l-1.8-4.7L5.5 9.5l4.7-1.8z" />,
}

export function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
      {PATHS[name]}
    </svg>
  )
}

export type NavItem = { href: string; label: string; icon: IconName; external?: boolean }
export type NavGroup = { group: string; items: NavItem[] }

export const NAV: NavGroup[] = [
  {
    group: 'Minha área',
    items: [
      { href: '/client', label: 'Início', icon: 'home' },
      { href: '/client/eventos', label: 'Meus eventos', icon: 'ticket' },
      { href: '/client/reservas', label: 'Reservas', icon: 'calendar' },
      { href: '/client/conversas', label: 'Conversas', icon: 'chat' },
    ],
  },
  {
    group: 'Planejamento',
    items: [
      { href: '/client/planejador', label: 'Planejador', icon: 'clipboard' },
      { href: '/client/pagamentos', label: 'Pagamentos', icon: 'card' },
      { href: '/client/documentos', label: 'Documentos', icon: 'doc' },
    ],
  },
  {
    group: 'Descobrir',
    items: [
      { href: '/client/favoritos', label: 'Favoritos', icon: 'heart' },
      { href: '/client/avaliacoes', label: 'Avaliações', icon: 'star' },
      { href: '/busca', label: 'Explorar espaços', icon: 'compass' },
    ],
  },
  {
    group: 'Recompensas',
    items: [
      { href: '/client/indique', label: 'Indique e ganhe', icon: 'gift' },
      { href: '/client/carteira', label: 'Carteira', icon: 'wallet' },
    ],
  },
  {
    group: 'Conta',
    items: [
      { href: '/client/perfil', label: 'Meu perfil', icon: 'user' },
      { href: '/client/notificacoes', label: 'Notificações', icon: 'bell' },
      { href: '/client/privacidade', label: 'Privacidade', icon: 'shield' },
      { href: '/client/ajuda', label: 'Central de ajuda', icon: 'help' },
    ],
  },
]

/** Lista plana dos itens internos (para a paleta de atalhos / busca). */
export const NAV_FLAT: NavItem[] = NAV.flatMap((g) => g.items).filter((i) => i.href.startsWith('/client'))
