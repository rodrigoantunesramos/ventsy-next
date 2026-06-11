'use client'

import { useCallback, useEffect, useState } from 'react'

type Prop = {
  id: number | string
  nome: string | null
  cidade: string | null
  estado: string | null
  capacidade: number | null
  valor_base: number | null
  publicada: boolean
  destaque: boolean
  dono_nome: string | null
  dono_email: string | null
  criadoem: string | null
}
type Status = 'pendentes' | 'publicadas' | 'todas'

const ABAS: { key: Status; label: string }[] = [
  { key: 'pendentes', label: 'Aguardando aprovação' },
  { key: 'publicadas', label: 'Publicadas' },
  { key: 'todas', label: 'Todas' },
]

export default function AdminPropriedades() {
  const [rows, setRows] = useState<Prop[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [status, setStatus] = useState<Status>('pendentes')
  const [q, setQ] = useState('')

  const carregar = useCallback(async (st: Status, busca: string) => {
    setLoading(true)
    setErro(null)
    try {
      const r = await fetch(`/api/admin/propriedades?status=${st}&q=${encodeURIComponent(busca)}`)
      if (!r.ok) throw new Error(r.status === 403 ? 'Acesso negado.' : `Erro ${r.status}`)
      const j = await r.json()
      setRows(j.propriedades ?? [])
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    carregar(status, q)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status])

  async function acao(id: Prop['id'], action: string) {
    const r = await fetch('/api/admin/propriedades', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, id }),
    })
    if (!r.ok) {
      const j = await r.json().catch(() => ({}))
      alert(j.error || 'Erro ao executar a ação.')
      return
    }
    carregar(status, q)
  }

  return (
    <div className="max-w-6xl p-8">
      <h1 className="text-2xl font-bold">Propriedades &amp; Aprovação</h1>
      <p className="mb-5 mt-1 text-sm text-[#a0a0b8]">
        Aprove espaços para irem ao ar, despublique e gerencie destaques.
      </p>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-lg border border-white/[0.07] bg-[#111118] p-1">
          {ABAS.map((a) => (
            <button
              key={a.key}
              onClick={() => setStatus(a.key)}
              className={`rounded-md px-3 py-1.5 text-sm ${
                status === a.key ? 'bg-[#ff385c] text-white' : 'text-[#a0a0b8] hover:bg-white/[0.04]'
              }`}
            >
              {a.label}
            </button>
          ))}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            carregar(status, q)
          }}
        >
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar nome, cidade ou dono…"
            className="w-64 rounded-lg border border-white/[0.08] bg-[#1a1a24] px-3.5 py-2 text-sm outline-none focus:border-[#ff385c]"
          />
        </form>
      </div>

      {loading && <div className="text-[#a0a0b8]">Carregando…</div>}
      {erro && <div className="rounded-lg border border-[#ff385c]/30 bg-[#ff385c]/10 px-4 py-3 text-[#ff385c]">{erro}</div>}

      {!loading && !erro && (
        <div className="overflow-hidden rounded-2xl border border-white/[0.07] bg-[#111118]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.07] text-left text-[0.72rem] uppercase tracking-wide text-[#5c5c78]">
                <th className="px-4 py-3">Espaço</th>
                <th className="px-4 py-3">Local</th>
                <th className="px-4 py-3">Dono</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-[#5c5c78]">
                    Nenhuma propriedade aqui.
                  </td>
                </tr>
              )}
              {rows.map((p) => (
                <tr key={String(p.id)} className="border-b border-white/[0.04] last:border-0">
                  <td className="px-4 py-3">
                    <div className="font-medium">{p.nome || 'Sem nome'}</div>
                    <div className="text-[0.75rem] text-[#5c5c78]">
                      {p.capacidade ? `${p.capacidade} pessoas` : '—'}
                      {p.valor_base ? ` · R$ ${Number(p.valor_base).toLocaleString('pt-BR')}` : ''}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[#a0a0b8]">
                    {[p.cidade, p.estado].filter(Boolean).join(' · ') || '—'}
                  </td>
                  <td className="px-4 py-3 text-[#a0a0b8]">{p.dono_nome || p.dono_email || '—'}</td>
                  <td className="px-4 py-3">
                    {p.publicada ? (
                      <span className="rounded bg-[#3ddc84]/15 px-2 py-0.5 text-[0.72rem] text-[#3ddc84]">no ar</span>
                    ) : (
                      <span className="rounded bg-[#f5a623]/15 px-2 py-0.5 text-[0.72rem] text-[#f5a623]">em revisão</span>
                    )}
                    {p.destaque && (
                      <span className="ml-1 rounded bg-[#8b5cf6]/15 px-2 py-0.5 text-[0.72rem] text-[#8b5cf6]">destaque</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      {p.publicada ? (
                        <button
                          onClick={() => acao(p.id, 'despublicar')}
                          className="rounded-md border border-[#ff385c]/30 px-2.5 py-1.5 text-[0.78rem] text-[#ff385c] hover:bg-white/[0.04]"
                        >
                          Despublicar
                        </button>
                      ) : (
                        <button
                          onClick={() => acao(p.id, 'aprovar')}
                          className="rounded-md border border-[#3ddc84]/30 px-2.5 py-1.5 text-[0.78rem] text-[#3ddc84] hover:bg-white/[0.04]"
                        >
                          Aprovar
                        </button>
                      )}
                      <button
                        onClick={() => acao(p.id, p.destaque ? 'remover_destaque' : 'destacar')}
                        className="rounded-md border border-white/[0.08] px-2.5 py-1.5 text-[0.78rem] hover:bg-white/[0.04]"
                      >
                        {p.destaque ? 'Tirar destaque' : 'Destacar'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
