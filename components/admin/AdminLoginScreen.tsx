export default function AdminLoginScreen() {
  return (
    <div id="login-screen">
      <div className="login-card">
        <div className="login-logo"><em>VENTSY</em></div>
        <div className="login-badge">🔐 Painel Admin</div>
        <div className="login-label">E-mail</div>
        <input
          type="email"
          className="login-input"
          id="login-email"
          placeholder="admin@ventsy.com.br"
        />
        <div className="login-label">Senha</div>
        <input
          type="password"
          className="login-input"
          id="login-password"
          placeholder="••••••••"
        />
        <button
          className="login-btn"
          onClick={() => (window as any).doLogin()}
        >
          Entrar como Admin
        </button>
        <div className="login-err" id="login-err">E-mail ou senha incorretos.</div>
      </div>
    </div>
  )
}
