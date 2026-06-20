'use client'
import { useEffect, useRef, useState } from 'react'
import { ESTADOS, norm } from '@/lib/data'
import { useT } from './i18n/I18nProvider'

export interface OndeSelection {
  tipo: 'prop' | 'cidade' | 'bairro' | 'estado'
  id?: string
  label: string
  estado: string
  cidade?: string
  bairro?: string
}

interface Props {
  onSelect: (item: OndeSelection | null) => void
}

const POPULARES = ['RJ', 'SP', 'MG', 'BA', 'SC', 'RS', 'CE', 'PE']

// Uma opção da lista como DADO (não JSX) — é o que torna possível a navegação
// por teclado indexada (↑/↓/Enter) e o padrão ARIA combobox/listbox/option.
interface Opt {
  key: string
  icon: React.ReactNode
  title: string
  sub: string
  badge: string
  badgeColor: string
  selection: OndeSelection
}
interface Grupo { label: string; start: number; opts: Opt[] }

export default function OndeSearch({ onSelect }: Props) {
  const { dict } = useT()
  const [value, setValue]   = useState('')
  const [grupos, setGrupos] = useState<Grupo[]>([])
  const [status, setStatus] = useState<'idle' | 'loading' | 'empty'>('idle')
  const [open, setOpen]     = useState(false)
  const [active, setActive] = useState(-1) // índice achatado da opção destacada
  const ref         = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()

  // Lista achatada (na ordem de exibição) para indexar o teclado.
  const flat: Opt[] = grupos.flatMap(g => g.opts)

  // Atribui o índice achatado inicial de cada grupo (para o id das opções).
  const comOffsets = (gs: Omit<Grupo, 'start'>[]): Grupo[] => {
    let off = 0
    return gs.map(g => { const start = off; off += g.opts.length; return { ...g, start } })
  }

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [])

  // Mantém a opção destacada visível ao navegar por teclado.
  useEffect(() => {
    if (active < 0) return
    document.getElementById(`onde-opt-${active}`)?.scrollIntoView({ block: 'nearest' })
  }, [active])

  const choose = (opt: Opt) => {
    setValue(opt.selection.label)
    onSelect(opt.selection)
    setOpen(false)
    setActive(-1)
  }

  const clear = () => {
    setValue('')
    onSelect(null)
    setOpen(false)
    setActive(-1)
  }

  const gruposDefault = (): Grupo[] =>
    comOffsets([{
      label: `🔥 ${dict.componentes.onde.destinosPopulares}`,
      opts: ESTADOS.filter(e => POPULARES.includes(e.s)).map(e => ({
        key: `est-${e.s}`,
        icon: '📍',
        title: e.n,
        sub: `${e.s} · ${dict.componentes.onde.brasil}`,
        badge: dict.componentes.onde.badgeEstado,
        badgeColor: 'bg-gray-100 text-gray-500',
        selection: { tipo: 'estado', estado: e.s, label: `${e.n}, BR` } as OndeSelection,
      })),
    }])

  const buscar = async (q: string) => {
    setStatus('loading')
    setGrupos([])
    setActive(-1)

    const nq = norm(q)
    // Fonte única: a RPC (via /api/busca) já casa nome, cidade e bairro sem acento.
    const buscaRes = await fetch(`/api/busca?q=${encodeURIComponent(q)}`).then(r => r.json()).catch(() => ({ data: [] }))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const propsByName: any[] = buscaRes?.data ?? []
    const estadosMatch = ESTADOS.filter(e => norm(e.n).includes(nq) || norm(e.s).includes(nq))

    const bairroMap = new Map<string, { bairro: string; cidade: string; estado: string }>()
    const cidadeMap = new Map<string, { cidade: string; estado: string }>()
    propsByName.forEach(p => {
      if (p.bairro && norm(p.bairro).includes(nq)) {
        const k = `${p.bairro}-${p.cidade}-${p.estado}`
        if (!bairroMap.has(k)) bairroMap.set(k, { bairro: p.bairro, cidade: p.cidade || '', estado: p.estado || '' })
      }
      if (p.cidade && norm(p.cidade).includes(nq)) {
        const k = `${p.cidade}-${p.estado}`
        if (!cidadeMap.has(k)) cidadeMap.set(k, { cidade: p.cidade, estado: p.estado || '' })
      }
    })

    const gs: Omit<Grupo, 'start'>[] = []
    if (propsByName.length) {
      gs.push({
        label: `🏠 ${dict.componentes.onde.espacos}`,
        opts: propsByName.slice(0, 5).map(p => ({
          key: `prop-${p.id}`,
          icon: (p.imagem_url || p.foto_capa)
            ? <img src={p.imagem_url || p.foto_capa} alt="" className="w-full h-full object-cover" />
            : '🏠',
          title: p.nome,
          sub: `${p.cidade} · ${p.estado}`,
          badge: dict.componentes.onde.badgeEspaco,
          badgeColor: 'bg-[#fff0f3] text-[#ff385c]',
          selection: { tipo: 'prop', id: p.id, estado: p.estado || '', cidade: p.cidade || '', label: p.nome } as OndeSelection,
        })),
      })
    }
    if (bairroMap.size > 0) {
      gs.push({
        label: `🏘️ ${dict.componentes.onde.bairros}`,
        opts: Array.from(bairroMap.values()).slice(0, 4).map(b => ({
          key: `bairro-${b.bairro}-${b.cidade}`,
          icon: '🏘️',
          title: b.bairro,
          sub: `${b.cidade} · ${b.estado}`,
          badge: dict.componentes.onde.badgeBairro,
          badgeColor: 'bg-gray-100 text-gray-500',
          selection: { tipo: 'bairro', estado: b.estado, cidade: b.cidade, bairro: b.bairro, label: `${b.bairro}, ${b.cidade}` } as OndeSelection,
        })),
      })
    }
    if (cidadeMap.size > 0) {
      gs.push({
        label: `🏙️ ${dict.componentes.onde.cidades}`,
        opts: Array.from(cidadeMap.values()).slice(0, 4).map(c => ({
          key: `cidade-${c.cidade}-${c.estado}`,
          icon: '🏙️',
          title: c.cidade,
          sub: `${c.estado} · ${dict.componentes.onde.brasil}`,
          badge: dict.componentes.onde.badgeCidade,
          badgeColor: 'bg-gray-100 text-gray-500',
          selection: { tipo: 'cidade', estado: c.estado, cidade: c.cidade, label: `${c.cidade}, ${c.estado}` } as OndeSelection,
        })),
      })
    }
    if (estadosMatch.length) {
      gs.push({
        label: `📍 ${dict.componentes.onde.estados}`,
        opts: estadosMatch.slice(0, 3).map(e => ({
          key: `estm-${e.s}`,
          icon: '📍',
          title: e.n,
          sub: `${e.s} · ${dict.componentes.onde.brasil}`,
          badge: dict.componentes.onde.badgeEstado,
          badgeColor: 'bg-gray-100 text-gray-500',
          selection: { tipo: 'estado', estado: e.s, label: `${e.n}, BR` } as OndeSelection,
        })),
      })
    }

    setGrupos(comOffsets(gs))
    setStatus(gs.length ? 'idle' : 'empty')
  }

  const handleInput = (v: string) => {
    setValue(v)
    onSelect(null)
    setActive(-1)
    clearTimeout(debounceRef.current)
    if (!v.trim()) { setGrupos(gruposDefault()); setStatus('idle') }
    else debounceRef.current = setTimeout(() => buscar(v.trim()), 280)
  }

  const handleFocus = () => {
    setOpen(true)
    if (!value.trim()) { setGrupos(gruposDefault()); setStatus('idle') }
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { setOpen(false); return }
    if (!open) { if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); setOpen(true) } return }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(i => Math.min(i + 1, flat.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(i => Math.max(i - 1, flat.length ? 0 : -1)) }
    else if (e.key === 'Enter' && active >= 0 && flat[active]) { e.preventDefault(); choose(flat[active]) }
  }

  const mostraLista = open && (status === 'loading' || status === 'empty' || flat.length > 0)

  return (
    <div ref={ref} className="relative">
      <label htmlFor="onde-input" className="text-[.68rem] font-extrabold uppercase tracking-[.05em] text-gray-800 block">
        {dict.componentes.onde.label}
      </label>
      <div className="flex items-center relative">
        <input
          id="onde-input"
          role="combobox"
          aria-expanded={open}
          aria-controls="onde-listbox"
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? `onde-opt-${active}` : undefined}
          className="text-[.83rem] text-gray-600 bg-transparent border-none outline-none w-[180px] placeholder:text-gray-400"
          placeholder={dict.componentes.onde.placeholder}
          value={value}
          onChange={e => handleInput(e.target.value)}
          onFocus={handleFocus}
          onKeyDown={onKeyDown}
          autoComplete="off"
        />
        {value && (
          <button
            type="button"
            aria-label={dict.componentes.evento.limpar}
            className="text-gray-400 hover:text-gray-600 ml-1 text-sm transition-colors bg-transparent border-none cursor-pointer p-0"
            onClick={clear}
          >
            ✕
          </button>
        )}
      </div>

      {mostraLista && (
        <div
          id="onde-listbox"
          role="listbox"
          aria-label={dict.componentes.onde.label}
          className="absolute top-full left-0 mt-3 w-80 max-w-[calc(100vw-2.5rem)] bg-white rounded-2xl shadow-2xl border border-gray-100 z-[9999] max-h-80 overflow-y-auto"
        >
          {status === 'loading' && (
            <div className="flex items-center gap-2 px-4 py-3 text-gray-400 text-sm">
              <div className="w-4 h-4 border-2 border-gray-200 border-t-[#ff385c] rounded-full animate-spin" />
              {dict.componentes.onde.buscando}
            </div>
          )}
          {status === 'empty' && (
            <div className="px-4 py-6 text-center text-gray-400 text-sm">
              {dict.componentes.onde.semResultado} &ldquo;<strong className="text-gray-600">{value}</strong>&rdquo;
            </div>
          )}
          {status === 'idle' && grupos.map(g => (
            <div key={g.label} role="group" aria-label={g.label}>
              <div aria-hidden="true" className="px-4 pt-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                {g.label}
              </div>
              {g.opts.map((opt, j) => {
                const i = g.start + j
                const isActive = i === active
                return (
                  <div
                    key={opt.key}
                    id={`onde-opt-${i}`}
                    role="option"
                    aria-selected={isActive}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => choose(opt)}
                    className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer ${isActive ? 'bg-gray-100' : 'hover:bg-gray-50'}`}
                  >
                    <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-sm flex-shrink-0 overflow-hidden">
                      {opt.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-800 truncate">{opt.title}</div>
                      <div className="text-xs text-gray-400">{opt.sub}</div>
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${opt.badgeColor}`}>
                      {opt.badge}
                    </span>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
