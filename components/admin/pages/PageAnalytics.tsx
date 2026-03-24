'use client'

export default function PageAnalytics() {
  return (
    <div className="page" id="page-analytics">
      <div className="stats-grid mb-6">
        <div className="stat-card red">
          <div className="stat-icon red">👁</div>
          <div className="stat-value loading" id="an-total-views">—</div>
          <div className="stat-label">Total Visualizações</div>
          <div className="stat-sub">Histórico completo</div>
        </div>
        <div className="stat-card green">
          <div className="stat-icon green">📱</div>
          <div className="stat-value loading" id="an-total-wa">—</div>
          <div className="stat-label">Total Cliques WhatsApp</div>
        </div>
        <div className="stat-card blue">
          <div className="stat-icon blue">💬</div>
          <div className="stat-value loading" id="an-total-form">—</div>
          <div className="stat-label">Total Cliques Formulário</div>
        </div>
        <div className="stat-card purple">
          <div className="stat-icon purple">🎯</div>
          <div className="stat-value loading" id="an-ctr">—</div>
          <div className="stat-label">CTR — Cliques/Visualizações</div>
          <div className="stat-sub">WhatsApp ÷ Views</div>
        </div>
      </div>

      <div className="stats-grid [grid-template-columns:1fr] mb-6">
        <div className="stat-card yellow">
          <div className="stat-icon yellow">🏆</div>
          <div className="stat-value loading text-[1.2rem]" id="an-top-prop">—</div>
          <div className="stat-label">Propriedade mais vista</div>
        </div>
      </div>

      <div className="chart-card mb-6">
        <div className="chart-title">Volume de eventos por tipo</div>
        <div className="chart-sub">Distribuição histórica</div>
        <div className="h-[280px] relative">
          <canvas id="chart-eventos-tipo"></canvas>
        </div>
      </div>

      <div className="section-header">
        <div className="section-title">📊 Ranking de propriedades</div>
      </div>
      <div className="table-card">
        <table>
          <thead>
            <tr>
              <th>#</th><th>Propriedade</th><th>Visualizações</th><th>WhatsApp</th><th>Formulário</th><th>Total</th>
            </tr>
          </thead>
          <tbody id="ranking-props"></tbody>
        </table>
      </div>
    </div>
  )
}
