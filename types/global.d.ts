// Window extensions for legacy dashboard JS functions.
// These are set on `window` by /public/dashboard/modules/*.js and /public/admin/admin.js.
// Remove this file once those modules are migrated to React.

declare global {
  interface Window {
    // ── Navigation ──────────────────────────────────────────────────────────
    navegar?: (rota: string) => void
    mudarTab?: (el: Element) => void
    solicitarLiberacao?: () => void

    // ── Financeiro ──────────────────────────────────────────────────────────
    finUpdatePeriod: (v: string) => void
    finOpenModal: (tipo: string) => void
    finMudarAba: (aba: string, el: Element) => void
    finFilterTable: (v: string) => void

    // ── Documentos ──────────────────────────────────────────────────────────
    docsExport: () => void
    docsOpenAddModal: () => void
    docsSetFilter: (f: string, el: Element) => void
    docsSearch: (v: string) => void

    // ── Equipe ──────────────────────────────────────────────────────────────
    eqSwitchTab: (t: string) => void
    eqOpenEmpModal: () => void
    eqFilterEmp: (f: string, el: Element) => void
    eqSearchEmp: (v: string) => void
    eqChangeMonth: (d: number) => void
    eqExportPayroll: () => void
    eqUpdateTax: () => void
    eqRunSimulator: () => void

    // ── Calendário ──────────────────────────────────────────────────────────
    calBloquearFimsDeSemana?: () => void
    calLiberarTodoMes?: () => void
    calSalvarDisponibilidade?: () => void
    calMudarMes?: (d: number) => void
    calAbrirSeletorMes?: () => void
    calAbrirSeletorAno?: () => void
    calFecharModal?: () => void
    calSelecionarChip?: (el: Element) => void
    calConfirmarBloqueio?: () => void
    calFecharModalLiberarDia?: () => void
    calConfirmarLiberarDia?: () => void
    calFecharModalLiberarTodos?: () => void
    calValidarTextoLiberarTodos?: () => void
    calExecutarLiberarTodos?: () => void

    // ── Fotos ────────────────────────────────────────────────────────────────
    fotosSalvarTudo: () => void
    fotosCriarSecao: () => void
    fotosMudarAba: (aba: string) => void
    fotosAtivarSlot: (n: number) => void
    fotosLimparDestaquePos: (n: number) => void

    // ── Propriedade ──────────────────────────────────────────────────────────
    propVerAnuncio: () => void
    propOpenTab: (evt: Event, tab: string) => void
    propPreviewFoto: (el: HTMLInputElement) => void
    propAdicionarCusto: () => void
    propBuscarCEP: () => void
    propSelecionarUF: (el: Element, uf: string) => void
    propAtualizarMapa: () => void
    propAdicionarFAQ: () => void
    propSalvar: () => void

    // ── Leads ────────────────────────────────────────────────────────────────
    leadsExportarExcel: () => void
    leadsExportarPDF: () => void
    leadsAbrirModalNovo: () => void
    leadsAplicarFiltros: () => void
    leadsMudarPorPagina: () => void
    leadsOrdenarPor: (campo: string) => void
    leadsFecharModalStatus: () => void
    leadsSelecionarStatus: (el: Element) => void
    leadsFecharModalNovo: () => void
    leadsCriarCliente: () => void

    // ── Planos ───────────────────────────────────────────────────────────────
    planosFecharCheckout: () => void
    planosSelecionarDuracao: (n: number) => void
    planosAplicarCupom: () => void
    planosTrocarMetodo: (m: string) => void

    // ── Admin (admin.js) ─────────────────────────────────────────────────────
    closeModal: (id: string) => void
    saveUser: () => void
    saveAss: () => void
    doLogin: () => void
    doLogout: () => void
    showPage: (page: string) => void
    renderLogs: () => void
    clearLogs: () => void
    filterUsers: () => void
    filterProps: () => void
    criarCupom: () => void
    recarregarIncompletos: () => void
    emailTodosIncompletos: () => void
    exportIncompletos: () => void
    carregarPlanos: () => void
    salvarPlanos: () => void
    updateComCount: () => void
    clearCompose: () => void
    enviarMensagem: () => void
    exportQualidade: () => void
    recarregarBuscasSemResultado: () => void
    exportBuscasSemResultado: () => void
  }
}

export {}
