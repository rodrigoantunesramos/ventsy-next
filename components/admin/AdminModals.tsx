// Todos os modais do painel admin agrupados em um componente
// O JS (admin.js) controla abertura/fechamento via openModal() / closeModal()

export default function AdminModals() {
  return (
    <>
      {/* ── Modal: Detalhes da Propriedade ── */}
      <div className="modal-overlay" id="modal-prop">
        <div className="bg-[#111118] border border-white/[0.12] rounded-[20px] p-8 w-full max-w-[520px] max-h-[85vh] overflow-y-auto relative">
          <button
            className="absolute top-5 right-5 bg-transparent border-none text-[#5c5c78] text-[1.2rem] cursor-pointer leading-none hover:text-[#f0f0f5]"
            onClick={() => (window as any).closeModal('modal-prop')}
          >
            ✕
          </button>
          <div className="font-['Syne',sans-serif] text-[1.15rem] font-bold mb-1.5" id="mp-nome">Propriedade</div>
          <div className="text-[0.82rem] text-[#5c5c78] mb-7" id="mp-sub">Detalhes e ações</div>
          <div className="grid grid-cols-2 gap-3" id="mp-details"></div>
          <div className="flex gap-2.5 justify-end mt-6 pt-5 border-t border-white/[0.07]" id="mp-footer"></div>
        </div>
      </div>

      {/* ── Modal: Editar Usuário ── */}
      <div className="modal-overlay" id="modal-user">
        <div className="bg-[#111118] border border-white/[0.12] rounded-[20px] p-8 w-full max-w-[520px] max-h-[85vh] overflow-y-auto relative">
          <button
            className="absolute top-5 right-5 bg-transparent border-none text-[#5c5c78] text-[1.2rem] cursor-pointer leading-none hover:text-[#f0f0f5]"
            onClick={() => (window as any).closeModal('modal-user')}
          >
            ✕
          </button>
          <div className="font-['Syne',sans-serif] text-[1.15rem] font-bold mb-1.5">✏️ Editar usuário</div>
          <div className="text-[0.82rem] text-[#5c5c78] mb-7" id="mu-sub">Alterações salvas diretamente no banco</div>
          <input type="hidden" id="mu-id" />
          <div className="block text-[0.72rem] font-bold text-[#5c5c78] uppercase tracking-[0.08em] mb-1.5">Nome</div>
          <input type="text" className="w-full px-3.5 py-[11px] bg-[#1a1a24] border border-white/[0.07] rounded-lg font-['Inter',sans-serif] text-[0.88rem] text-[#f0f0f5] mb-4 focus:outline-none focus:border-[#ff385c]" id="mu-nome" placeholder="Nome completo" />
          <div className="block text-[0.72rem] font-bold text-[#5c5c78] uppercase tracking-[0.08em] mb-1.5">Usuário (@handle)</div>
          <input type="text" className="w-full px-3.5 py-[11px] bg-[#1a1a24] border border-white/[0.07] rounded-lg font-['Inter',sans-serif] text-[0.88rem] text-[#f0f0f5] mb-4 focus:outline-none focus:border-[#ff385c]" id="mu-usuario" placeholder="handle" />
          <div className="block text-[0.72rem] font-bold text-[#5c5c78] uppercase tracking-[0.08em] mb-1.5">Telefone</div>
          <input type="text" className="w-full px-3.5 py-[11px] bg-[#1a1a24] border border-white/[0.07] rounded-lg font-['Inter',sans-serif] text-[0.88rem] text-[#f0f0f5] mb-4 focus:outline-none focus:border-[#ff385c]" id="mu-telefone" placeholder="(21) 99999-9999" />
          <div className="flex gap-2.5 justify-end mt-6 pt-5 border-t border-white/[0.07]">
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
        <div className="bg-[#111118] border border-white/[0.12] rounded-[20px] p-8 w-full max-w-[520px] max-h-[85vh] overflow-y-auto relative">
          <button
            className="absolute top-5 right-5 bg-transparent border-none text-[#5c5c78] text-[1.2rem] cursor-pointer leading-none hover:text-[#f0f0f5]"
            onClick={() => (window as any).closeModal('modal-ass')}
          >
            ✕
          </button>
          <div className="font-['Syne',sans-serif] text-[1.15rem] font-bold mb-1.5">💳 Alterar assinatura</div>
          <div className="text-[0.82rem] text-[#5c5c78] mb-7" id="mass-sub">Usuário</div>
          <input type="hidden" id="mass-id" />
          <div className="block text-[0.72rem] font-bold text-[#5c5c78] uppercase tracking-[0.08em] mb-1.5">Plano</div>
          <select className="w-full px-3.5 py-[11px] bg-[#1a1a24] border border-white/[0.07] rounded-lg font-['Inter',sans-serif] text-[0.88rem] text-[#f0f0f5] mb-4 focus:outline-none focus:border-[#ff385c]" id="mass-plano">
            <option value="basico">Básico</option>
            <option value="pro">Pro</option>
            <option value="ultra">Ultra</option>
          </select>
          <div className="block text-[0.72rem] font-bold text-[#5c5c78] uppercase tracking-[0.08em] mb-1.5">Status</div>
          <select className="w-full px-3.5 py-[11px] bg-[#1a1a24] border border-white/[0.07] rounded-lg font-['Inter',sans-serif] text-[0.88rem] text-[#f0f0f5] mb-4 focus:outline-none focus:border-[#ff385c]" id="mass-status">
            <option value="ativa">Ativa</option>
            <option value="trial">Trial</option>
            <option value="cancelada">Cancelada</option>
            <option value="expirada">Expirada</option>
          </select>
          <div className="block text-[0.72rem] font-bold text-[#5c5c78] uppercase tracking-[0.08em] mb-1.5">Data fim do período</div>
          <input type="date" className="w-full px-3.5 py-[11px] bg-[#1a1a24] border border-white/[0.07] rounded-lg font-['Inter',sans-serif] text-[0.88rem] text-[#f0f0f5] mb-4 focus:outline-none focus:border-[#ff385c]" id="mass-fim" />
          <div className="flex gap-2.5 justify-end mt-6 pt-5 border-t border-white/[0.07]">
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
        <div className="bg-[#111118] border border-white/[0.12] rounded-[20px] p-8 w-full max-w-[680px] max-h-[85vh] overflow-y-auto relative">
          <button
            className="absolute top-5 right-5 bg-transparent border-none text-[#5c5c78] text-[1.2rem] cursor-pointer leading-none hover:text-[#f0f0f5]"
            onClick={() => (window as any).closeModal('modal-edit-prop')}
          >
            ✕
          </button>
          <div className="font-['Syne',sans-serif] text-[1.15rem] font-bold mb-1.5">✏️ Editar propriedade</div>
          <div className="text-[0.82rem] text-[#5c5c78] mb-7" id="mep-sub">Alterações salvas diretamente no banco</div>
          <input type="hidden" id="mep-id" />
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
            <div>
              <div className="block text-[0.72rem] font-bold text-[#5c5c78] uppercase tracking-[0.08em] mb-1.5">Nome da propriedade</div>
              <input type="text" className="w-full px-3.5 py-[11px] bg-[#1a1a24] border border-white/[0.07] rounded-lg font-['Inter',sans-serif] text-[0.88rem] text-[#f0f0f5] mb-4 focus:outline-none focus:border-[#ff385c]" id="mep-nome" placeholder="Nome" />
              <div className="block text-[0.72rem] font-bold text-[#5c5c78] uppercase tracking-[0.08em] mb-1.5">Cidade</div>
              <input type="text" className="w-full px-3.5 py-[11px] bg-[#1a1a24] border border-white/[0.07] rounded-lg font-['Inter',sans-serif] text-[0.88rem] text-[#f0f0f5] mb-4 focus:outline-none focus:border-[#ff385c]" id="mep-cidade" placeholder="Cidade" />
              <div className="block text-[0.72rem] font-bold text-[#5c5c78] uppercase tracking-[0.08em] mb-1.5">Estado (UF)</div>
              <input
                type="text"
                className="w-full px-3.5 py-[11px] bg-[#1a1a24] border border-white/[0.07] rounded-lg font-['Inter',sans-serif] text-[0.88rem] text-[#f0f0f5] mb-4 focus:outline-none focus:border-[#ff385c] uppercase"
                id="mep-estado"
                placeholder="RJ"
                maxLength={2}
              />
              <div className="block text-[0.72rem] font-bold text-[#5c5c78] uppercase tracking-[0.08em] mb-1.5">Capacidade (pessoas)</div>
              <input type="number" className="w-full px-3.5 py-[11px] bg-[#1a1a24] border border-white/[0.07] rounded-lg font-['Inter',sans-serif] text-[0.88rem] text-[#f0f0f5] mb-4 focus:outline-none focus:border-[#ff385c]" id="mep-capacidade" placeholder="100" min={1} />
            </div>
            <div>
              <div className="block text-[0.72rem] font-bold text-[#5c5c78] uppercase tracking-[0.08em] mb-1.5">Valor base (R$)</div>
              <input type="number" className="w-full px-3.5 py-[11px] bg-[#1a1a24] border border-white/[0.07] rounded-lg font-['Inter',sans-serif] text-[0.88rem] text-[#f0f0f5] mb-4 focus:outline-none focus:border-[#ff385c]" id="mep-valor" placeholder="500" min={0} />
              <div className="block text-[0.72rem] font-bold text-[#5c5c78] uppercase tracking-[0.08em] mb-1.5">WhatsApp</div>
              <input type="text" className="w-full px-3.5 py-[11px] bg-[#1a1a24] border border-white/[0.07] rounded-lg font-['Inter',sans-serif] text-[0.88rem] text-[#f0f0f5] mb-4 focus:outline-none focus:border-[#ff385c]" id="mep-whatsapp" placeholder="(21) 99999-9999" />
              <div className="block text-[0.72rem] font-bold text-[#5c5c78] uppercase tracking-[0.08em] mb-1.5">Email de contato</div>
              <input type="email" className="w-full px-3.5 py-[11px] bg-[#1a1a24] border border-white/[0.07] rounded-lg font-['Inter',sans-serif] text-[0.88rem] text-[#f0f0f5] mb-4 focus:outline-none focus:border-[#ff385c]" id="mep-email" placeholder="contato@email.com" />
              <div className="block text-[0.72rem] font-bold text-[#5c5c78] uppercase tracking-[0.08em] mb-1.5">Tipo / Categoria</div>
              <input type="text" className="w-full px-3.5 py-[11px] bg-[#1a1a24] border border-white/[0.07] rounded-lg font-['Inter',sans-serif] text-[0.88rem] text-[#f0f0f5] mb-4 focus:outline-none focus:border-[#ff385c]" id="mep-tipo" placeholder="Sítio, Salão, etc." />
            </div>
          </div>
          <div className="block text-[0.72rem] font-bold text-[#5c5c78] uppercase tracking-[0.08em] mb-1.5">Descrição</div>
          <textarea
            className="w-full min-h-[120px] bg-[#1a1a24] border border-white/[0.07] rounded-lg px-3.5 py-3 font-['Inter',sans-serif] text-[0.88rem] text-[#f0f0f5] resize-y mb-4 focus:outline-none focus:border-[#ff385c]"
            id="mep-descricao"
            placeholder="Descrição completa do espaço..."
          />
          <div className="block text-[0.72rem] font-bold text-[#5c5c78] uppercase tracking-[0.08em] mb-1.5">CEP</div>
          <input type="text" className="w-full px-3.5 py-[11px] bg-[#1a1a24] border border-white/[0.07] rounded-lg font-['Inter',sans-serif] text-[0.88rem] text-[#f0f0f5] mb-4 focus:outline-none focus:border-[#ff385c]" id="mep-cep" placeholder="00000-000" />
          <div className="block text-[0.72rem] font-bold text-[#5c5c78] uppercase tracking-[0.08em] mb-1.5">Endereço completo</div>
          <input type="text" className="w-full px-3.5 py-[11px] bg-[#1a1a24] border border-white/[0.07] rounded-lg font-['Inter',sans-serif] text-[0.88rem] text-[#f0f0f5] mb-4 focus:outline-none focus:border-[#ff385c]" id="mep-endereco" placeholder="Rua, número, bairro" />
          <div className="flex items-center gap-3 mb-4 px-[14px] py-3 bg-[var(--bg3)] rounded-lg">
            <input
              type="checkbox"
              id="mep-publicada"
              className="w-4 h-4 accent-[var(--green)]"
            />
            <label
              htmlFor="mep-publicada"
              className="text-[0.88rem] text-[var(--text2)] cursor-pointer"
            >
              ✅ Propriedade publicada (visível ao público)
            </label>
          </div>
          <div className="flex items-center gap-3 mb-4 px-[14px] py-3 bg-[var(--bg3)] rounded-lg">
            <input
              type="checkbox"
              id="mep-destaque"
              className="w-4 h-4 accent-[var(--purple)]"
            />
            <label
              htmlFor="mep-destaque"
              className="text-[0.88rem] text-[var(--text2)] cursor-pointer"
            >
              📌 Destaque no topo (fixar na página inicial)
            </label>
          </div>
          <div className="flex gap-2.5 justify-end mt-6 pt-5 border-t border-white/[0.07]">
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
        <div className="bg-[#111118] border border-white/[0.12] rounded-[20px] p-8 w-full max-w-[540px] max-h-[85vh] overflow-y-auto relative">
          <button
            className="absolute top-5 right-5 bg-transparent border-none text-[#5c5c78] text-[1.2rem] cursor-pointer leading-none hover:text-[#f0f0f5]"
            onClick={() => (window as any).closeModal('modal-email-inc')}
          >
            ✕
          </button>
          <div className="font-['Syne',sans-serif] text-[1.15rem] font-bold mb-1.5">📧 Enviar e-mail de recuperação</div>
          <div className="text-[0.82rem] text-[#5c5c78] mb-7" id="email-inc-para">Para: —</div>
          <input type="hidden" id="email-inc-dest" />
          <div className="block text-[0.72rem] font-bold text-[#5c5c78] uppercase tracking-[0.08em] mb-1.5">Assunto</div>
          <input
            type="text"
            className="w-full px-3.5 py-[11px] bg-[#1a1a24] border border-white/[0.07] rounded-lg font-['Inter',sans-serif] text-[0.88rem] text-[#f0f0f5] mb-4 focus:outline-none focus:border-[#ff385c]"
            id="email-inc-assunto"
            defaultValue="Finalize seu cadastro na Ventsy 🏡"
          />
          <div className="block text-[0.72rem] font-bold text-[#5c5c78] uppercase tracking-[0.08em] mb-1.5">Mensagem (HTML aceito)</div>
          <textarea
            className="w-full min-h-[180px] bg-[#1a1a24] border border-white/[0.07] rounded-lg px-3.5 py-3 font-['Inter',sans-serif] text-[0.88rem] text-[#f0f0f5] resize-y mb-4 focus:outline-none focus:border-[#ff385c]"
            id="email-inc-corpo"
            defaultValue={`Olá! 👋\n\nNotamos que você criou sua conta na <strong>Ventsy</strong> mas ainda não finalizou o cadastro do seu espaço.\n\nLeva menos de 5 minutos e você começa a receber solicitações de clientes imediatamente!\n\n<a href="https://ventsy.com.br/cadastro" style="background:#ff385c;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">👉 Completar meu cadastro</a>\n\nQualquer dúvida, estamos aqui!\n\nEquipe Ventsy`}
          />
          <div className="flex gap-2.5 justify-end mt-6 pt-5 border-t border-white/[0.07]">
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
