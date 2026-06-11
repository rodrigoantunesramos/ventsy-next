'use client'

import { useCallback, useEffect, useState } from 'react'
import { ADMIN_MODULOS } from '@/lib/adminRbac'

type Reg = {
  id: number
  ator_email: string | null
  modulo: string
  acao: string
  alvo: string | null
  criado_em: string
}

export default function AdminAuditoria() {
  const [rows, setRows] = useState<Reg[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [modulo, setModulo] = useState('')

  const carregar = useCallback(async (m: string) => {
    setLoading(true)
    setErro(null)
    try {
      const r = await fetch(`/api/admin/auditoria${m ? `?modulo=${m}` : ''}`)
      if (!r.ok) throw new Error(r.status === 403 ? 'Acesso negado.' : `Erro ${r.status}`)
      const j = await r.json()
      setRows(j.registros ?? [])
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    carregar(modulo)
  }, [carregar, modulo])

  return (
    <div className="max-w-5xl p-8">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Auditoria &amp; Logs</h1>
          <p className="mt-1 text-sm text-[#a0a0b8]">
            Trilha imutável das ações feitas no admin (quem, o quê, quando). Substitui os logs em localStorage.
          </p>
        </div>
        <select
          value={modulo}
          onChange={(e) => setModulo(e.target.value)}
          className="rounded-lg border border-white/[0.08] bg-[#1a1a24] px-3 py-2 text-sm outline-none focus:border-[#ff385c]"
        >
          <option value="">Todos os módulos</option>
          {ADMIN_MODULOS.map((m) => (
            <option key={m.key} value={m.key}>
              {m.label}
            </option>
          ))}
        </select>
      </div>

      {loading && <div className="text-[#a0a0b8]">Carregando…</div>}
      {erro && <div className="rounded-lg border border-[#ff385c]/30 bg-[#ff385c]/10 px-4 py-3 text-[#ff385c]">{erro}</div>}

      {!loading && !erro && (
        <div className="overflow-hidden rounded-2xl border border-white/[0.07] bg-[#111118]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.07] text-left text-[0.72rem] uppercase tracking-wide text-[#5c5c78]">
                <th className="px-4 py-3">Quando</th>
                <th className="px-4 py-3">Quem</th>
                <th className="px-4 py-3">Módulo</th>
                <th className="px-4 py-3">Ação</th>
                <th className="px-4 py-3">Alvo</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-[#5c5c78]">
                    Nenhuma ação registrada ainda. A trilha popula conforme o admin é usado.
                  </td>
                </tr>
              )}
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-white/[0.04] last:border-0">
                  <td className="px-4 py-3 text-[#5c5c78]">{new Date(r.criado_em).toLocaleString('pt-BR')}</td>
                  <td className="px-4 py-3 text-[#a0a0b8]">{r.ator_email || '—'}</td>
                  <td className="px-4 py-3">{r.modulo}</td>
                  <td className="px-4 py-3">{r.acao}</td>
                  <td className="px-4 py-3 text-[#a0a0b8]">{r.alvo || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
