'use client'

import { useCallback, useEffect, useState, type FormEvent } from 'react'
import ModulosUsuario from './_ModulosUsuario'

type Usuario = {
  id: string
  nome: string | null
  usuario: string | null
  email: string | null
  telefone: string | null
  criado_em: string | null
  cadastro_completo: boolean | null
  plano: string
  status: string
  bloqueado: boolean
}

export default function AdminUsuarios() {
  const [rows, setRows] = useState<Usuario[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [editando, setEditando] = useState<Usuario | null>(null)
  const [modsUser, setModsUser] = useState<Usuario | null>(null)
  const [salvando, setSalvando] = useState(false)

  const carregar = useCallback(async (busca: string) => {
    setLoading(true)
    setErro(null)
    try {
      const r = await fetch(`/api/admin/usuarios?q=${encodeURIComponent(busca)}`)
      if (!r.ok) throw new Error(r.status === 403 ? 'Acesso negado.' : `Erro ${r.status}`)
      const j = await r.json()
      setRows(j.usuarios ?? [])
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    carregar('')
  }, [carregar])

  async function acao(body: Record<string, unknown>): Promise<boolean> {
    const r = await fetch('/api/admin/usuarios', {
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

  async function toggleBloqueio(u: Usuario) {
    const verbo = u.bloqueado ? 'reativar' : 'bloquear'
    if (!confirm(`Confirmar ${verbo} ${u.nome || u.email || 'este usuário'}?`)) return
    if (await acao({ action: verbo, id: u.id })) carregar(q)
  }

  async function resetSenha(u: Usuario) {
    if (!confirm(`Enviar redefinição de senha para ${u.email || u.nome || 'este usuário'}?`)) return
    const r = await fetch('/api/admin/usuarios', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reset_senha', id: u.id }),
    })
    const j = await r.json().catch(() => ({}))
    if (!r.ok) {
      alert(j.error || 'Erro ao gerar a redefinição.')
      return
    }
    if (j.enviado) alert('E-mail de redefinição enviado ao usuário.')
    else if (j.link) prompt('SMTP não configurado — copie e envie este link de redefinição ao usuário:', j.link)
    else alert('Link gerado, mas não foi possível enviar nem exibir.')
  }

  async function impersonar(u: Usuario) {
    if (!confirm(`Entrar como ${u.nome || u.email}? Abra em uma aba anônima para não encerrar sua sessão de admin.`)) return
    const r = await fetch('/api/admin/usuarios', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'impersonar', id: u.id }),
    })
    const j = await r.json().catch(() => ({}))
    if (!r.ok) {
      alert(j.error || (r.status === 403 ? 'Apenas o super-admin pode impersonar.' : 'Erro ao gerar o acesso.'))
      return
    }
    if (j.link) window.open(j.link, '_blank')
    else alert('Não foi possível gerar o link de acesso.')
  }

  async function salvarEdicao(e: FormEvent) {
    e.preventDefault()
    if (!editando) return
    setSalvando(true)
    const ok = await acao({
      action: 'editar',
      id: editando.id,
      nome: editando.nome,
      usuario: editando.usuario,
      telefone: editando.telefone,
    })
    setSalvando(false)
    if (ok) {
      setEditando(null)
      carregar(q)
    }
  }

  function exportarCsv() {
    const cols: (keyof Usuario)[] = ['id', 'nome', 'usuario', 'email', 'telefone', 'plano', 'status', 'bloqueado', 'criado_em']
    const linhas = rows.map((r) => cols.map((k) => JSON.stringify(r[k] ?? '')).join(','))
    const csv = [cols.join(','), ...linhas].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'usuarios.csv'
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <div className="max-w-6xl p-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Usuários &amp; Contas</h1>
          <p className="mt-1 text-sm text-[#a0a0b8]">Lista, edição e bloqueio — via service-role (ignora RLS).</p>
        </div>
        <div className="flex items-center gap-2">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              carregar(q)
            }}
          >
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar nome, e-mail ou @handle…"
              className="w-64 rounded-lg border border-white/[0.08] bg-[#1a1a24] px-3.5 py-2 text-sm outline-none focus:border-[#ff385c]"
            />
          </form>
          <button
            onClick={exportarCsv}
            className="rounded-lg border border-white/[0.08] px-3 py-2 text-sm text-[#a0a0b8] hover:bg-white/[0.04]"
          >
            Exportar CSV
          </button>
        </div>
      </div>

      {loading && <div className="text-[#a0a0b8]">Carregando…</div>}
      {erro && (
        <div className="rounded-lg border border-[#ff385c]/30 bg-[#ff385c]/10 px-4 py-3 text-[#ff385c]">{erro}</div>
      )}

      {!loading && !erro && (
        <div className="overflow-hidden rounded-2xl border border-white/[0.07] bg-[#111118]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.07] text-left text-[0.72rem] uppercase tracking-wide text-[#5c5c78]">
                <th className="px-4 py-3">Usuário</th>
                <th className="px-4 py-3">E-mail</th>
                <th className="px-4 py-3">Plano</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Cadastro</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-[#5c5c78]">
                    Nenhum usuário encontrado.
                  </td>
                </tr>
              )}
              {rows.map((u) => (
                <tr key={u.id} className="border-b border-white/[0.04] last:border-0">
                  <td className="px-4 py-3">
                    <div className="font-medium">{u.nome || 'Sem nome'}</div>
                    <div className="text-[0.75rem] text-[#5c5c78]">@{u.usuario || '—'}</div>
                  </td>
                  <td className="px-4 py-3 text-[#a0a0b8]">{u.email || '—'}</td>
                  <td className="px-4 py-3">{u.plano}</td>
                  <td className="px-4 py-3">
                    {u.bloqueado ? (
                      <span className="rounded bg-[#ff385c]/15 px-2 py-0.5 text-[0.72rem] text-[#ff385c]">bloqueado</span>
                    ) : (
                      <span className="text-[#a0a0b8]">{u.status}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-[#5c5c78]">
                    {u.criado_em ? new Date(u.criado_em).toLocaleDateString('pt-BR') : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => setEditando(u)}
                        className="rounded-md border border-white/[0.08] px-2.5 py-1.5 text-[0.78rem] hover:bg-white/[0.04]"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => setModsUser(u)}
                        className="rounded-md border border-white/[0.08] px-2.5 py-1.5 text-[0.78rem] hover:bg-white/[0.04]"
                      >
                        Módulos
                      </button>
                      <button
                        onClick={() => resetSenha(u)}
                        className="rounded-md border border-white/[0.08] px-2.5 py-1.5 text-[0.78rem] hover:bg-white/[0.04]"
                      >
                        Senha
                      </button>
                      <button
                        onClick={() => impersonar(u)}
                        className="rounded-md border border-white/[0.08] px-2.5 py-1.5 text-[0.78rem] hover:bg-white/[0.04]"
                      >
                        Entrar como
                      </button>
                      <button
                        onClick={() => toggleBloqueio(u)}
                        className={`rounded-md px-2.5 py-1.5 text-[0.78rem] hover:bg-white/[0.04] ${
                          u.bloqueado
                            ? 'border border-[#3ddc84]/30 text-[#3ddc84]'
                            : 'border border-[#ff385c]/30 text-[#ff385c]'
                        }`}
                      >
                        {u.bloqueado ? 'Reativar' : 'Bloquear'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editando && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setEditando(null)
          }}
        >
          <form onSubmit={salvarEdicao} className="w-full max-w-md rounded-2xl border border-white/[0.08] bg-[#15151d] p-6">
            <h2 className="mb-4 text-lg font-bold">Editar usuário</h2>
            <Campo label="Nome" value={editando.nome ?? ''} onChange={(v) => setEditando({ ...editando, nome: v })} />
            <Campo label="Handle (@usuario)" value={editando.usuario ?? ''} onChange={(v) => setEditando({ ...editando, usuario: v })} />
            <Campo label="Telefone" value={editando.telefone ?? ''} onChange={(v) => setEditando({ ...editando, telefone: v })} />
            <div className="mt-2 text-[0.72rem] text-[#5c5c78]">E-mail e papel de admin são geridos em telas próprias.</div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditando(null)}
                className="rounded-lg px-4 py-2 text-sm text-[#a0a0b8] hover:bg-white/[0.04]"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={salvando}
                className="rounded-lg bg-[#ff385c] px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
              >
                {salvando ? 'Salvando…' : 'Salvar'}
              </button>
            </div>
          </form>
        </div>
      )}

      {modsUser && (
        <ModulosUsuario
          usuario={{ id: modsUser.id, nome: modsUser.nome, email: modsUser.email }}
          onClose={() => setModsUser(null)}
        />
      )}
    </div>
  )
}

function Campo({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="mb-3 block">
      <span className="mb-1 block text-[0.72rem] uppercase tracking-wide text-[#5c5c78]">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-white/[0.08] bg-[#1a1a24] px-3.5 py-2 text-sm outline-none focus:border-[#ff385c]"
      />
    </label>
  )
}
