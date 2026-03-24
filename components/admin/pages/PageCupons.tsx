'use client'

export default function PageCupons() {
  return (
    <div className="page" id="page-cupons">
      <div className="two-col-asym">
        {/* Formulário de criação */}
        <div className="compose-card">
          <div className="section-title mb-5">➕ Criar cupom</div>
          <div className="form-label">Código do cupom</div>
          <input
            type="text"
            className="form-input uppercase tracking-[2px] font-bold"
            id="cup-codigo"
            placeholder="VENTSY30"
          />
          <div className="form-label">Valor do desconto</div>
          <div className="grid grid-cols-2 gap-[10px]">
            <input
              type="number"
              className="form-input mb-0"
              id="cup-valor"
              placeholder="30"
              min={1}
              max={100}
            />
            <select className="form-select mb-0" id="cup-tipo">
              <option value="percent">% Percentual</option>
              <option value="fixo">R$ Fixo</option>
            </select>
          </div>
          <div className="h-4" />
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
            className="btn btn-primary w-full justify-center mt-1"
            onClick={() => (window as any).criarCupom()}
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
          <div className="section-header mb-4">
            <div className="section-title">🎟️ Cupons ativos</div>
            <div id="cup-count" className="text-[0.75rem] text-[var(--text3)]">Carregando...</div>
          </div>
          <div id="cupons-list" className="flex flex-col gap-3"></div>
        </div>
      </div>
    </div>
  )
}
