'use client'

export default function PagePropriedades() {
  return (
    <div className="page" id="page-propriedades">
      <div className="table-card">
        <div className="table-header">
          <div className="section-title">Todas as propriedades</div>
          <div className="table-search">
            🔍
            <input
              type="text"
              placeholder="Buscar propriedade..."
              id="search-props"
              onInput={() => (window as any).filterProps()}
            />
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Propriedade</th><th>Dono</th><th>Status</th><th>Plano</th><th>Localização</th><th>Ações</th>
            </tr>
          </thead>
          <tbody id="props-tbody"></tbody>
        </table>
      </div>
    </div>
  )
}
