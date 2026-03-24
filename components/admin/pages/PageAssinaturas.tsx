'use client'

export default function PageAssinaturas() {
  return (
    <div className="page" id="page-assinaturas">
      <div className="stats-grid grid-cols-3 mb-6">
        <div className="stat-card green">
          <div className="stat-icon green">✅</div>
          <div className="stat-value loading" id="ass-ativas">—</div>
          <div className="stat-label">Assinaturas ativas</div>
        </div>
        <div className="stat-card yellow">
          <div className="stat-icon yellow">🎁</div>
          <div className="stat-value loading" id="ass-trial">—</div>
          <div className="stat-label">Em período trial</div>
        </div>
        <div className="stat-card red">
          <div className="stat-icon red">❌</div>
          <div className="stat-value loading" id="ass-canc">—</div>
          <div className="stat-label">Canceladas</div>
        </div>
      </div>
      <div className="table-card">
        <div className="table-header">
          <div className="section-title">Todas as assinaturas</div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Usuário</th><th>Plano</th><th>Status</th><th>Início</th><th>Fim</th><th>Valor</th><th>Ações</th>
            </tr>
          </thead>
          <tbody id="ass-tbody"></tbody>
        </table>
      </div>
    </div>
  )
}
