'use client'

export default function PageIncompletos() {
  return (
    <div className="page" id="page-incompletos">
      {/* Banner de aviso */}
      <div style={{
        background: 'rgba(245,158,11,0.1)',
        border: '1px solid rgba(245,158,11,0.3)',
        borderRadius: '12px',
        padding: '16px 20px',
        marginBottom: '20px',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '12px',
      }}>
        <span style={{ fontSize: '1.3rem' }}>⚠️</span>
        <div>
          <div style={{ fontWeight: 700, color: 'var(--yellow)', marginBottom: '4px' }}>
            Usuários que não finalizaram o cadastro
          </div>
          <div style={{ fontSize: '0.82rem', color: 'var(--text2)' }}>
            Estas pessoas criaram uma conta mas <strong>não preencheram o perfil</strong>.
            Entre em contato para não perder esses clientes. O e-mail real é enviado via Resend.
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3,1fr)', marginBottom: '24px' }}>
        <div className="stat-card yellow">
          <div className="stat-icon yellow">⚠️</div>
          <div className="stat-value loading" id="inc-total">—</div>
          <div className="stat-label">Cadastros incompletos</div>
        </div>
        <div className="stat-card red">
          <div className="stat-icon red">📅</div>
          <div className="stat-value loading" id="inc-hoje">—</div>
          <div className="stat-label">Incompletos hoje</div>
        </div>
        <div className="stat-card blue">
          <div className="stat-icon blue">📧</div>
          <div className="stat-value loading" id="inc-emails">—</div>
          <div className="stat-label">E-mails disponíveis</div>
        </div>
      </div>

      {/* Tabela */}
      <div className="table-card">
        <div className="table-header" style={{ flexWrap: 'wrap', gap: '10px' }}>
          <div className="section-title">📋 Lista de cadastros incompletos</div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button className="btn btn-ghost btn-sm" onClick={() => (window as any).recarregarIncompletos()}>
              🔄 Atualizar
            </button>
            <button className="btn btn-warn btn-sm" onClick={() => (window as any).emailTodosIncompletos()}>
              📧 E-mail para todos
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => (window as any).exportIncompletos()}>
              ⬇️ Exportar CSV
            </button>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>E-mail</th><th>Cadastrado em</th><th>Tempo sem completar</th><th>Ações</th>
            </tr>
          </thead>
          <tbody id="inc-tbody">
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
