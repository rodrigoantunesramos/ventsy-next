// Sidebar do painel de administração central da VENTSY
// Acesso restrito: apenas o proprietário (ADMIN_EMAILS no admin.js)

type NavItem = {
  icon: string
  label: string
  page: string
  badgeId?: string
  badgeStyle?: React.CSSProperties
  isActive?: boolean
}

const navItems: NavItem[] = [
  // Visão Geral
  { icon: '📊', label: 'Dashboard', page: 'dashboard', isActive: true },
  { icon: '📈', label: 'Analytics', page: 'analytics' },
  // Gestão
  { icon: '🏡', label: 'Propriedades', page: 'propriedades', badgeId: 'badge-pendentes' },
  { icon: '👥', label: 'Usuários', page: 'usuarios' },
  {
    icon: '⚠️',
    label: 'Cadastros Incompletos',
    page: 'incompletos',
    badgeId: 'badge-incompletos',
    badgeStyle: { background: 'var(--yellow)' },
  },
  { icon: '💳', label: 'Assinaturas', page: 'assinaturas' },
  // Configurações
  { icon: '⭐', label: 'Planos', page: 'planos' },
  { icon: '⚙️', label: 'Configurações', page: 'config' },
  // Financeiro
  { icon: '💰', label: 'Receita & MRR', page: 'financeiro' },
  { icon: '🎟️', label: 'Cupons', page: 'cupons' },
  // Plataforma
  { icon: '✨', label: 'Qualidade', page: 'qualidade' },
  { icon: '📣', label: 'Comunicação', page: 'comunicacao' },
  { icon: '📋', label: 'Logs Admin', page: 'logs' },
]

const sectionLabels: Record<string, string> = {
  dashboard: 'Visão Geral',
  propriedades: 'Gestão',
  planos: 'Configurações',
  financeiro: 'Financeiro',
  qualidade: 'Plataforma',
}

export default function AdminSidebar() {
  return (
    <aside className="admin-sidebar" id="sidebar">
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="sidebar-logo-text"><em>VENTSY</em></div>
        <div className="sidebar-badge-admin">⚙️ Admin Central</div>
      </div>

      {/* Navegação */}
      {navItems.map((item) => (
        <div key={item.page}>
          {sectionLabels[item.page] && (
            <div className="sidebar-section">{sectionLabels[item.page]}</div>
          )}
          <div
            className={`sidebar-link${item.isActive ? ' active' : ''}`}
            onClick={() => (window as any).showPage(item.page)}
          >
            <span className="icon">{item.icon}</span>
            {item.label}
            {item.badgeId && (
              <span
                className="sidebar-badge"
                id={item.badgeId}
                style={item.badgeStyle}
              >
                0
              </span>
            )}
          </div>
        </div>
      ))}

      {/* Rodapé do sidebar — admin info */}
      <div className="sidebar-bottom">
        <div className="sidebar-user">
          <div className="sidebar-user-avatar" id="admin-avatar">A</div>
          <div>
            <div className="sidebar-user-name" id="admin-name">Admin</div>
            <div className="sidebar-user-role">Super Admin</div>
          </div>
        </div>
        <button
          className="sidebar-logout"
          onClick={() => (window as any).doLogout()}
        >
          🚪 Sair
        </button>
      </div>
    </aside>
  )
}
