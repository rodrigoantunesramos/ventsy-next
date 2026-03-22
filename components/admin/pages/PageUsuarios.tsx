'use client'

export default function PageUsuarios() {
  return (
    <div className="page" id="page-usuarios">
      <div
        className="alert-banner info"
        style={{ marginBottom: '16px' }}
      >
        ℹ️ Apenas usuários que <strong>completaram o cadastro</strong> (preencheram o perfil) aparecem aqui.
        Usuários que criaram conta mas não concluíram ficam somente em <code>auth.users</code> no Supabase.
      </div>
      <div className="table-card">
        <div className="table-header">
          <div className="section-title">Todos os usuários</div>
          <div className="table-search">
            🔍
            <input
              type="text"
              placeholder="Buscar usuário..."
              id="search-users"
              onInput={() => (window as any).filterUsers()}
            />
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Usuário</th><th>Handle</th><th>Plano</th><th>Status Assinatura</th><th>Cadastrado</th><th>Ações</th>
            </tr>
          </thead>
          <tbody id="users-tbody"></tbody>
        </table>
      </div>
    </div>
  )
}
