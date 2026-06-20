'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import OndeSearch from './OndeSearch'
import EventoDropdown from './EventoDropdown'
import { useT } from './i18n/I18nProvider'
import { formatDate } from '@/lib/i18n/format'
// CSS do flatpickr self-hosted (bundle), em vez de um <link> de CDN no shell.
import 'flatpickr/dist/flatpickr.min.css'

// Data em ISO local (YYYY-MM-DD) — vai para a URL e é usada pela busca/disponibilidade.
const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export default function SearchBar() {
  const { dict, locale, lhref } = useT()
  const router = useRouter()
  // Exibição curta da data, localizada (ex.: "12 de jun" / "Jun 12").
  const fd = (d: Date) => formatDate(locale, d, { day: 'numeric', month: 'short' })

  const [ondeSelected, setOndeSelected] = useState<any>(null)
  const [dataDisplay, setDataDisplay]   = useState(dict.searchBar.adicionarDatas)
  const [guests, setGuests]             = useState(1)
  const [eventoValue, setEventoValue]   = useState('')
  const [datas, setDatas]               = useState<{ ini?: string; fim?: string }>({})
  const pickerRef = useRef<any>(null)
  const inputRef  = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let fp: any
    const load = async () => {
      const flatpickr = (await import('flatpickr')).default
      let fpLocale: string = 'default' // en é o padrão do flatpickr
      if (locale === 'pt') { await import('flatpickr/dist/l10n/pt.js'); fpLocale = 'pt' }
      else if (locale === 'es') { await import('flatpickr/dist/l10n/es.js'); fpLocale = 'es' }
      if (!inputRef.current) return
      fp = flatpickr(inputRef.current, {
        mode: 'range',
        minDate: 'today',
        dateFormat: 'Y-m-d',
        locale: fpLocale as any,
        showMonths: 2,
        disableMobile: true,
        onChange(ds: Date[]) {
          if (!ds.length)            { setDataDisplay(dict.searchBar.adicionarDatas); setDatas({}) }
          else if (ds.length === 1)  { setDataDisplay(`${fd(ds[0])} → ...`); setDatas({ ini: iso(ds[0]) }) }
          else {
            const a = fd(ds[0]), b = fd(ds[1])
            setDataDisplay(a === b ? a : `${a} → ${b}`)
            setDatas({ ini: iso(ds[0]), fim: iso(ds[1]) })
          }
        },
      })
      pickerRef.current = fp
    }
    load()
    return () => { fp?.destroy() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale])

  // Permite buscar por local, tipo de evento e/ou data — qualquer combinação.
  const canSearch = !!ondeSelected || !!eventoValue || !!datas.ini

  const handleSearch = async () => {
    if (ondeSelected?.tipo === 'prop' && ondeSelected.id) {
      router.push(lhref(`/propriedade/${ondeSelected.id}`))
      return
    }

    const params = new URLSearchParams()
    if (ondeSelected?.estado) params.set('estado', ondeSelected.estado)
    if (ondeSelected?.cidade) params.set('cidade', ondeSelected.cidade)
    if (ondeSelected?.bairro) params.set('bairro', ondeSelected.bairro)
    if (eventoValue)         params.set('evento', eventoValue)
    if (datas.ini)           params.set('data_inicio', datas.ini)
    if (datas.fim)           params.set('data_fim', datas.fim)
    if (guests > 1)          params.set('convidados', String(guests))

    if (eventoValue) {
      eventoValue.split(',').forEach(async t => {
        try { await supabase.from('buscas').insert({ tipo_evento: t.trim() }) } catch (_) {}
      })
    }

    router.push(`${lhref('/busca')}?${params.toString()}`)
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
        <button
          type="button"
          aria-haspopup="dialog"
          aria-label={`${dict.searchBar.quando}: ${dataDisplay}`}
          className="flex flex-col items-start px-3 py-1 cursor-pointer hover:bg-gray-50 rounded-full transition-colors min-w-[128px] flex-shrink-0 bg-transparent border-none text-left font-[inherit]"
          onClick={() => pickerRef.current?.open()}
        >
          <span className="text-[.68rem] font-extrabold uppercase tracking-[.05em] text-gray-800 pointer-events-none">
            {dict.searchBar.quando}
          </span>
          <span className="text-[.83rem] text-gray-500 truncate">{dataDisplay}</span>
          <input ref={inputRef} className="hidden" readOnly tabIndex={-1} aria-hidden="true" />
        </button>

        <div className="w-px h-7 bg-gray-200 mx-1 flex-shrink-0" />

        {/* TIPO DE EVENTO */}
        <div className="relative flex flex-col px-3 py-1 min-w-[140px] flex-shrink-0">
          <label className="text-[.68rem] font-extrabold uppercase tracking-[.05em] text-gray-800 pointer-events-none">
            {dict.searchBar.tipoEvento}
          </label>
          <EventoDropdown onChange={setEventoValue} />
        </div>

        <div className="w-px h-7 bg-gray-200 mx-1 flex-shrink-0" />

        {/* CONVIDADOS */}
        <div className="flex flex-col px-3 py-1 min-w-[110px] flex-shrink-0">
          <label className="text-[.68rem] font-extrabold uppercase tracking-[.05em] text-gray-800">
            {dict.searchBar.convidados}
          </label>
          <div className="flex items-center gap-2 mt-0.5">
            <button
              type="button"
              aria-label={dict.searchBar.diminuirConvidados}
              className="w-5 h-5 rounded-full border border-gray-300 flex items-center justify-center text-gray-600 hover:border-gray-500 text-sm leading-none bg-white cursor-pointer"
              onClick={() => setGuests(g => Math.max(1, g - 1))}
            >
              −
            </button>
            <span className="text-sm font-semibold w-5 text-center" aria-live="polite">{guests}</span>
            <button
              type="button"
              aria-label={dict.searchBar.aumentarConvidados}
              className="w-5 h-5 rounded-full border border-gray-300 flex items-center justify-center text-gray-600 hover:border-gray-500 text-sm leading-none bg-white cursor-pointer"
              onClick={() => setGuests(g => g + 1)}
            >
              +
            </button>
          </div>
        </div>

        {/* BOTÃO BUSCAR */}
        <button
          type="button"
          aria-label={dict.searchBar.buscarEspacos}
          className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-base flex-shrink-0 ml-1 transition-all border-none
            ${canSearch ? 'bg-[#ff385c] hover:bg-[#e0304f] hover:scale-[1.07] cursor-pointer' : 'bg-[#ff385c] opacity-30 cursor-not-allowed'}`}
          disabled={!canSearch}
          onClick={handleSearch}
        >
          <span aria-hidden="true">🔍</span>
        </button>
      </div>
    </div>
  )
}
