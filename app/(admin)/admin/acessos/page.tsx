'use client'

import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { ADMIN_MODULOS, type AdminNivel } from '@/lib/adminRbac'

type Membro = {
  usuario_id: string
  papel: 'super_admin' | 'staff'
  permissoes: Record<string, AdminNivel>
  ativo: boolean
  nome: string | null
  email: string | null
  eu: boolean
}

const NIVEIS: { v: AdminNivel; label: string }[] = [
  { v: 'nenhum', label: 'Sem acesso' },
  { v: 'leitura', label: 'Ver' },
  { v: 'edicao', label: 'Editar' },
  { v: 'total', label: 'Total' },
]

export default function AdminAcessos() {
  const [rows, setRows] = useState<Membro[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [papel, setPapel] = useState('staff')
  const [editando, setEditando] = useState<Membro | null>(null)

  const carregar = useCallback(async () => {
    setLoading(true)
    setErro(null)
    try {
      const r = await fetch('/api/admin/acessos')
      if (!r.ok) throw new Error(r.status === 403 ? 'Apenas o super-admin gerencia acessos.' : `Erro ${r.status}`)
      const j = await r.json()
      setRows(j.membros ?? [])
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    carregar()
  }, [carregar])

  async function acao(body: Record<string, unknown>): Promise<boolean> {
    const r = await fetch('/api/admin/acessos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!r.ok) {
      const j = await r.json().catch(() => ({}))
      alert(j.error || 'Erro ao executar a ação.')
      return false
    }
    return true
  }

  async function adicionar(e: FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    if (await acao({ action: 'adicionar', email, papel })) {
      setEmail('')
      carregar()
    }
  }

  async function salvarPerms() {
    if (!editando) return
    if (await acao({ action: 'permissoes', id: editando.usuario_id, permissoes: editando.permissoes })) {
      setEditando(null)
      carregar()
    }
  }

  async function toggleAtivo(m: Membro) {
    if (await acao({ action: m.ativo ? 'desativar' : 'ativar', id: m.usuario_id })) carregar()
  }

  async function remover(m: Membro) {
    if (!confirm(`Remover acesso de ${m.email}?`)) return
    if (await acao({ action: 'remover', id: m.usuario_id })) carregar()
  }

  return (
    <div className="max-w-5xl p-8">
      <h1 className="text-2xl font-bold">Acessos da Equipe</h1>
      <p className="mb-6 mt-1 text-sm text-[#a0a0b8]">
        Conceda acesso ao admin a funcionários e defina o que cada um pode ver/fazer. Exclusivo do super-admin.
      </p>

      <form
        onSubmit={adicionar}
        className="mb-6 flex flex-wrap items-end gap-2 rounded-2xl border border-white/[0.07] bg-[#111118] p-4"
      >
        <div className="flex-1">
          <div className="mb-1 text-[0.72rem] uppercase tracking-wide text-[#5c5c78]">
            E-mail do funcionário (já com conta no Ventsy)
          </div>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="pessoa@email.com"
            className="w-full rounded-lg border border-white/[0.08] bg-[#1a1a24] px-3.5 py-2 text-sm outline-none focus:border-[#ff385c]"
          />
        </div>
        <select
          value={papel}
          onChange={(e) => setPapel(e.target.value)}
          className="rounded-lg border border-white/[0.08] bg-[#1a1a24] px-3 py-2 text-sm outline-none focus:border-[#ff385c]"
        >
          <option value="staff">Equipe</option>
          <option value="super_admin">Super-admin</option>
        </select>
        <button type="submit" className="rounded-lg bg-[#ff385c] px-4 py-2 text-sm font-medium text-white">
          Conceder acesso
        </button>
      </form>

      {loading && <div className="text-[#a0a0b8]">Carregando…</div>}
      {erro && <div className="rounded-lg border border-[#ff385c]/30 bg-[#ff385c]/10 px-4 py-3 text-[#ff385c]">{erro}</div>}

      {!loading && !erro && (
        <div className="space-y-2">
          {rows.map((m) => (
            <div
              key={m.usuario_id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/[0.07] bg-[#111118] p-4"
            >
              <div>
                <div className="font-medium">
                  {m.nome || m.email || m.usuario_id}
                  {m.eu && <span className="ml-2 text-[0.7rem] text-[#5c5c78]">(você)</span>}
                </div>
                <div className="text-[0.75rem] text-[#5c5c78]">{m.email}</div>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`rounded px-2 py-0.5 text-[0.72rem] ${
                    m.papel === 'super_admin' ? 'bg-[#8b5cf6]/15 text-[#8b5cf6]' : 'bg-white/[0.06] text-[#a0a0b8]'
                  }`}
                >
                  {m.papel === 'super_admin' ? 'Super-admin' : 'Equipe'}
                </span>
                {!m.ativo && <span className="rounded bg-[#ff385c]/15 px-2 py-0.5 text-[0.72rem] text-[#ff385c]">inativo</span>}
                {m.papel === 'staff' && (
                  <button
                    onClick={() => setEditando(m)}
                    className="rounded-md border border-white/[0.08] px-2.5 py-1.5 text-[0.78rem] hover:bg-white/[0.04]"
                  >
                    Permissões
                  </button>
                )}
                {!m.eu && (
                  <>
                    <button
                      onClick={() => toggleAtivo(m)}
                      className="rounded-md border border-white/[0.08] px-2.5 py-1.5 text-[0.78rem] hover:bg-white/[0.04]"
                    >
                      {m.ativo ? 'Desativar' : 'Reativar'}
                    </button>
                    <button
                      onClick={() => remover(m)}
                      className="rounded-md border border-[#ff385c]/30 px-2.5 py-1.5 text-[0.78rem] text-[#ff385c] hover:bg-white/[0.04]"
                    >
                      Remover
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {editando && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setEditando(null)
          }}
        >
          <div className="max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/[0.08] bg-[#15151d] p-6">
            <h2 className="mb-1 text-lg font-bold">Permissões — {editando.nome || editando.email}</h2>
            <p className="mb-4 text-[0.75rem] text-[#5c5c78]">
              Defina o nível por módulo. &quot;Acessos da Equipe&quot; é exclusivo do super-admin.
            </p>
            <div className="space-y-2">
              {ADMIN_MODULOS.filter((mod) => mod.key !== 'acessos').map((mod) => (
                <div key={mod.key} className="flex items-center justify-between gap-3">
                  <span className="text-sm">{mod.label}</span>
                  <select
                    value={editando.permissoes[mod.key] ?? 'nenhum'}
                    onChange={(e) =>
                      setEditando({
                        ...editando,
                        permissoes: { ...editando.permissoes, [mod.key]: e.target.value as AdminNivel },
                      })
                    }
                    className="rounded-lg border border-white/[0.08] bg-[#1a1a24] px-3 py-1.5 text-sm outline-none focus:border-[#ff385c]"
                  >
                    {NIVEIS.map((n) => (
                      <option key={n.v} value={n.v}>
                        {n.label}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setEditando(null)} className="rounded-lg px-4 py-2 text-sm text-[#a0a0b8] hover:bg-white/[0.04]">
                Cancelar
              </button>
              <button onClick={salvarPerms} className="rounded-lg bg-[#ff385c] px-4 py-2 text-sm font-medium text-white">
                Salvar permissões
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
