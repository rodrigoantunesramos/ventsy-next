'use client'

export default function PageQualidade() {
  return (
    <div className="page" id="page-qualidade">
      {/* Score geral */}
      <div className="bg-[#111118] border border-white/[0.07] rounded-2xl p-6 mb-6">
        <div className="flex items-center gap-7 flex-wrap">
          <div className="w-[110px] h-[110px] rounded-full flex items-center justify-center font-['Syne',sans-serif] text-[1.9rem] font-extrabold flex-shrink-0 transition-all duration-[600ms]" id="quality-ring">—</div>
          <div className="flex-1 min-w-[200px]">
            <div className="font-['Syne',sans-serif] text-[0.95rem] font-bold mb-[6px]">Score de Qualidade da Plataforma</div>
            <div className="text-[0.75rem] text-[#5c5c78] mb-3">
              Baseado em completude dos perfis de propriedades
            </div>
            <div id="quality-desc" className="text-[0.84rem] text-[var(--text2)] leading-[1.8]">
              Calculando...
            </div>
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-[#111118] border border-white/[0.07] rounded-2xl p-6 relative overflow-hidden transition-[border-color,transform] duration-200 hover:border-white/[0.12] hover:-translate-y-0.5 before:content-[''] before:absolute before:top-0 before:left-0 before:right-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-[#ff385c] before:to-transparent">
          <div className="w-[42px] h-[42px] rounded-[10px] flex items-center justify-center text-[1.2rem] mb-4 bg-[rgba(255,56,92,0.12)]">🖼️</div>
          <div className="font-['Syne',sans-serif] text-[2rem] font-extrabold text-[#f0f0f5] leading-none mb-1.5 loading" id="q-sem-foto">—</div>
          <div className="text-[0.8rem] text-[#a0a0b8] font-medium">Sem foto</div>
          <div className="text-[0.72rem] text-[#5c5c78] mt-1">Propriedades sem imagem</div>
        </div>
        <div className="bg-[#111118] border border-white/[0.07] rounded-2xl p-6 relative overflow-hidden transition-[border-color,transform] duration-200 hover:border-white/[0.12] hover:-translate-y-0.5 before:content-[''] before:absolute before:top-0 before:left-0 before:right-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-[#f59e0b] before:to-transparent">
          <div className="w-[42px] h-[42px] rounded-[10px] flex items-center justify-center text-[1.2rem] mb-4 bg-[rgba(245,158,11,0.12)]">📝</div>
          <div className="font-['Syne',sans-serif] text-[2rem] font-extrabold text-[#f0f0f5] leading-none mb-1.5 loading" id="q-sem-desc">—</div>
          <div className="text-[0.8rem] text-[#a0a0b8] font-medium">Sem descrição</div>
          <div className="text-[0.72rem] text-[#5c5c78] mt-1">Perfil incompleto</div>
        </div>
        <div className="bg-[#111118] border border-white/[0.07] rounded-2xl p-6 relative overflow-hidden transition-[border-color,transform] duration-200 hover:border-white/[0.12] hover:-translate-y-0.5 before:content-[''] before:absolute before:top-0 before:left-0 before:right-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-[#f59e0b] before:to-transparent">
          <div className="w-[42px] h-[42px] rounded-[10px] flex items-center justify-center text-[1.2rem] mb-4 bg-[rgba(245,158,11,0.12)]">📱</div>
          <div className="font-['Syne',sans-serif] text-[2rem] font-extrabold text-[#f0f0f5] leading-none mb-1.5 loading" id="q-sem-wa">—</div>
          <div className="text-[0.8rem] text-[#a0a0b8] font-medium">Sem WhatsApp</div>
          <div className="text-[0.72rem] text-[#5c5c78] mt-1">Sem contato direto</div>
        </div>
        <div className="bg-[#111118] border border-white/[0.07] rounded-2xl p-6 relative overflow-hidden transition-[border-color,transform] duration-200 hover:border-white/[0.12] hover:-translate-y-0.5 before:content-[''] before:absolute before:top-0 before:left-0 before:right-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-[#3b82f6] before:to-transparent">
          <div className="w-[42px] h-[42px] rounded-[10px] flex items-center justify-center text-[1.2rem] mb-4 bg-[rgba(59,130,246,0.12)]">😴</div>
          <div className="font-['Syne',sans-serif] text-[2rem] font-extrabold text-[#f0f0f5] leading-none mb-1.5 loading" id="q-sem-prop">—</div>
          <div className="text-[0.8rem] text-[#a0a0b8] font-medium">Sem propriedade</div>
          <div className="text-[0.72rem] text-[#5c5c78] mt-1">Usuários inativos</div>
        </div>
      </div>

      {/* Propriedades com problemas */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <div className="font-['Syne',sans-serif] text-[1.05rem] font-bold text-[#f0f0f5]">🏡 Propriedades com perfil incompleto</div>
          <div className="text-[0.75rem] text-[#5c5c78] mt-0.5">Requerem atenção para melhor conversão</div>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => (window as any).exportQualidade()}>
          ⬇️ Exportar CSV
        </button>
      </div>
      <div className="bg-[#111118] border border-white/[0.07] rounded-2xl overflow-hidden mb-7">
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
      <div className="flex items-center justify-between mb-5">
        <div>
          <div className="font-['Syne',sans-serif] text-[1.05rem] font-bold text-[#f0f0f5]">👥 Usuários sem propriedade cadastrada</div>
          <div className="text-[0.75rem] text-[#5c5c78] mt-0.5">Oportunidade de engajamento / ativação</div>
        </div>
      </div>
      <div className="bg-[#111118] border border-white/[0.07] rounded-2xl overflow-hidden mb-7">
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
      <div className="flex items-center justify-between mb-5">
        <div>
          <div className="font-['Syne',sans-serif] text-[1.05rem] font-bold text-[#f0f0f5]">🔍 Buscas sem resultado</div>
          <div className="text-[0.75rem] text-[#5c5c78] mt-0.5">Termos que não encontraram propriedades — oportunidade de expansão</div>
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
      <div className="bg-[#111118] border border-white/[0.07] rounded-2xl overflow-hidden">
        <div className="px-6 py-[14px] border-b border-white/[0.07] flex items-center justify-between">
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
