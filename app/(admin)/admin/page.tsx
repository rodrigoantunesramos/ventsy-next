'use client'

import { useEffect, useState } from 'react'

type Overview = {
  usuarios: number
  propriedades: { total: number; publicadas: number; pendentes: number }
  assinaturas: {
    total: number
    porStatus: Record<string, number>
    ativasPorPlano: Record<string, number>
  }
  cupons: number
}

export default function AdminDashboard() {
  const [data, setData] = useState<Overview | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/admin/overview')
      .then(async (r) => {
        if (!r.ok) throw new Error(r.status === 403 ? 'Acesso negado.' : `Erro ${r.status}`)
        return r.json()
      })
      .then(setData)
      .catch((e) => setErro(e.message))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="max-w-6xl p-8">
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <p className="mb-6 mt-1 text-sm text-[#a0a0b8]">
        Visão geral da plataforma — dados reais via service-role (inclui o que a RLS escondia do
        admin antigo, como assinaturas).
      </p>

      {loading && <div className="text-[#a0a0b8]">Carregando…</div>}

      {erro && (
        <div className="rounded-lg border border-[#ff385c]/30 bg-[#ff385c]/10 px-4 py-3 text-[#ff385c]">
          {erro}
        </div>
      )}

      {data && (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Card label="Usuários" value={data.usuarios} />
          <Card
            label="Propriedades"
            value={data.propriedades.total}
            sub={`${data.propriedades.publicadas} no ar · ${data.propriedades.pendentes} pendentes`}
          />
          <Card
            label="Assinaturas"
            value={data.assinaturas.total}
            sub={
              Object.entries(data.assinaturas.porStatus)
                .map(([k, v]) => `${v} ${k}`)
                .join(' · ') || '—'
            }
          />
          <Card label="Cupons" value={data.cupons} />
        </div>
      )}
    </div>
  )
}

function Card({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-[#111118] p-5">
      <div className="mb-1 text-[0.72rem] uppercase tracking-wide text-[#5c5c78]">{label}</div>
      <div className="text-3xl font-bold">{value}</div>
      {sub && <div className="mt-1 text-[0.72rem] text-[#a0a0b8]">{sub}</div>}
    </div>
  )
}
