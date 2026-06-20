'use client'

import { useEffect, useMemo, useState } from 'react'

type Plano = { id: string; preco: number; items: string[]; status: string; modulos: string[] }
type ModRow = {
  key: string
  label: string
  grupo: string
  core: boolean
  planoDefault: string
  ativo: boolean
  vendavel: boolean
  preco_avulso: number
  destaque: boolean
  descricao: string
}

const PLANOS: { id: string; rotulo: string; emoji: string }[] = [
  { id: 'basico', rotulo: 'Básico', emoji: '🏷️' },
  { id: 'pro', rotulo: 'Pro', emoji: '⭐' },
  { id: 'ultra', rotulo: 'Ultra', emoji: '🚀' },
]
const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export default function AdminPlanos() {
  const [planos, setPlanos] = useState<Plano[]>([])
  const [mods, setMods] = useState<ModRow[]>([])
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
      .then((j) => {
        setPlanos(j.planos ?? [])
        setMods(j.modulos ?? [])
      })
      .catch((e) => setErro((e as Error).message))
      .finally(() => setLoading(false))
  }, [])

  // ── edição de planos ──────────────────────────────────────────────────────
  function updPlano(id: string, campo: keyof Plano, v: string | number | string[]) {
    setPlanos((ps) => ps.map((p) => (p.id === id ? { ...p, [campo]: v } : p)))
  }
  function temModulo(planoId: string, key: string) {
    return planos.find((p) => p.id === planoId)?.modulos.includes(key) ?? false
  }
  function toggleModulo(planoId: string, key: string) {
    setPlanos((ps) =>
      ps.map((p) => {
        if (p.id !== planoId) return p
        const tem = p.modulos.includes(key)
        return { ...p, modulos: tem ? p.modulos.filter((k) => k !== key) : [...p.modulos, key] }
      }),
    )
  }
  const coreKeys = useMemo(() => mods.filter((m) => m.core).map((m) => m.key), [mods])
  function setPlanoBulk(planoId: string, todos: boolean) {
    setPlanos((ps) =>
      ps.map((p) =>
        p.id === planoId ? { ...p, modulos: todos ? mods.map((m) => m.key) : [...coreKeys] } : p,
      ),
    )
  }

  // ── edição do catálogo de módulos ─────────────────────────────────────────
  function updMod(key: string, campo: keyof ModRow, v: string | number | boolean) {
    setMods((ms) => ms.map((m) => (m.key === key ? { ...m, [campo]: v } : m)))
  }

  async function salvar() {
    setSalvando(true)
    setMsg(null)
    try {
      const r = await fetch('/api/admin/planos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planos, modulos: mods }),
      })
      if (!r.ok) {
        const j = await r.json().catch(() => ({}))
        setMsg(j.error || 'Erro ao salvar.')
        return
      }
      setMsg('Salvo! Os cadeados do painel e a venda avulsa já refletem as mudanças.')
    } finally {
      setSalvando(false)
    }
  }

  // ── KPIs (header de finanças/planejamento) ────────────────────────────────
  const vendaveis = useMemo(() => mods.filter((m) => m.vendavel && m.ativo), [mods])
  const receitaAddon = useMemo(() => vendaveis.reduce((s, m) => s + (Number(m.preco_avulso) || 0), 0), [vendaveis])
  const grupos = useMemo(() => {
    const seen: string[] = []
    for (const m of mods) if (!seen.includes(m.grupo)) seen.push(m.grupo)
    return seen
  }, [mods])

  return (
    <div className="max-w-7xl p-8">
      <h1 className="text-2xl font-bold">Planos, Módulos &amp; Receita</h1>
      <p className="mb-6 mt-1 text-sm text-[#a0a0b8]">
        Controle total: defina preço e benefícios, escolha quais <strong className="text-[#f0f0f5]">módulos</strong> cada
        plano libera e venda <strong className="text-[#f0f0f5]">módulos avulsos</strong> por fora. O painel do dono mostra
        cadeado nos módulos fora do plano, convidando ao upgrade ou à compra do add-on.
      </p>

      {loading && <div className="text-[#a0a0b8]">Carregando…</div>}
      {erro && <div className="rounded-lg border border-[#ff385c]/30 bg-[#ff385c]/10 px-4 py-3 text-[#ff385c]">{erro}</div>}

      {!loading && !erro && (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {PLANOS.map((meta) => {
              const p = planos.find((x) => x.id === meta.id)
              return (
                <div key={meta.id} className="rounded-2xl border border-white/[0.07] bg-[#111118] p-4">
                  <div className="text-[0.72rem] uppercase tracking-wide text-[#5c5c78]">{meta.emoji} {meta.rotulo}</div>
                  <div className="mt-1 text-xl font-bold">{p ? (p.preco > 0 ? `${brl(p.preco)}/mês` : 'Grátis') : '—'}</div>
                  <div className="mt-0.5 text-[0.8rem] text-[#a0a0b8]">{p?.modulos.length ?? 0} módulos incluídos</div>
                </div>
              )
            })}
            <div className="rounded-2xl border border-[#ff385c]/20 bg-[#ff385c]/[0.06] p-4">
              <div className="text-[0.72rem] uppercase tracking-wide text-[#ff8fa3]">Add-ons à venda</div>
              <div className="mt-1 text-xl font-bold">{vendaveis.length} módulos</div>
              <div className="mt-0.5 text-[0.8rem] text-[#a0a0b8]">{brl(receitaAddon)}/mês de receita potencial</div>
            </div>
          </div>

          {/* Planos — preço / benefícios / status */}
          <h2 className="mb-3 mt-8 text-lg font-bold">Planos</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {planos.map((p) => (
              <div key={p.id} className="rounded-2xl border border-white/[0.07] bg-[#111118] p-5">
                <div className="mb-3 text-lg font-bold">{PLANOS.find((x) => x.id === p.id)?.rotulo ?? p.id}</div>

                <div className="mb-1 text-[0.72rem] uppercase tracking-wide text-[#5c5c78]">Preço mensal (R$)</div>
                <input
                  type="number"
                  min={0}
                  value={p.preco}
                  onChange={(e) => updPlano(p.id, 'preco', Number(e.target.value))}
                  className="mb-3 w-full rounded-lg border border-white/[0.08] bg-[#1a1a24] px-3.5 py-2 text-sm outline-none focus:border-[#ff385c]"
                />

                <div className="mb-1 text-[0.72rem] uppercase tracking-wide text-[#5c5c78]">Benefícios (um por linha)</div>
                <textarea
                  value={p.items.join('\n')}
                  onChange={(e) => updPlano(p.id, 'items', e.target.value.split('\n'))}
                  rows={5}
                  className="mb-3 w-full resize-y rounded-lg border border-white/[0.08] bg-[#1a1a24] px-3.5 py-2 text-sm outline-none focus:border-[#ff385c]"
                />

                <div className="mb-1 text-[0.72rem] uppercase tracking-wide text-[#5c5c78]">Status</div>
                <select
                  value={p.status}
                  onChange={(e) => updPlano(p.id, 'status', e.target.value)}
                  className="w-full rounded-lg border border-white/[0.08] bg-[#1a1a24] px-3.5 py-2 text-sm outline-none focus:border-[#ff385c]"
                >
                  <option value="ativo">Ativo</option>
                  <option value="oculto">Oculto</option>
                </select>
              </div>
            ))}
          </div>

          {/* Matriz Módulo × Plano + venda avulsa */}
          <div className="mb-3 mt-8 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="text-lg font-bold">Módulos por plano &amp; venda avulsa</h2>
              <p className="mt-0.5 text-sm text-[#a0a0b8]">
                Marque os módulos de cada plano. Ligue <strong className="text-[#f0f0f5]">Vendável</strong> e defina o preço
                para oferecer o módulo como add-on a quem não tem no plano.
              </p>
            </div>
            <div className="flex gap-2">
              {PLANOS.map((meta) => (
                <div key={meta.id} className="flex items-center gap-1 rounded-lg border border-white/[0.08] px-2 py-1 text-[0.72rem] text-[#a0a0b8]">
                  <span>{meta.rotulo}:</span>
                  <button onClick={() => setPlanoBulk(meta.id, true)} className="rounded px-1.5 py-0.5 hover:bg-white/[0.06]">Tudo</button>
                  <button onClick={() => setPlanoBulk(meta.id, false)} className="rounded px-1.5 py-0.5 hover:bg-white/[0.06]">Limpar</button>
                </div>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-white/[0.07] bg-[#111118]">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-white/[0.07] text-left text-[0.7rem] uppercase tracking-wide text-[#5c5c78]">
                  <th className="px-4 py-3">Módulo</th>
                  <th className="px-3 py-3 text-center">Básico</th>
                  <th className="px-3 py-3 text-center">Pro</th>
                  <th className="px-3 py-3 text-center">Ultra</th>
                  <th className="px-3 py-3 text-center">Ativo</th>
                  <th className="px-3 py-3 text-center">Vendável</th>
                  <th className="px-3 py-3 text-right">R$ avulso/mês</th>
                </tr>
              </thead>
              <tbody>
                {grupos.map((grupo) => (
                  <GrupoBloco
                    key={grupo}
                    grupo={grupo}
                    rows={mods.filter((m) => m.grupo === grupo)}
                    temModulo={temModulo}
                    toggleModulo={toggleModulo}
                    updMod={updMod}
                  />
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-5 flex items-center gap-3">
            <button
              onClick={salvar}
              disabled={salvando}
              className="rounded-lg bg-[#ff385c] px-5 py-2.5 font-medium text-white disabled:opacity-60"
            >
              {salvando ? 'Salvando…' : 'Salvar tudo'}
            </button>
            {msg && <span className="text-sm text-[#a0a0b8]">{msg}</span>}
          </div>

          <div className="mt-8 rounded-xl border border-white/[0.07] bg-[#0d0d13] p-4 text-sm text-[#a0a0b8]">
            <strong className="text-[#f0f0f5]">Como funciona o cadeado</strong> — módulos fora do plano aparecem travados no
            menu do dono (com selo do plano que destrava). Ao abrir, ele vê o convite de upgrade e, se o módulo for
            <em> Vendável</em>, pode comprar só ele (Mercado Pago, ativação na hora). Módulos com <em>Ativo</em> desligado
            somem para todos. <strong className="text-[#f0f0f5]">Núcleo</strong> (Painel, Configurações, Planos) nunca trava.
          </div>
        </>
      )}
    </div>
  )
}

function GrupoBloco({
  grupo, rows, temModulo, toggleModulo, updMod,
}: {
  grupo: string
  rows: ModRow[]
  temModulo: (planoId: string, key: string) => boolean
  toggleModulo: (planoId: string, key: string) => void
  updMod: (key: string, campo: keyof ModRow, v: string | number | boolean) => void
}) {
  return (
    <>
      <tr className="bg-white/[0.02]">
        <td colSpan={7} className="px-4 py-1.5 text-[0.68rem] font-bold uppercase tracking-[0.08em] text-[#5c5c78]">
          {grupo}
        </td>
      </tr>
      {rows.map((m) => (
        <tr key={m.key} className="border-b border-white/[0.04] last:border-0">
          <td className="px-4 py-2.5">
            <span className="font-medium">{m.label}</span>
            {m.core && <span className="ml-2 rounded bg-white/[0.06] px-1.5 py-0.5 text-[0.6rem] uppercase tracking-wide text-[#5c5c78]">núcleo</span>}
          </td>
          {['basico', 'pro', 'ultra'].map((pid) => (
            <td key={pid} className="px-3 py-2.5 text-center">
              <input
                type="checkbox"
                checked={m.core ? true : temModulo(pid, m.key)}
                disabled={m.core}
                onChange={() => toggleModulo(pid, m.key)}
                className="h-4 w-4 cursor-pointer accent-[#ff385c] disabled:cursor-not-allowed disabled:opacity-40"
              />
            </td>
          ))}
          <td className="px-3 py-2.5 text-center">
            <input
              type="checkbox"
              checked={m.core ? true : m.ativo}
              disabled={m.core}
              onChange={(e) => updMod(m.key, 'ativo', e.target.checked)}
              className="h-4 w-4 cursor-pointer accent-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
            />
          </td>
          <td className="px-3 py-2.5 text-center">
            <input
              type="checkbox"
              checked={m.core ? false : m.vendavel}
              disabled={m.core}
              onChange={(e) => updMod(m.key, 'vendavel', e.target.checked)}
              className="h-4 w-4 cursor-pointer accent-amber-500 disabled:cursor-not-allowed disabled:opacity-40"
            />
          </td>
          <td className="px-3 py-2.5 text-right">
            <input
              type="number"
              min={0}
              value={m.preco_avulso}
              disabled={m.core || !m.vendavel}
              onChange={(e) => updMod(m.key, 'preco_avulso', Number(e.target.value))}
              className="w-24 rounded-md border border-white/[0.08] bg-[#1a1a24] px-2.5 py-1.5 text-right text-sm outline-none focus:border-[#ff385c] disabled:opacity-40"
            />
          </td>
        </tr>
      ))}
    </>
  )
}
