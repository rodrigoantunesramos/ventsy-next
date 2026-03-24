// Sidebar do Admin
// ATENÇÃO: admin.js manipula .sidebar-link.active, #sidebar, #admin-avatar, #admin-name e
// window.showPage(). Os ids e className 'sidebar-link/active' precisam existir no DOM.
// Para não quebrar o JS, mantemos as classes que o script usa E adicionamos estilos Tailwind
// onde o JS não interfere.

type NavItem = {
  icon: string
  label: string
  page: string
  badgeId?: string
  badgeStyle?: React.CSSProperties
  isActive?: boolean
}

const navItems: NavItem[] = [
  { icon: '📊', label: 'Dashboard',           page: 'dashboard',    isActive: true },
  { icon: '📈', label: 'Analytics',            page: 'analytics'                   },
  { icon: '🏡', label: 'Propriedades',         page: 'propriedades', badgeId: 'badge-pendentes' },
  { icon: '👥', label: 'Usuários',             page: 'usuarios'                    },
  { icon: '⚠️', label: 'Cadastros Incompletos', page: 'incompletos',  badgeId: 'badge-incompletos', badgeStyle: { background: '#f59e0b' } },
  { icon: '💳', label: 'Assinaturas',          page: 'assinaturas'                 },
  { icon: '⭐', label: 'Planos',               page: 'planos'                      },
  { icon: '⚙️', label: 'Configurações',        page: 'config'                      },
  { icon: '💰', label: 'Receita & MRR',        page: 'financeiro'                  },
  { icon: '🎟️', label: 'Cupons',               page: 'cupons'                      },
  { icon: '✨', label: 'Qualidade',            page: 'qualidade'                   },
  { icon: '📣', label: 'Comunicação',          page: 'comunicacao'                 },
  { icon: '📋', label: 'Logs Admin',           page: 'logs'                        },
]

const sectionLabels: Record<string, string> = {
  dashboard:   'Visão Geral',
  propriedades:'Gestão',
  planos:      'Configurações',
  financeiro:  'Financeiro',
  qualidade:   'Plataforma',
}

export default function AdminSidebar() {
  return (
    <aside
      id="sidebar"
      className="w-[260px] flex-shrink-0 bg-[#111118] border-r border-white/[0.07] flex flex-col fixed top-0 left-0 h-screen z-[100] pt-7 pb-0"
    >
      {/* Logo */}
      <div className="px-6 pb-7 border-b border-white/[0.07] mb-6">
        <div className="font-['Syne',sans-serif] text-[1.4rem] font-extrabold tracking-[-0.5px]">
          VENT<em className="not-italic text-[#ff385c]">SY</em>
        </div>
        <div className="inline-flex items-center gap-1.5 bg-[rgba(255,56,92,0.12)] border border-[rgba(255,56,92,0.2)] rounded-full px-2.5 py-[2px] text-[0.65rem] font-bold text-[#ff385c] uppercase tracking-[0.1em] mt-1.5">
          ⚙️ Admin Central
        </div>
      </div>

      {/* Navegação */}
      <div className="flex-1 overflow-y-auto">
        {navItems.map((item) => (
          <div key={item.page}>
            {sectionLabels[item.page] && (
              <div className="text-[0.62rem] font-bold text-[#5c5c78] uppercase tracking-[0.12em] px-6 pb-2 mt-4">
                {sectionLabels[item.page]}
              </div>
            )}
            {/* sidebar-link e active são usados pelo admin.js — mantidos */}
            <div
              className={`sidebar-link flex items-center gap-3 px-6 py-[11px] text-[0.88rem] font-medium cursor-pointer transition-all relative
                ${item.isActive ? 'active text-[#ff385c] bg-[rgba(255,56,92,0.12)]' : 'text-[#a0a0b8] hover:text-[#f0f0f5] hover:bg-white/[0.03]'}`}
              onClick={() => window.showPage(item.page)}
            >
              {item.isActive && (
                <span className="absolute left-0 top-0 bottom-0 w-[3px] bg-[#ff385c] rounded-r" />
              )}
              <span className="text-[1.1rem] flex-shrink-0">{item.icon}</span>
              {item.label}
              {item.badgeId && (
                <span
                  id={item.badgeId}
                  className="ml-auto bg-[#ff385c] text-white text-[0.62rem] font-bold px-[7px] py-[2px] rounded-full min-w-[20px] text-center"
                  style={item.badgeStyle}
                >
                  0
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Rodapé */}
      <div className="border-t border-white/[0.07] px-6 pt-5 pb-6 mt-auto">
        <div className="flex items-center gap-2.5 mb-4">
          <div
            id="admin-avatar"
            className="w-9 h-9 bg-[#ff385c] rounded-full flex items-center justify-center font-['Syne',sans-serif] font-extrabold text-[0.85rem] text-white flex-shrink-0"
          >
            A
          </div>
          <div>
            <div id="admin-name" className="text-[0.82rem] font-semibold text-[#f0f0f5] leading-tight">Admin</div>
            <div className="text-[0.7rem] text-[#5c5c78]">Super Admin</div>
          </div>
        </div>
        <button
          className="w-full bg-transparent border border-white/[0.07] rounded-lg py-[9px] text-[0.82rem] text-[#a0a0b8] cursor-pointer font-['Inter',sans-serif] transition-all hover:border-[#ff385c] hover:text-[#ff385c]"
          onClick={() => window.doLogout()}
        >
          🚪 Sair
        </button>
      </div>
    </aside>
  )
}
