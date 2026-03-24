'use client'

export default function PageLogs() {
  return (
    <div className="page" id="page-logs">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <div className="section-title">📋 Log de auditoria do admin</div>
          <div className="section-count" id="logs-count">Carregando...</div>
        </div>
        <div className="flex gap-[10px] items-center">
          <select
            className="select-inline"
            id="log-filter"
            onChange={() => (window as any).renderLogs()}
          >
            <option value="">Todos os tipos</option>
            <option value="propriedade">Propriedades</option>
            <option value="usuario">Usuários</option>
            <option value="assinatura">Assinaturas</option>
            <option value="cupom">Cupons</option>
            <option value="comunicacao">Comunicação</option>
            <option value="sistema">Sistema</option>
          </select>
          <button className="btn btn-danger btn-sm" onClick={() => (window as any).clearLogs()}>
            🗑️ Limpar logs
          </button>
        </div>
      </div>
      <div className="table-card">
        <div id="logs-list"></div>
      </div>
    </div>
  )
}
