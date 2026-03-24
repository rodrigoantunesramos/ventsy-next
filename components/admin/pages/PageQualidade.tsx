'use client'

export default function PageQualidade() {
  return (
    <div className="page" id="page-qualidade">
      {/* Score geral */}
      <div className="chart-card mb-6">
        <div className="flex items-center gap-7 flex-wrap">
          <div className="quality-score-ring" id="quality-ring">—</div>
          <div className="flex-1 min-w-[200px]">
            <div className="chart-title mb-[6px]">Score de Qualidade da Plataforma</div>
            <div className="chart-sub mb-3">
              Baseado em completude dos perfis de propriedades
            </div>
            <div id="quality-desc" className="text-[0.84rem] text-[var(--text2)] leading-[1.8]">
              Calculando...
            </div>
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div className="stats-grid [grid-template-columns:repeat(4,1fr)] mb-6">
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
      <div className="table-card mb-7">
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
      <div className="table-card mb-7">
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
        <div className="flex gap-2">
          <button className="btn btn-ghost btn-sm" onClick={() => (window as any).recarregarBuscasSemResultado()}>
            🔄 Atualizar
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => (window as any).exportBuscasSemResultado()}>
            ⬇️ CSV
          </button>
        </div>
      </div>
      <div className="table-card">
        <div className="table-header py-[14px] px-6">
          <div className="text-[0.78rem] text-[var(--text3)]">
            Total de buscas sem resultado:{' '}
            <strong id="bsr-total" className="text-[var(--text)]">—</strong>
          </div>
          <div className="text-[0.78rem] text-[var(--text3)]">Período: últimos 30 dias</div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Termo buscado</th><th>Ocorrências</th><th>Última busca</th><th>Ação sugerida</th>
            </tr>
          </thead>
          <tbody id="bsr-tbody">
            <tr>
              <td colSpan={4} className="text-center p-[30px] text-[var(--text3)]">
                Carregando...
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
