'use client'

import { useCallback, useEffect, useState } from 'react'

type Aval = {
  id: number
  autor: string
  nota: number
  texto: string
  propriedade: string
  oculta: boolean
  destaque: boolean
  verificada: boolean
  criado_em: string | null
}
type Filtro = 'todas' | 'visiveis' | 'ocultas'

const ABAS: { v: Filtro; label: string }[] = [
  { v: 'todas', label: 'Todas' },
  { v: 'visiveis', label: 'Visíveis' },
  { v: 'ocultas', label: 'Ocultas' },
]

function estrelas(n: number) {
  const cheias = Math.max(0, Math.min(5, n))
  return '★'.repeat(cheias) + '☆'.repeat(5 - cheias)
}

export default function AdminModeracao() {
  const [rows, setRows] = useState<Aval[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [filtro, setFiltro] = useState<Filtro>('todas')

  const carregar = useCallback(async (f: Filtro) => {
    setLoading(true)
    setErro(null)
    try {
      const r = await fetch(`/api/admin/moderacao?filtro=${f}`)
      if (!r.ok) throw new Error(r.status === 403 ? 'Acesso negado.' : `Erro ${r.status}`)
      const j = await r.json()
      setRows(j.avaliacoes ?? [])
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    carregar(filtro)
  }, [carregar, filtro])

  async function acao(id: number, action: string) {
    if (action === 'excluir' && !confirm('Excluir esta avaliação permanentemente?')) return
    const r = await fetch('/api/admin/moderacao', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, id }),
    })
    if (!r.ok) {
      const j = await r.json().catch(() => ({}))
      alert(j.error || 'Erro ao executar a ação.')
      return
    }
    carregar(filtro)
  }

  return (
    <div className="max-w-4xl p-8">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Conteúdo &amp; Moderação</h1>
          <p className="mt-1 text-sm text-[#a0a0b8]">Modere as avaliações públicas: oculte, destaque ou remova.</p>
        </div>
        <div className="flex gap-1 rounded-lg border border-white/[0.07] bg-[#111118] p-1">
          {ABAS.map((a) => (
            <button
              key={a.v}
              onClick={() => setFiltro(a.v)}
              className={`rounded-md px-3 py-1.5 text-sm ${
                filtro === a.v ? 'bg-[#ff385c] text-white' : 'text-[#a0a0b8] hover:bg-white/[0.04]'
              }`}
            >
              {a.label}
            </button>
          ))}
        </div>
      </div>

      {loading && <div className="text-[#a0a0b8]">Carregando…</div>}
      {erro && <div className="rounded-lg border border-[#ff385c]/30 bg-[#ff385c]/10 px-4 py-3 text-[#ff385c]">{erro}</div>}

      {!loading && !erro && (
        <div className="space-y-3">
          {rows.length === 0 && (
            <div className="rounded-2xl border border-white/[0.07] bg-[#111118] p-10 text-center text-[#5c5c78]">
              Nenhuma avaliação aqui.
            </div>
          )}
          {rows.map((a) => (
            <div
              key={a.id}
              className={`rounded-xl border bg-[#111118] p-4 ${a.oculta ? 'border-[#ff385c]/20 opacity-70' : 'border-white/[0.07]'}`}
            >
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <span className="font-medium">{a.autor}</span>
                <span className="text-[#f5a623]">{estrelas(a.nota)}</span>
                {a.verificada && <span className="rounded bg-[#3ddc84]/15 px-1.5 py-0.5 text-[0.65rem] text-[#3ddc84]">verificada</span>}
                {a.oculta && <span className="rounded bg-[#ff385c]/15 px-1.5 py-0.5 text-[0.65rem] text-[#ff385c]">oculta</span>}
                {a.destaque && <span className="rounded bg-[#8b5cf6]/15 px-1.5 py-0.5 text-[0.65rem] text-[#8b5cf6]">destaque</span>}
              </div>
              <div className="mb-2 text-[0.7rem] text-[#5c5c78]">
                {a.propriedade} · {a.criado_em ? new Date(a.criado_em).toLocaleDateString('pt-BR') : '—'}
              </div>
              <div className="mb-3 text-sm text-[#d0d0dc]">
                {a.texto || <span className="text-[#5c5c78]">(sem texto)</span>}
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => acao(a.id, a.oculta ? 'mostrar' : 'ocultar')}
                  className="rounded-md border border-white/[0.08] px-2.5 py-1.5 text-[0.78rem] hover:bg-white/[0.04]"
                >
                  {a.oculta ? 'Mostrar' : 'Ocultar'}
                </button>
                <button
                  onClick={() => acao(a.id, a.destaque ? 'remover_destaque' : 'destacar')}
                  className="rounded-md border border-white/[0.08] px-2.5 py-1.5 text-[0.78rem] hover:bg-white/[0.04]"
                >
                  {a.destaque ? 'Tirar destaque' : 'Destacar'}
                </button>
                <button
                  onClick={() => acao(a.id, 'excluir')}
                  className="rounded-md border border-[#ff385c]/30 px-2.5 py-1.5 text-[0.78rem] text-[#ff385c] hover:bg-white/[0.04]"
                >
                  Excluir
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
