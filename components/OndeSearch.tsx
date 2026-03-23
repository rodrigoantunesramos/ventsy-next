'use client'
import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { ESTADOS, norm } from '@/lib/data'

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

// Linha de resultado reutilizável
function ResultRow({ icon, title, sub, badge, badgeColor, onClick }: {
  icon: React.ReactNode
  title: string
  sub: string
  badge: string
  badgeColor: string
  onClick: () => void
}) {
  return (
    <div
      className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 cursor-pointer"
      onClick={onClick}
    >
      <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-sm flex-shrink-0 overflow-hidden">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-gray-800 truncate">{title}</div>
        <div className="text-xs text-gray-400">{sub}</div>
      </div>
      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${badgeColor}`}>
        {badge}
      </span>
    </div>
  )
}

function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-4 pt-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-gray-400">
      {children}
    </div>
  )
}

export default function OndeSearch({ onSelect }: Props) {
  const [value, setValue]   = useState('')
  const [results, setResults] = useState<React.ReactNode>(null)
  const [open, setOpen]     = useState(false)
  const ref        = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [])

  const select = (item: OndeSelection) => {
    setValue(item.label)
    onSelect(item)
    setOpen(false)
  }

  const clear = () => {
    setValue('')
    onSelect(null)
    setOpen(false)
  }

  const renderDefault = () => {
    const populares = ESTADOS.filter(e => POPULARES.includes(e.s))
    return (
      <>
        <GroupLabel>🔥 Destinos populares</GroupLabel>
        {populares.map(e => (
          <ResultRow
            key={e.s}
            icon="📍"
            title={e.n}
            sub={`${e.s} · Brasil`}
            badge="Estado"
            badgeColor="bg-gray-100 text-gray-500"
            onClick={() => select({ tipo: 'estado', estado: e.s, label: `${e.n}, BR` })}
          />
        ))}
      </>
    )
  }

  const buscar = async (q: string) => {
    setResults(
      <div className="flex items-center gap-2 px-4 py-3 text-gray-400 text-sm">
        <div className="w-4 h-4 border-2 border-gray-200 border-t-[#ff385c] rounded-full animate-spin" />
        Buscando...
      </div>
    )

    const nq = norm(q)

    const [buscaRes, { data: locationProps }] = await Promise.all([
      fetch(`/api/busca?q=${encodeURIComponent(q)}`).then(r => r.json()).catch(() => ({ data: [] })),
      supabase
        .from('propriedades')
        .select('cidade, estado, bairro')
        .eq('publicada', true)
        .or(`cidade.ilike.%${q}%,bairro.ilike.%${q}%`)
        .limit(30),
    ])
    const propsByName: any[] = buscaRes?.data ?? []
    const estadosMatch = ESTADOS.filter(e => norm(e.n).includes(nq) || norm(e.s).includes(nq))

    const allLocations = [...(locationProps || []), ...propsByName]

    const bairroMap = new Map<string, { bairro: string; cidade: string; estado: string }>()
    allLocations.forEach(p => {
      if (p.bairro && norm(p.bairro).includes(nq)) {
        const key = `${p.bairro}-${p.cidade}-${p.estado}`
        if (!bairroMap.has(key))
          bairroMap.set(key, { bairro: p.bairro, cidade: p.cidade || '', estado: p.estado || '' })
      }
    })

    const cidadeMap = new Map<string, { cidade: string; estado: string }>()
    allLocations.forEach(p => {
      if (p.cidade && norm(p.cidade).includes(nq)) {
        const key = `${p.cidade}-${p.estado}`
        if (!cidadeMap.has(key))
          cidadeMap.set(key, { cidade: p.cidade, estado: p.estado || '' })
      }
    })

    const nodes: React.ReactNode[] = []

    if (propsByName.length) {
      nodes.push(<GroupLabel key="prop-label">🏠 Espaços</GroupLabel>)
      propsByName.slice(0, 5).forEach(p => {
        nodes.push(
          <ResultRow
            key={p.id}
            icon={
              (p.imagem_url || p.foto_capa)
                ? <img src={p.imagem_url || p.foto_capa} alt={p.nome} className="w-full h-full object-cover" />
                : '🏠'
            }
            title={p.nome}
            sub={`${p.cidade} · ${p.estado}`}
            badge="Espaço"
            badgeColor="bg-[#fff0f3] text-[#ff385c]"
            onClick={() => select({ tipo: 'prop', id: p.id, estado: p.estado || '', cidade: p.cidade || '', label: p.nome })}
          />
        )
      })
    }

    if (bairroMap.size > 0) {
      nodes.push(<GroupLabel key="bairro-label">🏘️ Bairros</GroupLabel>)
      Array.from(bairroMap.values()).slice(0, 4).forEach(b => {
        nodes.push(
          <ResultRow
            key={`bairro-${b.bairro}-${b.cidade}`}
            icon="🏘️"
            title={b.bairro}
            sub={`${b.cidade} · ${b.estado}`}
            badge="Bairro"
            badgeColor="bg-gray-100 text-gray-500"
            onClick={() => select({ tipo: 'bairro', estado: b.estado, cidade: b.cidade, bairro: b.bairro, label: `${b.bairro}, ${b.cidade}` })}
          />
        )
      })
    }

    if (cidadeMap.size > 0) {
      nodes.push(<GroupLabel key="cidade-label">🏙️ Cidades</GroupLabel>)
      Array.from(cidadeMap.values()).slice(0, 4).forEach(c => {
        nodes.push(
          <ResultRow
            key={`cidade-${c.cidade}-${c.estado}`}
            icon="🏙️"
            title={c.cidade}
            sub={`${c.estado} · Brasil`}
            badge="Cidade"
            badgeColor="bg-gray-100 text-gray-500"
            onClick={() => select({ tipo: 'cidade', estado: c.estado, cidade: c.cidade, label: `${c.cidade}, ${c.estado}` })}
          />
        )
      })
    }

    if (estadosMatch.length) {
      nodes.push(<GroupLabel key="est-label">📍 Estados</GroupLabel>)
      estadosMatch.slice(0, 3).forEach(e => {
        nodes.push(
          <ResultRow
            key={e.s}
            icon="📍"
            title={e.n}
            sub={`${e.s} · Brasil`}
            badge="Estado"
            badgeColor="bg-gray-100 text-gray-500"
            onClick={() => select({ tipo: 'estado', estado: e.s, label: `${e.n}, BR` })}
          />
        )
      })
    }

    if (!nodes.length) {
      setResults(
        <div className="px-4 py-6 text-center text-gray-400 text-sm">
          Nenhum resultado para &ldquo;<strong className="text-gray-600">{q}</strong>&rdquo;
        </div>
      )
    } else {
      setResults(<>{nodes}</>)
    }
  }

  const handleInput = (v: string) => {
    setValue(v)
    onSelect(null)
    clearTimeout(debounceRef.current)
    if (!v.trim()) setResults(renderDefault())
    else debounceRef.current = setTimeout(() => buscar(v.trim()), 280)
  }

  const handleFocus = () => {
    setOpen(true)
    if (!value.trim()) setResults(renderDefault())
  }

  return (
    <div ref={ref} className="relative">
      <label className="text-[.68rem] font-extrabold uppercase tracking-[.05em] text-gray-800 block">
        Onde?
      </label>
      <div className="flex items-center relative">
        <input
          className="text-[.83rem] text-gray-600 bg-transparent border-none outline-none w-[180px] placeholder:text-gray-400"
          placeholder="Cidade, bairro, estado ou espaço..."
          value={value}
          onChange={e => handleInput(e.target.value)}
          onFocus={handleFocus}
          autoComplete="off"
        />
        {value && (
          <button
            className="text-gray-400 hover:text-gray-600 ml-1 text-sm transition-colors bg-transparent border-none cursor-pointer p-0"
            onClick={clear}
          >
            ✕
          </button>
        )}
      </div>

      {open && results && (
        <div className="absolute top-full left-0 mt-3 w-80 bg-white rounded-2xl shadow-2xl border border-gray-100 z-[9999] max-h-80 overflow-y-auto">
          {results}
        </div>
      )}
    </div>
  )
}
