'use client'

export default function PagePlanos() {
  return (
    <div className="page" id="page-planos">
      <div className="alert-banner info" style={{ marginBottom: '20px' }}>
        ℹ️ Alterações de preço aqui atualizam os cálculos de MRR/ARR no financeiro.
        Para mudar o preço cobrado nas páginas públicas, edite também a página de planos.
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '20px', marginBottom: '28px' }}>
        {/* Plano Básico */}
        <div className="stat-card" style={{ padding: '28px', borderColor: 'rgba(255,255,255,0.08)' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 800, marginBottom: '16px' }}>
            ⚪ Básico
          </div>
          <div className="form-label">Preço mensal (R$)</div>
          <input type="number" className="form-input" id="plano-basico-preco" defaultValue={0} min={0} style={{ marginBottom: '12px' }} />
          <div className="form-label">Benefícios (um por linha)</div>
          <textarea className="compose-textarea" id="plano-basico-items" style={{ minHeight: '100px' }}
            defaultValue={'1 propriedade\nListagem básica\nSuporte por email'} />
          <div className="form-label">Status</div>
          <select className="form-select" id="plano-basico-status">
            <option value="ativo">Ativo</option>
            <option value="oculto">Oculto</option>
          </select>
        </div>

        {/* Plano Pro */}
        <div className="stat-card blue" style={{ padding: '28px', borderColor: 'rgba(59,130,246,0.3)' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 800, marginBottom: '16px', color: 'var(--blue)' }}>
            ⭐ Pro
          </div>
          <div className="form-label">Preço mensal (R$)</div>
          <input type="number" className="form-input" id="plano-pro-preco" defaultValue={99} min={0} style={{ marginBottom: '12px' }} />
          <div className="form-label">Benefícios (um por linha)</div>
          <textarea className="compose-textarea" id="plano-pro-items" style={{ minHeight: '100px' }}
            defaultValue={'3 propriedades\nAnalytics básico\nSuporte prioritário\nDestaque na busca'} />
          <div className="form-label">Status</div>
          <select className="form-select" id="plano-pro-status">
            <option value="ativo">Ativo</option>
            <option value="oculto">Oculto</option>
          </select>
        </div>

        {/* Plano Ultra */}
        <div className="stat-card purple" style={{ padding: '28px', borderColor: 'rgba(139,92,246,0.3)' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 800, marginBottom: '16px', color: 'var(--purple)' }}>
            🚀 Ultra
          </div>
          <div className="form-label">Preço mensal (R$)</div>
          <input type="number" className="form-input" id="plano-ultra-preco" defaultValue={249} min={0} style={{ marginBottom: '12px' }} />
          <div className="form-label">Benefícios (um por linha)</div>
          <textarea className="compose-textarea" id="plano-ultra-items" style={{ minHeight: '100px' }}
            defaultValue={'Propriedades ilimitadas\nAnalytics completo\nSuporte 24/7\nTopo da busca\nSelo verificado'} />
          <div className="form-label">Status</div>
          <select className="form-select" id="plano-ultra-status">
            <option value="ativo">Ativo</option>
            <option value="oculto">Oculto</option>
          </select>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
        <button className="btn btn-ghost" onClick={() => (window as any).carregarPlanos()}>↺ Resetar</button>
        <button className="btn btn-primary" onClick={() => (window as any).salvarPlanos()}>
          💾 Salvar configurações de planos
        </button>
      </div>
    </div>
  )
}
