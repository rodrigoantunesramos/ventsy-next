'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import OndeSearch from './OndeSearch'
import EventoDropdown from './EventoDropdown'

const MM = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez']
const fd = (d: Date) => `${d.getDate()} ${MM[d.getMonth()]}`

export default function SearchBar() {
  const router = useRouter()
  const [ondeSelected, setOndeSelected] = useState<any>(null)
  const [dataDisplay, setDataDisplay]   = useState('Adicionar datas')
  const [guests, setGuests]             = useState(1)
  const [eventoValue, setEventoValue]   = useState('')
  const pickerRef = useRef<any>(null)
  const inputRef  = useRef<HTMLInputElement>(null)

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
          if (!ds.length)       setDataDisplay('Adicionar datas')
          else if (ds.length === 1) setDataDisplay(`${fd(ds[0])} → ...`)
          else {
            const a = fd(ds[0]), b = fd(ds[1])
            setDataDisplay(a === b ? a : `${a} → ${b}`)
          }
        },
      })
      pickerRef.current = fp
    }
    load()
    return () => { fp?.destroy() }
  }, [])

  const canSearch = !!ondeSelected

  const handleSearch = async () => {
    if (!ondeSelected) return

    if (ondeSelected.tipo === 'prop' && ondeSelected.id) {
      router.push(`/propriedade/${ondeSelected.id}`)
      return
    }

    const params = new URLSearchParams()
    if (ondeSelected.estado) params.set('estado', ondeSelected.estado)
    if (ondeSelected.cidade) params.set('cidade', ondeSelected.cidade)
    if (ondeSelected.bairro) params.set('bairro', ondeSelected.bairro)
    if (eventoValue)         params.set('evento', eventoValue)
    if (dataDisplay && dataDisplay !== 'Adicionar datas') params.set('data', dataDisplay)

    if (eventoValue) {
      eventoValue.split(',').forEach(async t => {
        try { await supabase.from('buscas').insert({ tipo_evento: t.trim() }) } catch (_) {}
      })
    }

    router.push(`/busca?${params.toString()}`)
  }

  return (
    <div className="w-full flex justify-center">
      <div className="bg-white flex items-center pl-5 pr-2 py-1.5 rounded-full border border-gray-200 shadow-md overflow-visible max-w-[960px] w-full">

        {/* ONDE */}
        <div className="flex-1 min-w-0">
          <OndeSearch onSelect={setOndeSelected} />
        </div>

        <div className="w-px h-7 bg-gray-200 mx-1 flex-shrink-0" />

        {/* QUANDO */}
        <div
          className="flex flex-col px-3 py-1 cursor-pointer hover:bg-gray-50 rounded-full transition-colors min-w-[128px] flex-shrink-0"
          onClick={() => pickerRef.current?.open()}
        >
          <label className="text-[.68rem] font-extrabold uppercase tracking-[.05em] text-gray-800 cursor-pointer pointer-events-none">
            Quando?
          </label>
          <span className="text-[.83rem] text-gray-500 truncate">{dataDisplay}</span>
          <input ref={inputRef} className="hidden" readOnly />
        </div>

        <div className="w-px h-7 bg-gray-200 mx-1 flex-shrink-0" />

        {/* TIPO DE EVENTO */}
        <div className="relative flex flex-col px-3 py-1 min-w-[140px] flex-shrink-0">
          <label className="text-[.68rem] font-extrabold uppercase tracking-[.05em] text-gray-800 pointer-events-none">
            Tipo de Evento
          </label>
          <EventoDropdown onChange={setEventoValue} />
        </div>

        <div className="w-px h-7 bg-gray-200 mx-1 flex-shrink-0" />

        {/* CONVIDADOS */}
        <div className="flex flex-col px-3 py-1 min-w-[110px] flex-shrink-0">
          <label className="text-[.68rem] font-extrabold uppercase tracking-[.05em] text-gray-800">
            Convidados
          </label>
          <div className="flex items-center gap-2 mt-0.5">
            <button
              className="w-5 h-5 rounded-full border border-gray-300 flex items-center justify-center text-gray-600 hover:border-gray-500 text-sm leading-none bg-white cursor-pointer"
              onClick={() => setGuests(g => Math.max(1, g - 1))}
            >
              −
            </button>
            <span className="text-sm font-semibold w-5 text-center">{guests}</span>
            <button
              className="w-5 h-5 rounded-full border border-gray-300 flex items-center justify-center text-gray-600 hover:border-gray-500 text-sm leading-none bg-white cursor-pointer"
              onClick={() => setGuests(g => g + 1)}
            >
              +
            </button>
          </div>
        </div>

        {/* BOTÃO BUSCAR */}
        <button
          className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-base flex-shrink-0 ml-1 transition-all border-none
            ${canSearch ? 'bg-[#ff385c] hover:bg-[#e0304f] hover:scale-[1.07] cursor-pointer' : 'bg-[#ff385c] opacity-30 cursor-not-allowed'}`}
          disabled={!canSearch}
          onClick={handleSearch}
        >
          🔍
        </button>
      </div>
    </div>
  )
}
