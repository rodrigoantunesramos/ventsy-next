// Tela de login do Admin
// O admin.js manipula este elemento via id="login-screen" — ids preservados.
export default function AdminLoginScreen() {
  return (
    <div
      id="login-screen"
      className="fixed inset-0 bg-[#0a0a0f] hidden items-center justify-center z-[9998]"
    >
      <div className="w-[400px] bg-[#111118] border border-white/[0.12] rounded-[20px] px-10 py-12">
        <div className="font-['Syne',sans-serif] text-[1.8rem] font-extrabold tracking-[-1px] mb-1.5">
          VENT<em className="not-italic text-[#ff385c]">SY</em>
        </div>
        <div className="inline-flex items-center gap-1.5 bg-[rgba(255,56,92,0.12)] border border-[rgba(255,56,92,0.3)] rounded-full px-3 py-1 text-[0.7rem] font-semibold text-[#ff385c] uppercase tracking-[0.1em] mb-8">
          🔐 Painel Admin
        </div>

        <div className="text-[0.75rem] font-semibold text-[#a0a0b8] uppercase tracking-[0.08em] mb-2">E-mail</div>
        <input
          type="email"
          id="login-email"
          placeholder="admin@ventsy.com.br"
          className="w-full px-4 py-3 bg-[#1a1a24] border border-white/[0.07] rounded-[10px] text-[0.9rem] text-[#f0f0f5] font-['Inter',sans-serif] mb-4 outline-none transition-colors focus:border-[#ff385c]"
        />

        <div className="text-[0.75rem] font-semibold text-[#a0a0b8] uppercase tracking-[0.08em] mb-2">Senha</div>
        <input
          type="password"
          id="login-password"
          placeholder="••••••••"
          className="w-full px-4 py-3 bg-[#1a1a24] border border-white/[0.07] rounded-[10px] text-[0.9rem] text-[#f0f0f5] font-['Inter',sans-serif] mb-4 outline-none transition-colors focus:border-[#ff385c]"
        />

        <button
          className="w-full py-3.5 mt-2 bg-[#ff385c] border-none rounded-[10px] font-['Syne',sans-serif] text-[0.95rem] font-bold text-white cursor-pointer transition-all hover:opacity-90 hover:scale-[1.01]"
          onClick={() => (window as any).doLogin()}
        >
          Entrar como Admin
        </button>

        <div id="login-err" className="hidden text-[#ff385c] text-[0.82rem] mt-3">
          E-mail ou senha incorretos.
        </div>
      </div>
    </div>
  )
}
