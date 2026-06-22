import type { ReactNode } from 'react'

// Estados de UI compartilhados pelos módulos do painel — extraídos dos padrões
// que estavam inline em ~70 telas (setup-card amber, empty-state rico, loading).
// Adoção incremental: cada módulo passa o seu texto/ícone/ação.

/**
 * Aviso de "tabela ainda não criada no banco". Aparece quando `isMissingTable`
 * (lib/dbErrors) detecta o módulo sem schema. Pede rodar o SQL correspondente.
 */
export function SetupCard({ sql, children }: { sql: string; children?: ReactNode }) {
  return (
    <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
      {children ? <>{children} </> : null}
      Rode a migration{' '}
      <code className="rounded bg-amber-100 px-1 py-0.5">docs/sql/{sql}</code> no Supabase para ativar o módulo.
    </div>
  )
}

/**
 * Estado vazio rico (card centralizado com ícone, título, descrição e ação).
 * Ex.: <EmptyState icone={<IcoBox size={30} />} titulo="…" descricao="…" acao={<button…/>} />
 */
export function EmptyState({
  icone,
  titulo,
  descricao,
  acao,
}: {
  icone?: ReactNode
  titulo: string
  descricao?: ReactNode
  acao?: ReactNode
}) {
  return (
    <div className="mt-6 rounded-2xl border border-line bg-surface p-10 text-center shadow-card">
      {icone ? (
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-50 text-brand">
          {icone}
        </div>
      ) : null}
      <h2 className="text-lg font-bold text-ink">{titulo}</h2>
      {descricao ? <p className="mx-auto mt-1 max-w-md text-sm text-ink-muted">{descricao}</p> : null}
      {acao ? <div className="mt-6 flex flex-wrap items-center justify-center gap-2">{acao}</div> : null}
    </div>
  )
}

/** Estado de carregamento simples (texto discreto centralizado). */
export function LoadingState({ texto = 'Carregando…' }: { texto?: string }) {
  return <div className="mt-6 text-center text-sm text-ink-muted">{texto}</div>
}
