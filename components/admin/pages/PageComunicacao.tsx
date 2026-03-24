'use client'

export default function PageComunicacao() {
  return (
    <div className="page" id="page-comunicacao">
      <div className="two-col-asym">
        {/* Formulário de envio */}
        <div>
          <div className="compose-card">
            <div className="section-title mb-5">📝 Nova mensagem</div>
            <div className="form-label">Destinatários</div>
            <select
              className="form-select"
              id="com-destinatario"
              onChange={() => (window as any).updateComCount()}
            >
              <option value="todos">Todos os usuários</option>
              <option value="basico">Plano Básico</option>
              <option value="pro">Plano Pro</option>
              <option value="ultra">Plano Ultra</option>
              <option value="trial">Em Trial</option>
              <option value="sem_assinatura">Sem assinatura</option>
            </select>
            <div className="metric-compare -mt-2 mb-4" id="com-count">
              👥 Afetará{' '}
              <strong id="com-count-num" className="text-[var(--text)] mx-[3px]">0</strong>{' '}
              usuários
            </div>
            <div className="form-label">Tipo</div>
            <select className="form-select" id="com-tipo">
              <option value="info">ℹ️ Informação</option>
              <option value="promo">🎁 Promoção</option>
              <option value="alerta">⚠️ Alerta</option>
              <option value="atualizacao">🔄 Atualização</option>
            </select>
            <div className="form-label">Título</div>
            <input
              type="text"
              className="form-input"
              id="com-titulo"
              placeholder="Ex: Nova funcionalidade disponível!"
            />
            <div className="form-label">Mensagem</div>
            <textarea
              className="compose-textarea"
              id="com-mensagem"
              placeholder="Escreva sua mensagem aqui..."
            />
            <div className="flex gap-[10px] justify-end">
              <button className="btn btn-ghost" onClick={() => (window as any).clearCompose()}>
                🗑️ Limpar
              </button>
              <button className="btn btn-primary" onClick={() => (window as any).enviarMensagem()}>
                📤 Enviar
              </button>
            </div>
          </div>
        </div>

        {/* Estatísticas e histórico */}
        <div>
          <div className="chart-card mb-5">
            <div className="section-title mb-4">📊 Alcance por segmento</div>
            <div id="com-stats" className="flex flex-col gap-0"></div>
          </div>
          <div className="chart-card">
            <div className="section-title mb-4">📬 Últimas mensagens enviadas</div>
            <div id="com-historico"></div>
          </div>
        </div>
      </div>
    </div>
  )
}
