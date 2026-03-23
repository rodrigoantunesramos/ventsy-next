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

export default function OndeSearch({ onSelect }: Props) {
  const [value, setValue] = useState('')
  const [results, setResults] = useState<React.ReactNode>(null)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
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
        <div className="onde-group-label">🔥 Destinos populares</div>
        {populares.map(e => (
          <div key={e.s} className="onde-result" onClick={() => select({ tipo: 'estado', estado: e.s, label: `${e.n}, BR` })}>
            <div className="onde-result-icon">📍</div>
            <div className="onde-result-info">
              <div className="onde-result-titulo">{e.n}</div>
              <div className="onde-result-sub">{e.s} · Brasil</div>
            </div>
            <span className="onde-result-badge badge-estado">Estado</span>
          </div>
        ))}
      </>
    )
  }

  const buscar = async (q: string) => {
    setResults(<div className="onde-loading"><div className="onde-spinner" /> Buscando...</div>)

    const nq = norm(q)

    // Buscar por nome e por localização (apenas propriedades publicadas)
    const [{ data: propsByName }, { data: locationProps }] = await Promise.all([
      supabase
        .from('propriedades')
        .select('id, nome, cidade, estado, bairro, imagem_url, foto_capa')
        .eq('publicada', true)
        .ilike('nome', `%${q}%`)
        .limit(5),
      supabase
        .from('propriedades')
        .select('cidade, estado, bairro')
        .eq('publicada', true)
        .or(`cidade.ilike.%${q}%,bairro.ilike.%${q}%`)
        .limit(30),
    ])

    // Filtrar estados localmente
    const estadosMatch = ESTADOS.filter(e => norm(e.n).includes(nq) || norm(e.s).includes(nq))

    // Propriedades que batem pelo nome
    const propsByNome = propsByName || []

    // Bairros únicos que batem (de todas as propriedades)
    const allLocations = [...(locationProps || []), ...propsByNome]
    const bairroMap = new Map<string, { bairro: string; cidade: string; estado: string }>()
    allLocations.forEach(p => {
      if (p.bairro && norm(p.bairro).includes(nq)) {
        const key = `${p.bairro}-${p.cidade}-${p.estado}`
        if (!bairroMap.has(key)) bairroMap.set(key, { bairro: p.bairro, cidade: p.cidade || '', estado: p.estado || '' })
      }
    })

    // Cidades únicas que batem (de todas as propriedades)
    const cidadeMap = new Map<string, { cidade: string; estado: string }>()
    allLocations.forEach(p => {
      if (p.cidade && norm(p.cidade).includes(nq)) {
        const key = `${p.cidade}-${p.estado}`
        if (!cidadeMap.has(key)) cidadeMap.set(key, { cidade: p.cidade, estado: p.estado || '' })
      }
    })

    const nodes: React.ReactNode[] = []

    // Grupo: Espaços (matched por nome)
    if (propsByNome.length) {
      nodes.push(<div key="prop-label" className="onde-group-label">🏠 Espaços</div>)
      propsByNome.slice(0, 5).forEach(p => {
        nodes.push(
          <div key={p.id} className="onde-result" onClick={() => select({ tipo: 'prop', id: p.id, estado: p.estado || '', cidade: p.cidade || '', label: p.nome })}>
            <div className="onde-result-icon">
              {(p.imagem_url || p.foto_capa)
                ? <img src={p.imagem_url || p.foto_capa} alt={p.nome} />
                : '🏠'}
            </div>
            <div className="onde-result-info">
              <div className="onde-result-titulo">{p.nome}</div>
              <div className="onde-result-sub">{p.cidade} · {p.estado}</div>
            </div>
            <span className="onde-result-badge badge-prop">Espaço</span>
          </div>
        )
      })
    }

    // Grupo: Bairros
    if (bairroMap.size > 0) {
      nodes.push(<div key="bairro-label" className="onde-group-label">🏘️ Bairros</div>)
      Array.from(bairroMap.values()).slice(0, 4).forEach(b => {
        nodes.push(
          <div key={`bairro-${b.bairro}-${b.cidade}`} className="onde-result" onClick={() => select({ tipo: 'bairro', estado: b.estado, cidade: b.cidade, bairro: b.bairro, label: `${b.bairro}, ${b.cidade}` })}>
            <div className="onde-result-icon">🏘️</div>
            <div className="onde-result-info">
              <div className="onde-result-titulo">{b.bairro}</div>
              <div className="onde-result-sub">{b.cidade} · {b.estado}</div>
            </div>
            <span className="onde-result-badge badge-bairro">Bairro</span>
          </div>
        )
      })
    }

    // Grupo: Cidades
    if (cidadeMap.size > 0) {
      nodes.push(<div key="cidade-label" className="onde-group-label">🏙️ Cidades</div>)
      Array.from(cidadeMap.values()).slice(0, 4).forEach(c => {
        nodes.push(
          <div key={`cidade-${c.cidade}-${c.estado}`} className="onde-result" onClick={() => select({ tipo: 'cidade', estado: c.estado, cidade: c.cidade, label: `${c.cidade}, ${c.estado}` })}>
            <div className="onde-result-icon">🏙️</div>
            <div className="onde-result-info">
              <div className="onde-result-titulo">{c.cidade}</div>
              <div className="onde-result-sub">{c.estado} · Brasil</div>
            </div>
            <span className="onde-result-badge badge-cidade">Cidade</span>
          </div>
        )
      })
    }

    // Grupo: Estados
    if (estadosMatch.length) {
      nodes.push(<div key="est-label" className="onde-group-label">📍 Estados</div>)
      estadosMatch.slice(0, 3).forEach(e => {
        nodes.push(
          <div key={e.s} className="onde-result" onClick={() => select({ tipo: 'estado', estado: e.s, label: `${e.n}, BR` })}>
            <div className="onde-result-icon">📍</div>
            <div className="onde-result-info">
              <div className="onde-result-titulo">{e.n}</div>
              <div className="onde-result-sub">{e.s} · Brasil</div>
            </div>
            <span className="onde-result-badge badge-estado">Estado</span>
          </div>
        )
      })
    }

    if (!nodes.length) {
      setResults(<div className="onde-empty">Nenhum resultado para &ldquo;<strong>{q}</strong>&rdquo;</div>)
    } else {
      setResults(<>{nodes}</>)
    }
  }

  const handleInput = (v: string) => {
    setValue(v)
    onSelect(null)
    clearTimeout(debounceRef.current)
    if (!v.trim()) {
      setResults(renderDefault())
    } else {
      debounceRef.current = setTimeout(() => buscar(v.trim()), 280)
    }
  }

  const handleFocus = () => {
    setOpen(true)
    if (!value.trim()) setResults(renderDefault())
  }

  return (
    <div ref={ref} style={{ position: 'relative' }} id="onde-container" className="onde-wrap">
      <label style={{ fontSize: '.68rem', fontWeight: 800, textTransform: 'uppercase', color: '#222', letterSpacing: '.05em' }}>
        Onde?
      </label>
      <div style={{ display: 'flex', alignItems: 'center', position: 'relative' }}>
        <input
          className="onde-input"
          placeholder="Buscar cidade, bairro, estado ou espaço..."
          value={value}
          onChange={e => handleInput(e.target.value)}
          onFocus={handleFocus}
          autoComplete="off"
        />
        {value && (
          <button className="onde-clear visible" onClick={clear}>✕</button>
        )}
      </div>
      {open && results && (
        <div className="onde-dropdown">{results}</div>
      )}
    </div>
  )
}
