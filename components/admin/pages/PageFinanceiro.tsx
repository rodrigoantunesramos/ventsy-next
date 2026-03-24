'use client'

export default function PageFinanceiro() {
  return (
    <div className="page" id="page-financeiro">
      <div id="fin-alerts"></div>

      {/* KPIs principais */}
      <div className="stats-grid mb-4">
        <div className="stat-card green">
          <div className="stat-icon green">💵</div>
          <div className="stat-value loading" id="fin-mrr">—</div>
          <div className="stat-label">MRR</div>
          <div className="stat-sub">Receita Mensal Recorrente</div>
        </div>
        <div className="stat-card blue">
          <div className="stat-icon blue">📅</div>
          <div className="stat-value loading" id="fin-arr">—</div>
          <div className="stat-label">ARR</div>
          <div className="stat-sub">Receita Anual Recorrente</div>
        </div>
        <div className="stat-card purple">
          <div className="stat-icon purple">💳</div>
          <div className="stat-value loading" id="fin-total">—</div>
          <div className="stat-label">Receita Total</div>
          <div className="stat-sub">Histórico de pagamentos</div>
        </div>
        <div className="stat-card yellow">
          <div className="stat-icon yellow">👤</div>
          <div className="stat-value loading" id="fin-arpu">—</div>
          <div className="stat-label">ARPU</div>
          <div className="stat-sub">Receita por usuário ativo</div>
        </div>
      </div>

      <div className="stats-grid [grid-template-columns:repeat(3,1fr)] mb-6">
        <div className="stat-card red">
          <div className="stat-icon red">📉</div>
          <div className="stat-value loading" id="fin-churn">—</div>
          <div className="stat-label">Taxa de Churn</div>
          <div className="stat-sub">Cancelamentos / Total</div>
        </div>
        <div className="stat-card green">
          <div className="stat-icon green">🏆</div>
          <div className="stat-value loading" id="fin-ltv">—</div>
          <div className="stat-label">LTV Estimado</div>
          <div className="stat-sub">Valor médio por cliente</div>
        </div>
        <div className="stat-card blue">
          <div className="stat-icon blue">⬆️</div>
          <div className="stat-value loading" id="fin-novos-mrr">—</div>
          <div className="stat-label">Novos MRR (30d)</div>
          <div className="stat-sub">Assinaturas novas este mês</div>
        </div>
      </div>

      {/* Gráficos */}
      <div className="charts-grid mb-6">
        <div className="chart-card">
          <div className="chart-title">Evolução da receita — 6 meses</div>
          <div className="chart-sub">Receita realizada por mês (valor_pago)</div>
          <div className="h-[240px] relative">
            <canvas id="chart-receita-mensal"></canvas>
          </div>
        </div>
        <div className="chart-card">
          <div className="chart-title">MRR por plano</div>
          <div className="chart-sub">Distribuição da receita recorrente atual</div>
          <div className="h-[240px] relative flex items-center justify-center">
            <canvas id="chart-receita-planos"></canvas>
          </div>
        </div>
      </div>

      {/* Breakdown por plano */}
      <div className="section-header mb-4">
        <div className="section-title">📊 Breakdown por plano</div>
      </div>
      <div className="table-card mb-7">
        <table>
          <thead>
            <tr>
              <th>Plano</th><th>Assinantes ativos</th><th>Preço</th><th>MRR</th><th>% da receita</th>
            </tr>
          </thead>
          <tbody id="fin-breakdown-tbody"></tbody>
        </table>
      </div>

      {/* Vencimentos */}
      <div className="section-header">
        <div>
          <div className="section-title">⏰ Vencimentos nos próximos 30 dias</div>
          <div className="section-count" id="fin-venc-count">Carregando...</div>
        </div>
      </div>
      <div className="table-card mb-7">
        <table>
          <thead>
            <tr>
              <th>Usuário</th><th>Plano</th><th>Vence em</th><th>Dias restantes</th><th>Ações</th>
            </tr>
          </thead>
          <tbody id="fin-venc-tbody"></tbody>
        </table>
      </div>

      {/* Histórico de pagamentos */}
      <div className="section-header">
        <div className="section-title">💳 Histórico de pagamentos</div>
      </div>
      <div className="table-card">
        <table>
          <thead>
            <tr>
              <th>Usuário</th><th>Plano</th><th>Valor</th><th>Início</th><th>Status</th>
            </tr>
          </thead>
          <tbody id="fin-pagamentos-tbody"></tbody>
        </table>
      </div>
    </div>
  )
}
