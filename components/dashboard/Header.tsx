'use client'

export default function Header() {
  return (
    <header>
      <div className="header-left">
        <a href="/">
          <img src="/logovents.png" alt="Logo VENTSY" className="logo" />
        </a>
      </div>

      <div className="header-right">
        <button className="btn-sidebar-toggle">
          <span></span><span></span><span></span>
        </button>

        <div className="avatar-container">
          <button className="avatar-btn">
            <span>?</span>
          </button>

          <div className="avatar-dropdown">
            <div className="drop-header">
              <strong>Usuário</strong>
              <span>email@email.com</span>
            </div>

            <a href="/dashboard">🏠 Dashboard</a>
            <a href="/dashboard/propriedade">🏡 Minha Propriedade</a>
            <a href="/dashboard/configuracoes">⚙️ Configurações</a>

            <button className="drop-sair">🚪 Sair</button>
          </div>
        </div>
      </div>
    </header>
  )
}