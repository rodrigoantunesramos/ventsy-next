// Detecção canônica de "tabela ainda não criada no banco" — usada pelos módulos
// para mostrar o setup-card (rodar o SQL do módulo) em vez de um erro genérico.
//
// Antes cada lib/<modulo> definia a sua isMissingTable (32 cópias, em 4 variações:
// só-código, com !!err, com fallback de mensagem, e aceitando unknown). Esta é a
// versão mais robusta — superset de todas — e cada módulo re-exporta daqui.
//
// PGRST205 = PostgREST não achou a tabela no schema cache; 42P01 = undefined_table
// (erro de SQL direto). O fallback por mensagem cobre variações de texto.
export function isMissingTable(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const e = err as { code?: string | null; message?: string | null }
  return (
    e.code === 'PGRST205' ||
    e.code === '42P01' ||
    /could not find the table|schema cache|does not exist/i.test(e.message || '')
  )
}
