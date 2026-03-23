'use client'
import { useEffect, useRef, useState } from 'react'
import OndeSearch from './OndeSearch'
import EventoDropdown from './EventoDropdown'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const MM = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez']
const fd = (d: Date) => `${d.getDate()} ${MM[d.getMonth()]}`

export default function SearchBar() {
  const router = useRouter()
  const [ondeSelected, setOndeSelected] = useState<any>(null)
  const [dataDisplay, setDataDisplay] = useState('Adicionar datas')
  const [guests, setGuests] = useState(1)
  const [eventoValue, setEventoValue] = useState('')
  const pickerRef = useRef<any>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let fp: any
    const load = async () => {
      const flatpickr = (await import('flatpickr')).default
      await import('flatpickr/dist/l10n/pt.js')
      if (!inputRef.current) return
      fp = flatpickr(inputRef.current, {
        mode: 'range',
        minDate: 'today',
        dateFormat: 'Y-m-d',
        locale: 'pt' as any,
        showMonths: 2,
        disableMobile: true,
        onChange(ds: Date[]) {
          if (!ds.length) { setDataDisplay('Adicionar datas') }
          else if (ds.length === 1) { setDataDisplay(`${fd(ds[0])} → ...`) }
          else {
            const a = fd(ds[0]), b = fd(ds[1])
            setDataDisplay(a === b ? a : `${a} → ${b}`)
          }
        }
      })
      pickerRef.current = fp
    }
    load()
    return () => { fp?.destroy() }
  }, [])

  const canSearch = !!ondeSelected

  const handleSearch = async () => {
    if (!ondeSelected) return

    // Se selecionou um espaço específico (por nome), vai direto para a página da propriedade
    if (ondeSelected.tipo === 'prop' && ondeSelected.id) {
      router.push(`/propriedade/${ondeSelected.id}`)
      return
    }

    const params = new URLSearchParams()
    if (ondeSelected.estado) params.set('estado', ondeSelected.estado)
    if (ondeSelected.cidade) params.set('cidade', ondeSelected.cidade)
    if (ondeSelected.bairro) params.set('bairro', ondeSelected.bairro)
    if (eventoValue) params.set('evento', eventoValue)
    if (dataDisplay && dataDisplay !== 'Adicionar datas') params.set('data', dataDisplay)

    // Registrar buscas
    if (eventoValue) {
      eventoValue.split(',').forEach(async (t) => {
        try { await supabase.from('buscas').insert({ tipo_evento: t.trim() }) } catch (_) {}
      })
    }

    router.push(`/busca?${params.toString()}`)
  }

  return (
    <div className="search-container">
      <div className="search-bar">
        {/* ONDE */}
        <OndeSearch onSelect={setOndeSelected} />

        <div className="divider" />

        {/* QUANDO */}
        <div className="search-item" onClick={() => pickerRef.current?.open()}>
          <label>Quando?</label>
          <span className="range-display">{dataDisplay}</span>
          <input ref={inputRef} id="input-periodo" style={{ display: 'none' }} readOnly />
        </div>

        <div className="divider" />

        {/* TIPO DE EVENTO */}
        <div className="search-item" id="tipo-container" style={{ position: 'relative' }}>
          <label>Tipo de Evento</label>
          <EventoDropdown onChange={setEventoValue} />
        </div>

        <div className="divider" />

        {/* CONVIDADOS */}
        <div className="search-item guest-direct-selector">
          <label>Convidados</label>
          <div className="stepper-control">
            <button className="btn-step" onClick={() => setGuests(g => Math.max(1, g - 1))}>−</button>
            <span className="qtd-display">{guests}</span>
            <button className="btn-step" onClick={() => setGuests(g => g + 1)}>+</button>
          </div>
        </div>

        <button
          className="btn-search"
          disabled={!canSearch}
          onClick={handleSearch}
          style={!canSearch ? { opacity: .3, pointerEvents: 'none' } : {}}
        >
          🔍
        </button>
      </div>
    </div>
  )
}
