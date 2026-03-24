'use client'

export default function PagePlanos() {
  return (
    <div className="page" id="page-planos">
      <div className="alert-banner info mb-5">
        ℹ️ Alterações de preço aqui atualizam os cálculos de MRR/ARR no financeiro.
        Para mudar o preço cobrado nas páginas públicas, edite também a página de planos.
      </div>

      <div className="grid grid-cols-3 gap-5 mb-7">
        {/* Plano Básico */}
        <div className="bg-[#111118] border border-white/[0.07] rounded-2xl p-7 relative overflow-hidden transition-[border-color,transform] duration-200 hover:border-white/[0.12] hover:-translate-y-0.5">
          <div className="font-[var(--font-display)] text-[1.1rem] font-extrabold mb-4">
            ⚪ Básico
          </div>
          <div className="block text-[0.72rem] font-bold text-[#5c5c78] uppercase tracking-[0.08em] mb-1.5">Preço mensal (R$)</div>
          <input type="number" className="w-full px-3.5 py-[11px] bg-[#1a1a24] border border-white/[0.07] rounded-lg font-['Inter',sans-serif] text-[0.88rem] text-[#f0f0f5] mb-3 focus:outline-none focus:border-[#ff385c]" id="plano-basico-preco" defaultValue={0} min={0} />
          <div className="block text-[0.72rem] font-bold text-[#5c5c78] uppercase tracking-[0.08em] mb-1.5">Benefícios (um por linha)</div>
          <textarea className="w-full min-h-[100px] bg-[#1a1a24] border border-white/[0.07] rounded-lg px-3.5 py-3 font-['Inter',sans-serif] text-[0.88rem] text-[#f0f0f5] resize-y mb-4 focus:outline-none focus:border-[#ff385c]" id="plano-basico-items"
            defaultValue={'1 propriedade\nListagem básica\nSuporte por email'} />
          <div className="block text-[0.72rem] font-bold text-[#5c5c78] uppercase tracking-[0.08em] mb-1.5">Status</div>
          <select className="w-full px-3.5 py-[11px] bg-[#1a1a24] border border-white/[0.07] rounded-lg font-['Inter',sans-serif] text-[0.88rem] text-[#f0f0f5] mb-4 focus:outline-none focus:border-[#ff385c]" id="plano-basico-status">
            <option value="ativo">Ativo</option>
            <option value="oculto">Oculto</option>
          </select>
        </div>

        {/* Plano Pro */}
        <div className="bg-[#111118] border border-white/[0.07] rounded-2xl p-7 relative overflow-hidden transition-[border-color,transform] duration-200 hover:border-white/[0.12] hover:-translate-y-0.5 before:content-[''] before:absolute before:top-0 before:left-0 before:right-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-[#3b82f6] before:to-transparent border-[rgba(59,130,246,0.3)]">
          <div className="font-[var(--font-display)] text-[1.1rem] font-extrabold mb-4 text-[var(--blue)]">
            ⭐ Pro
          </div>
          <div className="block text-[0.72rem] font-bold text-[#5c5c78] uppercase tracking-[0.08em] mb-1.5">Preço mensal (R$)</div>
          <input type="number" className="w-full px-3.5 py-[11px] bg-[#1a1a24] border border-white/[0.07] rounded-lg font-['Inter',sans-serif] text-[0.88rem] text-[#f0f0f5] mb-3 focus:outline-none focus:border-[#ff385c]" id="plano-pro-preco" defaultValue={99} min={0} />
          <div className="block text-[0.72rem] font-bold text-[#5c5c78] uppercase tracking-[0.08em] mb-1.5">Benefícios (um por linha)</div>
          <textarea className="w-full min-h-[100px] bg-[#1a1a24] border border-white/[0.07] rounded-lg px-3.5 py-3 font-['Inter',sans-serif] text-[0.88rem] text-[#f0f0f5] resize-y mb-4 focus:outline-none focus:border-[#ff385c]" id="plano-pro-items"
            defaultValue={'3 propriedades\nAnalytics básico\nSuporte prioritário\nDestaque na busca'} />
          <div className="block text-[0.72rem] font-bold text-[#5c5c78] uppercase tracking-[0.08em] mb-1.5">Status</div>
          <select className="w-full px-3.5 py-[11px] bg-[#1a1a24] border border-white/[0.07] rounded-lg font-['Inter',sans-serif] text-[0.88rem] text-[#f0f0f5] mb-4 focus:outline-none focus:border-[#ff385c]" id="plano-pro-status">
            <option value="ativo">Ativo</option>
            <option value="oculto">Oculto</option>
          </select>
        </div>

        {/* Plano Ultra */}
        <div className="bg-[#111118] border border-white/[0.07] rounded-2xl p-7 relative overflow-hidden transition-[border-color,transform] duration-200 hover:border-white/[0.12] hover:-translate-y-0.5 before:content-[''] before:absolute before:top-0 before:left-0 before:right-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-[#8b5cf6] before:to-transparent border-[rgba(139,92,246,0.3)]">
          <div className="font-[var(--font-display)] text-[1.1rem] font-extrabold mb-4 text-[var(--purple)]">
            🚀 Ultra
          </div>
          <div className="block text-[0.72rem] font-bold text-[#5c5c78] uppercase tracking-[0.08em] mb-1.5">Preço mensal (R$)</div>
          <input type="number" className="w-full px-3.5 py-[11px] bg-[#1a1a24] border border-white/[0.07] rounded-lg font-['Inter',sans-serif] text-[0.88rem] text-[#f0f0f5] mb-3 focus:outline-none focus:border-[#ff385c]" id="plano-ultra-preco" defaultValue={249} min={0} />
          <div className="block text-[0.72rem] font-bold text-[#5c5c78] uppercase tracking-[0.08em] mb-1.5">Benefícios (um por linha)</div>
          <textarea className="w-full min-h-[100px] bg-[#1a1a24] border border-white/[0.07] rounded-lg px-3.5 py-3 font-['Inter',sans-serif] text-[0.88rem] text-[#f0f0f5] resize-y mb-4 focus:outline-none focus:border-[#ff385c]" id="plano-ultra-items"
            defaultValue={'Propriedades ilimitadas\nAnalytics completo\nSuporte 24/7\nTopo da busca\nSelo verificado'} />
          <div className="block text-[0.72rem] font-bold text-[#5c5c78] uppercase tracking-[0.08em] mb-1.5">Status</div>
          <select className="w-full px-3.5 py-[11px] bg-[#1a1a24] border border-white/[0.07] rounded-lg font-['Inter',sans-serif] text-[0.88rem] text-[#f0f0f5] mb-4 focus:outline-none focus:border-[#ff385c]" id="plano-ultra-status">
            <option value="ativo">Ativo</option>
            <option value="oculto">Oculto</option>
          </select>
        </div>
      </div>

      <div className="flex justify-end gap-[10px]">
        <button className="btn btn-ghost" onClick={() => window.carregarPlanos()}>↺ Resetar</button>
        <button className="btn btn-primary" onClick={() => window.salvarPlanos()}>
          💾 Salvar configurações de planos
        </button>
      </div>
    </div>
  )
}
