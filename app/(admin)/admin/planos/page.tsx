'use client'

import { useEffect, useState } from 'react'

type Plano = { id: string; preco: number; items: string[]; status: string }

const ROTULO: Record<string, string> = { basico: 'Básico', pro: 'Pro', ultra: 'Ultra' }

export default function AdminPlanos() {
  const [planos, setPlanos] = useState<Plano[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/admin/planos')
      .then(async (r) => {
        if (!r.ok) throw new Error(r.status === 403 ? 'Acesso negado.' : `Erro ${r.status}`)
        return r.json()
      })
      .then((j) => setPlanos(j.planos ?? []))
      .catch((e) => setErro((e as Error).message))
      .finally(() => setLoading(false))
  }, [])

  function upd(id: string, campo: keyof Plano, v: string | number | string[]) {
    setPlanos((ps) => ps.map((p) => (p.id === id ? { ...p, [campo]: v } : p)))
  }

  async function salvar() {
    setSalvando(true)
    setMsg(null)
    try {
      const r = await fetch('/api/admin/planos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planos }),
      })
      if (!r.ok) {
        const j = await r.json().catch(() => ({}))
        setMsg(j.error || 'Erro ao salvar.')
        return
      }
      setMsg('Planos salvos! As páginas pública e do painel já refletem os novos valores.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="max-w-6xl p-8">
      <h1 className="text-2xl font-bold">Planos &amp; Preços</h1>
      <p className="mb-6 mt-1 text-sm text-[#a0a0b8]">
        Edite preço, benefícios e status de cada plano. Salvar grava na fonte única (planos_config),
        refletida nas páginas pública e do painel.
      </p>

      {loading && <div className="text-[#a0a0b8]">Carregando…</div>}
      {erro && <div className="rounded-lg border border-[#ff385c]/30 bg-[#ff385c]/10 px-4 py-3 text-[#ff385c]">{erro}</div>}

      {!loading && !erro && (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {planos.map((p) => (
              <div key={p.id} className="rounded-2xl border border-white/[0.07] bg-[#111118] p-5">
                <div className="mb-3 text-lg font-bold">{ROTULO[p.id] ?? p.id}</div>

                <div className="mb-1 text-[0.72rem] uppercase tracking-wide text-[#5c5c78]">Preço mensal (R$)</div>
                <input
                  type="number"
                  min={0}
                  value={p.preco}
                  onChange={(e) => upd(p.id, 'preco', Number(e.target.value))}
                  className="mb-3 w-full rounded-lg border border-white/[0.08] bg-[#1a1a24] px-3.5 py-2 text-sm outline-none focus:border-[#ff385c]"
                />

                <div className="mb-1 text-[0.72rem] uppercase tracking-wide text-[#5c5c78]">Benefícios (um por linha)</div>
                <textarea
                  value={p.items.join('\n')}
                  onChange={(e) => upd(p.id, 'items', e.target.value.split('\n'))}
                  rows={5}
                  className="mb-3 w-full resize-y rounded-lg border border-white/[0.08] bg-[#1a1a24] px-3.5 py-2 text-sm outline-none focus:border-[#ff385c]"
                />

                <div className="mb-1 text-[0.72rem] uppercase tracking-wide text-[#5c5c78]">Status</div>
                <select
                  value={p.status}
                  onChange={(e) => upd(p.id, 'status', e.target.value)}
                  className="w-full rounded-lg border border-white/[0.08] bg-[#1a1a24] px-3.5 py-2 text-sm outline-none focus:border-[#ff385c]"
                >
                  <option value="ativo">Ativo</option>
                  <option value="oculto">Oculto</option>
                </select>
              </div>
            ))}
          </div>

          <div className="mt-5 flex items-center gap-3">
            <button
              onClick={salvar}
              disabled={salvando}
              className="rounded-lg bg-[#ff385c] px-5 py-2.5 font-medium text-white disabled:opacity-60"
            >
              {salvando ? 'Salvando…' : 'Salvar planos'}
            </button>
            {msg && <span className="text-sm text-[#a0a0b8]">{msg}</span>}
          </div>

          <div className="mt-8 rounded-xl border border-white/[0.07] bg-[#0d0d13] p-4 text-sm text-[#a0a0b8]">
            <strong className="text-[#f0f0f5]">Comissão da plataforma</strong> — a taxa cobrada apenas nos eventos
            fechados dentro da Ventsy agora é editável em <strong>Configurações → Comissão (eventos via Ventsy)</strong>.
            O checkout lê esses percentuais (com fallback ao padrão), sem alterar a lógica de pagamento.
          </div>
        </>
      )}
    </div>
  )
}
