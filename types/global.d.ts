// Window extensions for the legacy admin panel (admin.js).
// Remove this file once admin.js is migrated to React.

declare global {
  interface Window {
    // ── Admin (admin.js) ─────────────────────────────────────────────────────
    closeModal: (id: string) => void
    saveUser: () => void
    saveAss: () => void
    saveProp: () => void
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
    enviarEmailIncompleto: (id?: string) => void
    exportIncompletos: () => void
    carregarPlanos: () => void
    salvarPlanos: () => void
    updateComCount: () => void
    clearCompose: () => void
    enviarMensagem: () => void
    exportQualidade: () => void
    recarregarBuscasSemResultado: () => void
    exportBuscasSemResultado: () => void
    mostrarToast: (msg: string, tipo?: string) => void
  }
}

export {}
