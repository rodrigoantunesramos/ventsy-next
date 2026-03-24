'use client'

export default function PageUsuarios() {
  return (
    <div className="page" id="page-usuarios">
      <div className="bg-[rgba(59,130,246,0.08)] border border-[rgba(59,130,246,0.25)] rounded-xl px-5 py-4 mb-4 text-[0.84rem] text-[#a0a0b8]">
        ℹ️ Apenas usuários que <strong>completaram o cadastro</strong> (preencheram o perfil) aparecem aqui.
        Usuários que criaram conta mas não concluíram ficam somente em <code>auth.users</code> no Supabase.
      </div>
      <div className="bg-[#111118] border border-white/[0.07] rounded-2xl overflow-hidden">
        <div className="px-6 py-5 border-b border-white/[0.07] flex items-center justify-between">
          <div className="font-['Syne',sans-serif] text-[1.05rem] font-bold text-[#f0f0f5]">Todos os usuários</div>
          <div className="flex items-center gap-2 bg-[#1a1a24] border border-white/[0.07] rounded-lg px-3.5 py-2 text-[0.82rem] text-[#a0a0b8]">
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
