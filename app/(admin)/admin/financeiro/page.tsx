'use client'

import { useEffect, useState } from 'react'
import { formatMoney } from '@/lib/format'

type Metricas = {
  mrr: number
  arr: number
  ativas: number
  trial: number
  canceladas: number
  receitaHistorica: number
  total: number
}
type Assinatura = {
  usuario: string
  plano: string
  status: string
  inicio: string | null
  fim: string | null
  valor_pago: number
}

export default function AdminFinanceiro() {
  const [m, setM] = useState<Metricas | null>(null)
  const [rows, setRows] = useState<Assinatura[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/admin/financeiro')
      .then(async (r) => {
        if (!r.ok) throw new Error(r.status === 403 ? 'Acesso negado.' : `Erro ${r.status}`)
        return r.json()
      })
      .then((j) => {
        setM(j.metricas)
        setRows(j.assinaturas ?? [])
      })
      .catch((e) => setErro((e as Error).message))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="max-w-6xl p-8">
      <h1 className="text-2xl font-bold">Assinaturas &amp; Financeiro</h1>
      <p className="mb-6 mt-1 text-sm text-[#a0a0b8]">
        Receita recorrente e assinaturas de todos os anunciantes — via service-role (o admin antigo via zerado).
      </p>

      {loading && <div className="text-[#a0a0b8]">Carregando…</div>}
      {erro && <div className="rounded-lg border border-[#ff385c]/30 bg-[#ff385c]/10 px-4 py-3 text-[#ff385c]">{erro}</div>}

      {m && (
        <>
          <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
            <Card label="MRR" value={formatMoney(m.mrr)} />
            <Card label="ARR" value={formatMoney(m.arr)} />
            <Card label="Assinaturas ativas" value={String(m.ativas)} sub={`${m.trial} em trial`} />
            <Card label="Receita histórica" value={formatMoney(m.receitaHistorica)} sub={`${m.canceladas} canceladas`} />
          </div>

          <div className="overflow-hidden rounded-2xl border border-white/[0.07] bg-[#111118]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.07] text-left text-[0.72rem] uppercase tracking-wide text-[#5c5c78]">
                  <th className="px-4 py-3">Anunciante</th>
                  <th className="px-4 py-3">Plano</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Período</th>
                  <th className="px-4 py-3 text-right">Pago</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-[#5c5c78]">
                      Nenhuma assinatura.
                    </td>
                  </tr>
                )}
                {rows.map((a, i) => (
                  <tr key={i} className="border-b border-white/[0.04] last:border-0">
                    <td className="px-4 py-3">{a.usuario}</td>
                    <td className="px-4 py-3">{a.plano}</td>
                    <td className="px-4 py-3 text-[#a0a0b8]">{a.status}</td>
                    <td className="px-4 py-3 text-[#5c5c78]">
                      {a.inicio ? new Date(a.inicio).toLocaleDateString('pt-BR') : '—'}
                      {a.fim ? ` → ${new Date(a.fim).toLocaleDateString('pt-BR')}` : ''}
                    </td>
                    <td className="px-4 py-3 text-right">{formatMoney(a.valor_pago)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}

function Card({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-[#111118] p-5">
      <div className="mb-1 text-[0.72rem] uppercase tracking-wide text-[#5c5c78]">{label}</div>
      <div className="text-2xl font-bold">{value}</div>
      {sub && <div className="mt-1 text-[0.72rem] text-[#a0a0b8]">{sub}</div>}
    </div>
  )
}
