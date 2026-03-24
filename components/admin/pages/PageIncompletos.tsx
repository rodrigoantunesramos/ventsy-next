'use client'

export default function PageIncompletos() {
  return (
    <div className="page" id="page-incompletos">
      {/* Banner de aviso */}
      <div className="bg-[rgba(245,158,11,0.1)] border border-[rgba(245,158,11,0.3)] rounded-xl px-5 py-4 mb-5 flex items-start gap-3">
        <span className="text-[1.3rem]">⚠️</span>
        <div>
          <div className="font-bold text-[var(--yellow)] mb-1">
            Usuários que não finalizaram o cadastro
          </div>
          <div className="text-[0.82rem] text-[var(--text2)]">
            Estas pessoas criaram uma conta mas <strong>não preencheram o perfil</strong>.
            Entre em contato para não perder esses clientes. O e-mail real é enviado via Resend.
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="stats-grid [grid-template-columns:repeat(3,1fr)] mb-6">
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
        <div className="table-header flex-wrap gap-[10px]">
          <div className="section-title">📋 Lista de cadastros incompletos</div>
          <div className="flex gap-2 flex-wrap">
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
