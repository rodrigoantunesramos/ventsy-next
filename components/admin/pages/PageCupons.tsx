'use client'

export default function PageCupons() {
  return (
    <div className="page" id="page-cupons">
      <div className="two-col-asym">
        {/* Formulário de criação */}
        <div className="compose-card">
          <div className="section-title" style={{ marginBottom: '20px' }}>➕ Criar cupom</div>
          <div className="form-label">Código do cupom</div>
          <input
            type="text"
            className="form-input"
            id="cup-codigo"
            placeholder="VENTSY30"
            style={{ textTransform: 'uppercase', letterSpacing: '2px', fontWeight: 700 }}
          />
          <div className="form-label">Valor do desconto</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <input
              type="number"
              className="form-input"
              id="cup-valor"
              placeholder="30"
              min={1}
              max={100}
              style={{ marginBottom: 0 }}
            />
            <select className="form-select" id="cup-tipo" style={{ marginBottom: 0 }}>
              <option value="percent">% Percentual</option>
              <option value="fixo">R$ Fixo</option>
            </select>
          </div>
          <div style={{ height: '16px' }} />
          <div className="form-label">Plano aplicável</div>
          <select className="form-select" id="cup-plano">
            <option value="todos">Todos os planos</option>
            <option value="pro">Apenas Pro</option>
            <option value="ultra">Apenas Ultra</option>
          </select>
          <div className="form-label">Limite de usos</div>
          <input
            type="number"
            className="form-input"
            id="cup-limite"
            placeholder="100 (deixe vazio para ilimitado)"
            min={1}
          />
          <div className="form-label">Validade</div>
          <input type="date" className="form-input" id="cup-validade" />
          <div className="form-label">Descrição interna</div>
          <input
            type="text"
            className="form-input"
            id="cup-descricao"
            placeholder="Ex: Desconto lançamento abril"
          />
          <button
            className="btn btn-primary"
            style={{ width: '100%', justifyContent: 'center', marginTop: '4px' }}
            onClick={() => (window as any).criarCupom()}
          >
            ✨ Criar cupom
          </button>
          <div style={{
            marginTop: '14px',
            padding: '12px 14px',
            background: 'var(--bg3)',
            borderRadius: '8px',
            fontSize: '0.75rem',
            color: 'var(--text3)',
          }}>
            💡 Requer tabela <code style={{ color: 'var(--red)' }}>cupons</code> no Supabase.
            Crie via SQL Editor se ainda não existir.
          </div>
        </div>

        {/* Lista de cupons ativos */}
        <div>
          <div className="section-header" style={{ marginBottom: '16px' }}>
            <div className="section-title">🎟️ Cupons ativos</div>
            <div id="cup-count" style={{ fontSize: '0.75rem', color: 'var(--text3)' }}>Carregando...</div>
          </div>
          <div id="cupons-list" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}></div>
        </div>
      </div>
    </div>
  )
}
