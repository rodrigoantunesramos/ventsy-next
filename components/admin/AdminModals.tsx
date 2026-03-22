// Todos os modais do painel admin agrupados em um componente
// O JS (admin.js) controla abertura/fechamento via openModal() / closeModal()

export default function AdminModals() {
  return (
    <>
      {/* ── Modal: Detalhes da Propriedade ── */}
      <div className="modal-overlay" id="modal-prop">
        <div className="modal">
          <button
            className="modal-close"
            onClick={() => (window as any).closeModal('modal-prop')}
          >
            ✕
          </button>
          <div className="modal-title" id="mp-nome">Propriedade</div>
          <div className="modal-sub" id="mp-sub">Detalhes e ações</div>
          <div className="detail-grid" id="mp-details"></div>
          <div className="modal-footer" id="mp-footer"></div>
        </div>
      </div>

      {/* ── Modal: Editar Usuário ── */}
      <div className="modal-overlay" id="modal-user">
        <div className="modal">
          <button
            className="modal-close"
            onClick={() => (window as any).closeModal('modal-user')}
          >
            ✕
          </button>
          <div className="modal-title">✏️ Editar usuário</div>
          <div className="modal-sub" id="mu-sub">Alterações salvas diretamente no banco</div>
          <input type="hidden" id="mu-id" />
          <div className="form-label">Nome</div>
          <input type="text" className="form-input" id="mu-nome" placeholder="Nome completo" />
          <div className="form-label">Usuário (@handle)</div>
          <input type="text" className="form-input" id="mu-usuario" placeholder="handle" />
          <div className="form-label">Telefone</div>
          <input type="text" className="form-input" id="mu-telefone" placeholder="(21) 99999-9999" />
          <div className="modal-footer">
            <button
              className="btn btn-ghost"
              onClick={() => (window as any).closeModal('modal-user')}
            >
              Cancelar
            </button>
            <button
              className="btn btn-primary"
              onClick={() => (window as any).saveUser()}
            >
              💾 Salvar alterações
            </button>
          </div>
        </div>
      </div>

      {/* ── Modal: Editar Assinatura ── */}
      <div className="modal-overlay" id="modal-ass">
        <div className="modal">
          <button
            className="modal-close"
            onClick={() => (window as any).closeModal('modal-ass')}
          >
            ✕
          </button>
          <div className="modal-title">💳 Alterar assinatura</div>
          <div className="modal-sub" id="mass-sub">Usuário</div>
          <input type="hidden" id="mass-id" />
          <div className="form-label">Plano</div>
          <select className="form-select" id="mass-plano">
            <option value="basico">Básico</option>
            <option value="pro">Pro</option>
            <option value="ultra">Ultra</option>
          </select>
          <div className="form-label">Status</div>
          <select className="form-select" id="mass-status">
            <option value="ativa">Ativa</option>
            <option value="trial">Trial</option>
            <option value="cancelada">Cancelada</option>
            <option value="expirada">Expirada</option>
          </select>
          <div className="form-label">Data fim do período</div>
          <input type="date" className="form-input" id="mass-fim" />
          <div className="modal-footer">
            <button
              className="btn btn-ghost"
              onClick={() => (window as any).closeModal('modal-ass')}
            >
              Cancelar
            </button>
            <button
              className="btn btn-primary"
              onClick={() => (window as any).saveAss()}
            >
              💾 Salvar
            </button>
          </div>
        </div>
      </div>

      {/* ── Modal: Editar Propriedade (WYSIWYG Admin) ── */}
      <div className="modal-overlay" id="modal-edit-prop">
        <div className="modal" style={{ maxWidth: '680px' }}>
          <button
            className="modal-close"
            onClick={() => (window as any).closeModal('modal-edit-prop')}
          >
            ✕
          </button>
          <div className="modal-title">✏️ Editar propriedade</div>
          <div className="modal-sub" id="mep-sub">Alterações salvas diretamente no banco</div>
          <input type="hidden" id="mep-id" />
          <div className="two-col">
            <div>
              <div className="form-label">Nome da propriedade</div>
              <input type="text" className="form-input" id="mep-nome" placeholder="Nome" />
              <div className="form-label">Cidade</div>
              <input type="text" className="form-input" id="mep-cidade" placeholder="Cidade" />
              <div className="form-label">Estado (UF)</div>
              <input
                type="text"
                className="form-input"
                id="mep-estado"
                placeholder="RJ"
                maxLength={2}
                style={{ textTransform: 'uppercase' }}
              />
              <div className="form-label">Capacidade (pessoas)</div>
              <input type="number" className="form-input" id="mep-capacidade" placeholder="100" min={1} />
            </div>
            <div>
              <div className="form-label">Valor base (R$)</div>
              <input type="number" className="form-input" id="mep-valor" placeholder="500" min={0} />
              <div className="form-label">WhatsApp</div>
              <input type="text" className="form-input" id="mep-whatsapp" placeholder="(21) 99999-9999" />
              <div className="form-label">Email de contato</div>
              <input type="email" className="form-input" id="mep-email" placeholder="contato@email.com" />
              <div className="form-label">Tipo / Categoria</div>
              <input type="text" className="form-input" id="mep-tipo" placeholder="Sítio, Salão, etc." />
            </div>
          </div>
          <div className="form-label">Descrição</div>
          <textarea
            className="compose-textarea"
            id="mep-descricao"
            placeholder="Descrição completa do espaço..."
          />
          <div className="form-label">CEP</div>
          <input type="text" className="form-input" id="mep-cep" placeholder="00000-000" />
          <div className="form-label">Endereço completo</div>
          <input type="text" className="form-input" id="mep-endereco" placeholder="Rua, número, bairro" />
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              marginBottom: '16px',
              padding: '12px 14px',
              background: 'var(--bg3)',
              borderRadius: '8px',
            }}
          >
            <input
              type="checkbox"
              id="mep-publicada"
              style={{ width: '16px', height: '16px', accentColor: 'var(--green)' }}
            />
            <label
              htmlFor="mep-publicada"
              style={{ fontSize: '0.88rem', color: 'var(--text2)', cursor: 'pointer' }}
            >
              ✅ Propriedade publicada (visível ao público)
            </label>
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              marginBottom: '16px',
              padding: '12px 14px',
              background: 'var(--bg3)',
              borderRadius: '8px',
            }}
          >
            <input
              type="checkbox"
              id="mep-destaque"
              style={{ width: '16px', height: '16px', accentColor: 'var(--purple)' }}
            />
            <label
              htmlFor="mep-destaque"
              style={{ fontSize: '0.88rem', color: 'var(--text2)', cursor: 'pointer' }}
            >
              📌 Destaque no topo (fixar na página inicial)
            </label>
          </div>
          <div className="modal-footer">
            <button
              className="btn btn-ghost"
              onClick={() => (window as any).closeModal('modal-edit-prop')}
            >
              Cancelar
            </button>
            <button
              className="btn btn-primary"
              onClick={() => (window as any).saveProp()}
            >
              💾 Salvar alterações
            </button>
          </div>
        </div>
      </div>

      {/* ── Modal: E-mail para cadastro incompleto ── */}
      <div className="modal-overlay" id="modal-email-inc">
        <div className="modal" style={{ maxWidth: '540px' }}>
          <button
            className="modal-close"
            onClick={() => (window as any).closeModal('modal-email-inc')}
          >
            ✕
          </button>
          <div className="modal-title">📧 Enviar e-mail de recuperação</div>
          <div className="modal-sub" id="email-inc-para">Para: —</div>
          <input type="hidden" id="email-inc-dest" />
          <div className="form-label">Assunto</div>
          <input
            type="text"
            className="form-input"
            id="email-inc-assunto"
            defaultValue="Finalize seu cadastro na Ventsy 🏡"
          />
          <div className="form-label">Mensagem (HTML aceito)</div>
          <textarea
            className="compose-textarea"
            id="email-inc-corpo"
            style={{ minHeight: '180px' }}
            defaultValue={`Olá! 👋\n\nNotamos que você criou sua conta na <strong>Ventsy</strong> mas ainda não finalizou o cadastro do seu espaço.\n\nLeva menos de 5 minutos e você começa a receber solicitações de clientes imediatamente!\n\n<a href="https://ventsy.com.br/cadastro" style="background:#ff385c;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">👉 Completar meu cadastro</a>\n\nQualquer dúvida, estamos aqui!\n\nEquipe Ventsy`}
          />
          <div className="modal-footer">
            <button
              className="btn btn-ghost"
              onClick={() => (window as any).closeModal('modal-email-inc')}
            >
              Cancelar
            </button>
            <button
              className="btn btn-primary"
              onClick={() => (window as any).enviarEmailIncompleto()}
            >
              📤 Enviar e-mail
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
