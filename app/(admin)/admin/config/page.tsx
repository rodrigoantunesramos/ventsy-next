'use client'

import { useEffect, useState } from 'react'

type ConfigDef = {
  chave: string
  label: string
  desc?: string
  tipo: 'flag' | 'texto' | 'numero'
  padrao: boolean | string | number
  grupo: string
}

export default function AdminConfig() {
  const [catalogo, setCatalogo] = useState<ConfigDef[]>([])
  const [valores, setValores] = useState<Record<string, unknown>>({})
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/admin/config')
      .then(async (r) => {
        if (!r.ok) throw new Error(r.status === 403 ? 'Acesso negado.' : `Erro ${r.status}`)
        return r.json()
      })
      .then((j) => {
        setCatalogo(j.catalogo ?? [])
        setValores(j.valores ?? {})
      })
      .catch((e) => setErro((e as Error).message))
      .finally(() => setLoading(false))
  }, [])

  function set(chave: string, v: unknown) {
    setValores((prev) => ({ ...prev, [chave]: v }))
  }

  async function salvar() {
    setSalvando(true)
    setMsg(null)
    try {
      const r = await fetch('/api/admin/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ valores }),
      })
      if (!r.ok) {
        const j = await r.json().catch(() => ({}))
        setMsg(j.error || 'Erro ao salvar.')
        return
      }
      setMsg('Configurações salvas!')
    } finally {
      setSalvando(false)
    }
  }

  const grupos = Array.from(new Set(catalogo.map((c) => c.grupo)))

  return (
    <div className="max-w-3xl p-8">
      <h1 className="text-2xl font-bold">Configurações &amp; Feature-flags</h1>
      <p className="mb-6 mt-1 text-sm text-[#a0a0b8]">
        Ligue/desligue funcionalidades e edite textos do sistema sem precisar de deploy.
      </p>

      {loading && <div className="text-[#a0a0b8]">Carregando…</div>}
      {erro && <div className="rounded-lg border border-[#ff385c]/30 bg-[#ff385c]/10 px-4 py-3 text-[#ff385c]">{erro}</div>}

      {!loading && !erro && (
        <>
          {grupos.map((grupo) => (
            <div key={grupo} className="mb-5 rounded-2xl border border-white/[0.07] bg-[#111118] p-5">
              <div className="mb-4 font-bold">{grupo}</div>
              <div className="space-y-4">
                {catalogo
                  .filter((c) => c.grupo === grupo)
                  .map((c) => (
                    <div key={c.chave} className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="text-sm font-medium">{c.label}</div>
                        {c.desc && <div className="text-[0.75rem] text-[#5c5c78]">{c.desc}</div>}
                      </div>
                      {c.tipo === 'flag' ? (
                        <button
                          type="button"
                          onClick={() => set(c.chave, valores[c.chave] !== true)}
                          aria-pressed={valores[c.chave] === true}
                          className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                            valores[c.chave] === true ? 'bg-[#3ddc84]' : 'bg-white/[0.12]'
                          }`}
                        >
                          <span
                            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${
                              valores[c.chave] === true ? 'left-[22px]' : 'left-0.5'
                            }`}
                          />
                        </button>
                      ) : (
                        <input
                          value={typeof valores[c.chave] === 'string' ? (valores[c.chave] as string) : String(valores[c.chave] ?? '')}
                          onChange={(e) => set(c.chave, e.target.value)}
                          className="w-64 rounded-lg border border-white/[0.08] bg-[#1a1a24] px-3 py-1.5 text-sm outline-none focus:border-[#ff385c]"
                        />
                      )}
                    </div>
                  ))}
              </div>
            </div>
          ))}

          <div className="flex items-center gap-3">
            <button
              onClick={salvar}
              disabled={salvando}
              className="rounded-lg bg-[#ff385c] px-5 py-2.5 font-medium text-white disabled:opacity-60"
            >
              {salvando ? 'Salvando…' : 'Salvar configurações'}
            </button>
            {msg && <span className="text-sm text-[#a0a0b8]">{msg}</span>}
          </div>

          <div className="mt-8 rounded-xl border border-white/[0.07] bg-[#0d0d13] p-4 text-[0.8rem] text-[#a0a0b8]">
            Os valores ficam salvos e disponíveis ao código via <code>lib/plataformaConfigServer</code>. A aplicação de
            cada flag/texto nos pontos do site é incremental — conforme cada ponto passa a ler daqui em vez do valor fixo
            no código.
          </div>
        </>
      )}
    </div>
  )
}
