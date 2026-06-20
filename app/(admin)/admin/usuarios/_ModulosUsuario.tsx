'use client'

import { useCallback, useEffect, useState } from 'react'
import { MODULOS_PAINEL } from '@/lib/modulos'

type Grant = { modulo_key: string; status: string; origem: string; inicio: string | null; fim: string | null; valor_pago: number }

// Modal de concessão MANUAL de módulos avulsos a um usuário (venda por fora /
// cortesia). Lê o estado atual e libera/revoga via /api/admin/usuarios-modulos.
export default function ModulosUsuario({
  usuario,
  onClose,
}: {
  usuario: { id: string; nome: string | null; email: string | null }
  onClose: () => void
}) {
  const [grants, setGrants] = useState<Record<string, Grant>>({})
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch(`/api/admin/usuarios-modulos?usuario_id=${usuario.id}`)
      const j = await r.json().catch(() => ({}))
      const map: Record<string, Grant> = {}
      for (const g of (j.modulos ?? []) as Grant[]) map[g.modulo_key] = g
      setGrants(map)
    } finally {
      setLoading(false)
    }
  }, [usuario.id])

  useEffect(() => { carregar() }, [carregar])

  async function acao(action: 'conceder' | 'revogar', modulo_key: string) {
    setBusy(modulo_key)
    try {
      const r = await fetch('/api/admin/usuarios-modulos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, usuario_id: usuario.id, modulo_key }),
      })
      if (!r.ok) {
        const j = await r.json().catch(() => ({}))
        alert(j.error || 'Erro ao executar a ação.')
        return
      }
      await carregar()
    } finally {
      setBusy(null)
    }
  }

  function vigente(key: string): boolean {
    const g = grants[key]
    if (!g || g.status !== 'ativo') return false
    const hoje = new Date().toISOString().slice(0, 10)
    return !g.fim || g.fim >= hoje
  }

  const grupos: string[] = []
  for (const m of MODULOS_PAINEL) if (!grupos.includes(m.grupo)) grupos.push(m.grupo)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-2xl border border-white/[0.08] bg-[#15151d]">
        <div className="flex items-start justify-between border-b border-white/[0.07] p-5">
          <div>
            <h2 className="text-lg font-bold">Módulos avulsos</h2>
            <p className="mt-0.5 text-sm text-[#a0a0b8]">{usuario.nome || usuario.email || usuario.id}</p>
          </div>
          <button onClick={onClose} className="rounded-lg px-3 py-1.5 text-sm text-[#a0a0b8] hover:bg-white/[0.04]">Fechar</button>
        </div>

        <div className="overflow-y-auto p-5">
          {loading ? (
            <div className="text-[#a0a0b8]">Carregando…</div>
          ) : (
            grupos.map((grupo) => (
              <div key={grupo} className="mb-4">
                <div className="mb-1.5 text-[0.68rem] font-bold uppercase tracking-[0.08em] text-[#5c5c78]">{grupo}</div>
                <div className="overflow-hidden rounded-xl border border-white/[0.06]">
                  {MODULOS_PAINEL.filter((m) => m.grupo === grupo).map((m) => {
                    const g = grants[m.key]
                    const on = vigente(m.key)
                    return (
                      <div key={m.key} className="flex items-center justify-between gap-3 border-b border-white/[0.04] px-3 py-2 last:border-0">
                        <div className="min-w-0">
                          <span className="text-sm">{m.label}</span>
                          {on && (
                            <span className="ml-2 rounded bg-emerald-500/15 px-1.5 py-0.5 text-[0.6rem] font-semibold text-emerald-400">
                              {g?.origem || 'concedido'}{g?.fim ? ` · até ${g.fim}` : ''}
                            </span>
                          )}
                        </div>
                        {m.core ? (
                          <span className="text-[0.7rem] text-[#5c5c78]">sempre incluso</span>
                        ) : on ? (
                          <button
                            onClick={() => acao('revogar', m.key)}
                            disabled={busy === m.key}
                            className="rounded-md border border-[#ff385c]/30 px-2.5 py-1 text-[0.75rem] text-[#ff385c] hover:bg-[#ff385c]/10 disabled:opacity-50"
                          >
                            Revogar
                          </button>
                        ) : (
                          <button
                            onClick={() => acao('conceder', m.key)}
                            disabled={busy === m.key}
                            className="rounded-md border border-emerald-500/30 px-2.5 py-1 text-[0.75rem] text-emerald-400 hover:bg-emerald-500/10 disabled:opacity-50"
                          >
                            Conceder
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="border-t border-white/[0.07] px-5 py-3 text-[0.72rem] text-[#5c5c78]">
          Conceder libera como cortesia (12 meses), sem cobrança — para vendas fechadas por fora. A compra
          self-service do dono não passa por aqui.
        </div>
      </div>
    </div>
  )
}
