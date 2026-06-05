// =============================
// GLOBAL ERROR HANDLER (OPCIONAL)
// =============================

// FILE: /src/lib/globalError.ts

export function handleError(error: any, showToast: any) {
  console.error(error);

  showToast({
    message: error?.message || "Erro inesperado do sistema",
    type: "error",
  });
}

// =============================
// UX PREMIUM EXTRAS
// =============================

// Botão com loading padrão SaaS
/*
  Exemplo de uso em componente React:
  
  <button
    disabled={loading}
    className="bg-red-500 text-white px-4 py-2 rounded-lg disabled:opacity-50 flex items-center gap-2"
  >
    {loading && (
      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
    )}
    {loading ? "Processando..." : "Salvar"}
  </button>
*/

// =============================
// RESULTADO FINAL
// =============================
// ✅ Toast automático
// ✅ Loading automático
// ✅ Tratamento de erro padrão
// ✅ Código limpo
// ✅ Escalável pra time grande
// =============================
