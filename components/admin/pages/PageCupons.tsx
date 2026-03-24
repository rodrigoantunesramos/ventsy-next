'use client'

export default function PageCupons() {
  return (
    <div className="page" id="page-cupons">
      <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_1fr] gap-5 items-start">
        {/* Formulário de criação */}
        <div className="bg-[#111118] border border-white/[0.07] rounded-2xl p-7 mb-5">
          <div className="font-['Syne',sans-serif] text-[1.05rem] font-bold text-[#f0f0f5] mb-5">➕ Criar cupom</div>
          <div className="block text-[0.72rem] font-bold text-[#5c5c78] uppercase tracking-[0.08em] mb-1.5">Código do cupom</div>
          <input
            type="text"
            className="w-full px-3.5 py-[11px] bg-[#1a1a24] border border-white/[0.07] rounded-lg font-['Inter',sans-serif] text-[0.88rem] text-[#f0f0f5] mb-4 focus:outline-none focus:border-[#ff385c] uppercase tracking-[2px] font-bold"
            id="cup-codigo"
            placeholder="VENTSY30"
          />
          <div className="block text-[0.72rem] font-bold text-[#5c5c78] uppercase tracking-[0.08em] mb-1.5">Valor do desconto</div>
          <div className="grid grid-cols-2 gap-[10px]">
            <input
              type="number"
              className="w-full px-3.5 py-[11px] bg-[#1a1a24] border border-white/[0.07] rounded-lg font-['Inter',sans-serif] text-[0.88rem] text-[#f0f0f5] mb-0 focus:outline-none focus:border-[#ff385c]"
              id="cup-valor"
              placeholder="30"
              min={1}
              max={100}
            />
            <select className="w-full px-3.5 py-[11px] bg-[#1a1a24] border border-white/[0.07] rounded-lg font-['Inter',sans-serif] text-[0.88rem] text-[#f0f0f5] mb-0 focus:outline-none focus:border-[#ff385c]" id="cup-tipo">
              <option value="percent">% Percentual</option>
              <option value="fixo">R$ Fixo</option>
            </select>
          </div>
          <div className="h-4" />
          <div className="block text-[0.72rem] font-bold text-[#5c5c78] uppercase tracking-[0.08em] mb-1.5">Plano aplicável</div>
          <select className="w-full px-3.5 py-[11px] bg-[#1a1a24] border border-white/[0.07] rounded-lg font-['Inter',sans-serif] text-[0.88rem] text-[#f0f0f5] mb-4 focus:outline-none focus:border-[#ff385c]" id="cup-plano">
            <option value="todos">Todos os planos</option>
            <option value="pro">Apenas Pro</option>
            <option value="ultra">Apenas Ultra</option>
          </select>
          <div className="block text-[0.72rem] font-bold text-[#5c5c78] uppercase tracking-[0.08em] mb-1.5">Limite de usos</div>
          <input
            type="number"
            className="w-full px-3.5 py-[11px] bg-[#1a1a24] border border-white/[0.07] rounded-lg font-['Inter',sans-serif] text-[0.88rem] text-[#f0f0f5] mb-4 focus:outline-none focus:border-[#ff385c]"
            id="cup-limite"
            placeholder="100 (deixe vazio para ilimitado)"
            min={1}
          />
          <div className="block text-[0.72rem] font-bold text-[#5c5c78] uppercase tracking-[0.08em] mb-1.5">Validade</div>
          <input type="date" className="w-full px-3.5 py-[11px] bg-[#1a1a24] border border-white/[0.07] rounded-lg font-['Inter',sans-serif] text-[0.88rem] text-[#f0f0f5] mb-4 focus:outline-none focus:border-[#ff385c]" id="cup-validade" />
          <div className="block text-[0.72rem] font-bold text-[#5c5c78] uppercase tracking-[0.08em] mb-1.5">Descrição interna</div>
          <input
            type="text"
            className="w-full px-3.5 py-[11px] bg-[#1a1a24] border border-white/[0.07] rounded-lg font-['Inter',sans-serif] text-[0.88rem] text-[#f0f0f5] mb-4 focus:outline-none focus:border-[#ff385c]"
            id="cup-descricao"
            placeholder="Ex: Desconto lançamento abril"
          />
          <button
            className="btn btn-primary w-full justify-center mt-1"
            onClick={() => window.criarCupom()}
          >
            ✨ Criar cupom
          </button>
          <div className="mt-[14px] px-[14px] py-3 bg-[var(--bg3)] rounded-lg text-[0.75rem] text-[var(--text3)]">
            💡 Requer tabela <code className="text-[var(--red)]">cupons</code> no Supabase.
            Crie via SQL Editor se ainda não existir.
          </div>
        </div>

        {/* Lista de cupons ativos */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="font-['Syne',sans-serif] text-[1.05rem] font-bold text-[#f0f0f5]">🎟️ Cupons ativos</div>
            <div id="cup-count" className="text-[0.75rem] text-[var(--text3)]">Carregando...</div>
          </div>
          <div id="cupons-list" className="flex flex-col gap-3"></div>
        </div>
      </div>
    </div>
  )
}
