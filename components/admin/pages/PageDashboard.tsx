'use client'

export default function PageDashboard() {
  return (
    <div className="page active" id="page-dashboard">
      {/* Stats principais */}
      <div className="stats-grid" id="stats-grid">
        <div className="stat-card red">
          <div className="stat-icon red">👥</div>
          <div className="stat-value loading" id="s-usuarios">—</div>
          <div className="stat-label">Usuários cadastrados</div>
          <div className="stat-sub" id="s-usuarios-sub">carregando...</div>
        </div>
        <div className="stat-card green">
          <div className="stat-icon green">🏡</div>
          <div className="stat-value loading" id="s-props">—</div>
          <div className="stat-label">Propriedades</div>
          <div className="stat-sub" id="s-props-sub">carregando...</div>
        </div>
        <div className="stat-card yellow">
          <div className="stat-icon yellow">👁</div>
          <div className="stat-value loading" id="s-views">—</div>
          <div className="stat-label">Visualizações (30d)</div>
          <div className="stat-sub">Todas as propriedades</div>
        </div>
        <div className="stat-card blue">
          <div className="stat-icon blue">💳</div>
          <div className="stat-value loading" id="s-assinaturas">—</div>
          <div className="stat-label">Assinaturas ativas</div>
          <div className="stat-sub" id="s-assinaturas-sub">carregando...</div>
        </div>
      </div>

      {/* Stats secundárias */}
      <div className="stats-grid [grid-template-columns:repeat(3,1fr)] -mt-2">
        <div className="stat-card purple">
          <div className="stat-icon purple">📱</div>
          <div className="stat-value loading" id="s-whatsapp">—</div>
          <div className="stat-label">Cliques WhatsApp (30d)</div>
        </div>
        <div className="stat-card yellow">
          <div className="stat-icon yellow">💬</div>
          <div className="stat-value loading" id="s-form">—</div>
          <div className="stat-label">Cliques Formulário (30d)</div>
        </div>
        <div className="stat-card green">
          <div className="stat-icon green">⏳</div>
          <div className="stat-value loading" id="s-pendentes">—</div>
          <div className="stat-label">Aguardando liberação</div>
          <div className="stat-sub">Revisão necessária</div>
        </div>
      </div>

      {/* Gráficos */}
      <div className="charts-grid mt-6">
        <div className="chart-card">
          <div className="chart-title">Atividade na plataforma — 30 dias</div>
          <div className="chart-sub">Visualizações, WhatsApp e Formulários</div>
          <div className="h-[220px] relative">
            <canvas id="chart-atividade"></canvas>
          </div>
        </div>
        <div className="chart-card">
          <div className="chart-title">Distribuição de planos</div>
          <div className="chart-sub">Assinaturas ativas</div>
          <div className="h-[220px] relative flex items-center justify-center">
            <canvas id="chart-planos"></canvas>
          </div>
        </div>
      </div>

      {/* Propriedades pendentes */}
      <div className="section-header">
        <div>
          <div className="section-title">🏡 Propriedades pendentes de liberação</div>
          <div className="section-count" id="pending-count">Carregando...</div>
        </div>
      </div>
      <div id="pendentes-list" className="flex flex-col gap-3 mb-8">
        <div className="empty-state"><div className="icon">⏳</div><p>Carregando...</p></div>
      </div>

      {/* Últimos usuários */}
      <div className="section-header">
        <div>
          <div className="section-title">👥 Usuários recentes</div>
          <div className="section-count">Últimos cadastros</div>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => (window as any).showPage('usuarios')}>
          Ver todos →
        </button>
      </div>
      <div className="table-card">
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
