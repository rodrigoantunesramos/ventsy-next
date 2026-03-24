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
        <div className="stat-card p-7 border-[rgba(255,255,255,0.08)]">
          <div className="font-[var(--font-display)] text-[1.1rem] font-extrabold mb-4">
            ⚪ Básico
          </div>
          <div className="form-label">Preço mensal (R$)</div>
          <input type="number" className="form-input mb-3" id="plano-basico-preco" defaultValue={0} min={0} />
          <div className="form-label">Benefícios (um por linha)</div>
          <textarea className="compose-textarea min-h-[100px]" id="plano-basico-items"
            defaultValue={'1 propriedade\nListagem básica\nSuporte por email'} />
          <div className="form-label">Status</div>
          <select className="form-select" id="plano-basico-status">
            <option value="ativo">Ativo</option>
            <option value="oculto">Oculto</option>
          </select>
        </div>

        {/* Plano Pro */}
        <div className="stat-card blue p-7 border-[rgba(59,130,246,0.3)]">
          <div className="font-[var(--font-display)] text-[1.1rem] font-extrabold mb-4 text-[var(--blue)]">
            ⭐ Pro
          </div>
          <div className="form-label">Preço mensal (R$)</div>
          <input type="number" className="form-input mb-3" id="plano-pro-preco" defaultValue={99} min={0} />
          <div className="form-label">Benefícios (um por linha)</div>
          <textarea className="compose-textarea min-h-[100px]" id="plano-pro-items"
            defaultValue={'3 propriedades\nAnalytics básico\nSuporte prioritário\nDestaque na busca'} />
          <div className="form-label">Status</div>
          <select className="form-select" id="plano-pro-status">
            <option value="ativo">Ativo</option>
            <option value="oculto">Oculto</option>
          </select>
        </div>

        {/* Plano Ultra */}
        <div className="stat-card purple p-7 border-[rgba(139,92,246,0.3)]">
          <div className="font-[var(--font-display)] text-[1.1rem] font-extrabold mb-4 text-[var(--purple)]">
            🚀 Ultra
          </div>
          <div className="form-label">Preço mensal (R$)</div>
          <input type="number" className="form-input mb-3" id="plano-ultra-preco" defaultValue={249} min={0} />
          <div className="form-label">Benefícios (um por linha)</div>
          <textarea className="compose-textarea min-h-[100px]" id="plano-ultra-items"
            defaultValue={'Propriedades ilimitadas\nAnalytics completo\nSuporte 24/7\nTopo da busca\nSelo verificado'} />
          <div className="form-label">Status</div>
          <select className="form-select" id="plano-ultra-status">
            <option value="ativo">Ativo</option>
            <option value="oculto">Oculto</option>
          </select>
        </div>
      </div>

      <div className="flex justify-end gap-[10px]">
        <button className="btn btn-ghost" onClick={() => (window as any).carregarPlanos()}>↺ Resetar</button>
        <button className="btn btn-primary" onClick={() => (window as any).salvarPlanos()}>
          💾 Salvar configurações de planos
        </button>
      </div>
    </div>
  )
}
