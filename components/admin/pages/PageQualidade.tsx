'use client'

export default function PageQualidade() {
  return (
    <div className="page" id="page-qualidade">
      {/* Score geral */}
      <div className="chart-card" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '28px', flexWrap: 'wrap' }}>
          <div className="quality-score-ring" id="quality-ring">—</div>
          <div style={{ flex: 1, minWidth: '200px' }}>
            <div className="chart-title" style={{ marginBottom: '6px' }}>Score de Qualidade da Plataforma</div>
            <div className="chart-sub" style={{ marginBottom: '12px' }}>
              Baseado em completude dos perfis de propriedades
            </div>
            <div id="quality-desc" style={{ fontSize: '0.84rem', color: 'var(--text2)', lineHeight: '1.8' }}>
              Calculando...
            </div>
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4,1fr)', marginBottom: '24px' }}>
        <div className="stat-card red">
          <div className="stat-icon red">🖼️</div>
          <div className="stat-value loading" id="q-sem-foto">—</div>
          <div className="stat-label">Sem foto</div>
          <div className="stat-sub">Propriedades sem imagem</div>
        </div>
        <div className="stat-card yellow">
          <div className="stat-icon yellow">📝</div>
          <div className="stat-value loading" id="q-sem-desc">—</div>
          <div className="stat-label">Sem descrição</div>
          <div className="stat-sub">Perfil incompleto</div>
        </div>
        <div className="stat-card yellow">
          <div className="stat-icon yellow">📱</div>
          <div className="stat-value loading" id="q-sem-wa">—</div>
          <div className="stat-label">Sem WhatsApp</div>
          <div className="stat-sub">Sem contato direto</div>
        </div>
        <div className="stat-card blue">
          <div className="stat-icon blue">😴</div>
          <div className="stat-value loading" id="q-sem-prop">—</div>
          <div className="stat-label">Sem propriedade</div>
          <div className="stat-sub">Usuários inativos</div>
        </div>
      </div>

      {/* Propriedades com problemas */}
      <div className="section-header">
        <div>
          <div className="section-title">🏡 Propriedades com perfil incompleto</div>
          <div className="section-count">Requerem atenção para melhor conversão</div>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => (window as any).exportQualidade()}>
          ⬇️ Exportar CSV
        </button>
      </div>
      <div className="table-card" style={{ marginBottom: '28px' }}>
        <table>
          <thead>
            <tr>
              <th>Propriedade</th><th>Dono</th><th>Problemas</th><th>Score</th><th>Ações</th>
            </tr>
          </thead>
          <tbody id="q-props-tbody"></tbody>
        </table>
      </div>

      {/* Usuários sem propriedade */}
      <div className="section-header">
        <div>
          <div className="section-title">👥 Usuários sem propriedade cadastrada</div>
          <div className="section-count">Oportunidade de engajamento / ativação</div>
        </div>
      </div>
      <div className="table-card" style={{ marginBottom: '28px' }}>
        <table>
          <thead>
            <tr>
              <th>Usuário</th><th>Plano</th><th>Cadastrado em</th><th>Ações</th>
            </tr>
          </thead>
          <tbody id="q-users-tbody"></tbody>
        </table>
      </div>

      {/* Buscas sem resultado */}
      <div className="section-header">
        <div>
          <div className="section-title">🔍 Buscas sem resultado</div>
          <div className="section-count">Termos que não encontraram propriedades — oportunidade de expansão</div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-ghost btn-sm" onClick={() => (window as any).recarregarBuscasSemResultado()}>
            🔄 Atualizar
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => (window as any).exportBuscasSemResultado()}>
            ⬇️ CSV
          </button>
        </div>
      </div>
      <div className="table-card">
        <div className="table-header" style={{ padding: '14px 24px' }}>
          <div style={{ fontSize: '0.78rem', color: 'var(--text3)' }}>
            Total de buscas sem resultado:{' '}
            <strong id="bsr-total" style={{ color: 'var(--text)' }}>—</strong>
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text3)' }}>Período: últimos 30 dias</div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Termo buscado</th><th>Ocorrências</th><th>Última busca</th><th>Ação sugerida</th>
            </tr>
          </thead>
          <tbody id="bsr-tbody">
            <tr>
              <td colSpan={4} style={{ textAlign: 'center', padding: '30px', color: 'var(--text3)' }}>
                Carregando...
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
