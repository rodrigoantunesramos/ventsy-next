'use client'

export default function PageDashboard() {
  return (
    <div className="page active" id="page-dashboard">
      {/* Stats principais */}
      <div className="grid grid-cols-4 gap-4 mb-8" id="stats-grid">
        <div className="bg-[#111118] border border-white/[0.07] rounded-2xl p-6 relative overflow-hidden transition-[border-color,transform] duration-200 hover:border-white/[0.12] hover:-translate-y-0.5 before:content-[''] before:absolute before:top-0 before:left-0 before:right-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-[#ff385c] before:to-transparent">
          <div className="w-[42px] h-[42px] rounded-[10px] flex items-center justify-center text-[1.2rem] mb-4 bg-[rgba(255,56,92,0.12)]">👥</div>
          <div className="font-['Syne',sans-serif] text-[2rem] font-extrabold text-[#f0f0f5] leading-none mb-1.5 loading" id="s-usuarios">—</div>
          <div className="text-[0.8rem] text-[#a0a0b8] font-medium">Usuários cadastrados</div>
          <div className="text-[0.72rem] text-[#5c5c78] mt-1" id="s-usuarios-sub">carregando...</div>
        </div>
        <div className="bg-[#111118] border border-white/[0.07] rounded-2xl p-6 relative overflow-hidden transition-[border-color,transform] duration-200 hover:border-white/[0.12] hover:-translate-y-0.5 before:content-[''] before:absolute before:top-0 before:left-0 before:right-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-[#0ca678] before:to-transparent">
          <div className="w-[42px] h-[42px] rounded-[10px] flex items-center justify-center text-[1.2rem] mb-4 bg-[rgba(12,166,120,0.12)]">🏡</div>
          <div className="font-['Syne',sans-serif] text-[2rem] font-extrabold text-[#f0f0f5] leading-none mb-1.5 loading" id="s-props">—</div>
          <div className="text-[0.8rem] text-[#a0a0b8] font-medium">Propriedades</div>
          <div className="text-[0.72rem] text-[#5c5c78] mt-1" id="s-props-sub">carregando...</div>
        </div>
        <div className="bg-[#111118] border border-white/[0.07] rounded-2xl p-6 relative overflow-hidden transition-[border-color,transform] duration-200 hover:border-white/[0.12] hover:-translate-y-0.5 before:content-[''] before:absolute before:top-0 before:left-0 before:right-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-[#f59e0b] before:to-transparent">
          <div className="w-[42px] h-[42px] rounded-[10px] flex items-center justify-center text-[1.2rem] mb-4 bg-[rgba(245,158,11,0.12)]">👁</div>
          <div className="font-['Syne',sans-serif] text-[2rem] font-extrabold text-[#f0f0f5] leading-none mb-1.5 loading" id="s-views">—</div>
          <div className="text-[0.8rem] text-[#a0a0b8] font-medium">Visualizações (30d)</div>
          <div className="text-[0.72rem] text-[#5c5c78] mt-1">Todas as propriedades</div>
        </div>
        <div className="bg-[#111118] border border-white/[0.07] rounded-2xl p-6 relative overflow-hidden transition-[border-color,transform] duration-200 hover:border-white/[0.12] hover:-translate-y-0.5 before:content-[''] before:absolute before:top-0 before:left-0 before:right-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-[#3b82f6] before:to-transparent">
          <div className="w-[42px] h-[42px] rounded-[10px] flex items-center justify-center text-[1.2rem] mb-4 bg-[rgba(59,130,246,0.12)]">💳</div>
          <div className="font-['Syne',sans-serif] text-[2rem] font-extrabold text-[#f0f0f5] leading-none mb-1.5 loading" id="s-assinaturas">—</div>
          <div className="text-[0.8rem] text-[#a0a0b8] font-medium">Assinaturas ativas</div>
          <div className="text-[0.72rem] text-[#5c5c78] mt-1" id="s-assinaturas-sub">carregando...</div>
        </div>
      </div>

      {/* Stats secundárias */}
      <div className="grid grid-cols-3 gap-4 mb-8 -mt-2">
        <div className="bg-[#111118] border border-white/[0.07] rounded-2xl p-6 relative overflow-hidden transition-[border-color,transform] duration-200 hover:border-white/[0.12] hover:-translate-y-0.5 before:content-[''] before:absolute before:top-0 before:left-0 before:right-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-[#8b5cf6] before:to-transparent">
          <div className="w-[42px] h-[42px] rounded-[10px] flex items-center justify-center text-[1.2rem] mb-4 bg-[rgba(139,92,246,0.12)]">📱</div>
          <div className="font-['Syne',sans-serif] text-[2rem] font-extrabold text-[#f0f0f5] leading-none mb-1.5 loading" id="s-whatsapp">—</div>
          <div className="text-[0.8rem] text-[#a0a0b8] font-medium">Cliques WhatsApp (30d)</div>
        </div>
        <div className="bg-[#111118] border border-white/[0.07] rounded-2xl p-6 relative overflow-hidden transition-[border-color,transform] duration-200 hover:border-white/[0.12] hover:-translate-y-0.5 before:content-[''] before:absolute before:top-0 before:left-0 before:right-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-[#f59e0b] before:to-transparent">
          <div className="w-[42px] h-[42px] rounded-[10px] flex items-center justify-center text-[1.2rem] mb-4 bg-[rgba(245,158,11,0.12)]">💬</div>
          <div className="font-['Syne',sans-serif] text-[2rem] font-extrabold text-[#f0f0f5] leading-none mb-1.5 loading" id="s-form">—</div>
          <div className="text-[0.8rem] text-[#a0a0b8] font-medium">Cliques Formulário (30d)</div>
        </div>
        <div className="bg-[#111118] border border-white/[0.07] rounded-2xl p-6 relative overflow-hidden transition-[border-color,transform] duration-200 hover:border-white/[0.12] hover:-translate-y-0.5 before:content-[''] before:absolute before:top-0 before:left-0 before:right-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-[#0ca678] before:to-transparent">
          <div className="w-[42px] h-[42px] rounded-[10px] flex items-center justify-center text-[1.2rem] mb-4 bg-[rgba(12,166,120,0.12)]">⏳</div>
          <div className="font-['Syne',sans-serif] text-[2rem] font-extrabold text-[#f0f0f5] leading-none mb-1.5 loading" id="s-pendentes">—</div>
          <div className="text-[0.8rem] text-[#a0a0b8] font-medium">Aguardando liberação</div>
          <div className="text-[0.72rem] text-[#5c5c78] mt-1">Revisão necessária</div>
        </div>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-[1.6fr_1fr] gap-4 mb-8 mt-6">
        <div className="bg-[#111118] border border-white/[0.07] rounded-2xl p-6">
          <div className="font-['Syne',sans-serif] text-[0.95rem] font-bold mb-1">Atividade na plataforma — 30 dias</div>
          <div className="text-[0.75rem] text-[#5c5c78] mb-5">Visualizações, WhatsApp e Formulários</div>
          <div className="h-[220px] relative">
            <canvas id="chart-atividade"></canvas>
          </div>
        </div>
        <div className="bg-[#111118] border border-white/[0.07] rounded-2xl p-6">
          <div className="font-['Syne',sans-serif] text-[0.95rem] font-bold mb-1">Distribuição de planos</div>
          <div className="text-[0.75rem] text-[#5c5c78] mb-5">Assinaturas ativas</div>
          <div className="h-[220px] relative flex items-center justify-center">
            <canvas id="chart-planos"></canvas>
          </div>
        </div>
      </div>

      {/* Propriedades pendentes */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <div className="font-['Syne',sans-serif] text-[1.05rem] font-bold text-[#f0f0f5]">🏡 Propriedades pendentes de liberação</div>
          <div className="text-[0.75rem] text-[#5c5c78] mt-0.5" id="pending-count">Carregando...</div>
        </div>
      </div>
      <div id="pendentes-list" className="flex flex-col gap-3 mb-8">
        <div className="empty-state"><div className="icon">⏳</div><p>Carregando...</p></div>
      </div>

      {/* Últimos usuários */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <div className="font-['Syne',sans-serif] text-[1.05rem] font-bold text-[#f0f0f5]">👥 Usuários recentes</div>
          <div className="text-[0.75rem] text-[#5c5c78] mt-0.5">Últimos cadastros</div>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => window.showPage('usuarios')}>
          Ver todos →
        </button>
      </div>
      <div className="bg-[#111118] border border-white/[0.07] rounded-2xl overflow-hidden">
        <table>
          <thead>
            <tr>
              <th>Usuário</th><th>Plano</th><th>Status</th><th>Cadastrado</th><th>Ações</th>
            </tr>
          </thead>
          <tbody id="recent-users">
            <tr>
              <td colSpan={5} className="empty-state p-[40px] text-center text-[var(--text3)]">
                Carregando...
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
