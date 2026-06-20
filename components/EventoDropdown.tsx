'use client'
import { useEffect, useRef, useState } from 'react'
import { EVENTOS_CATS } from '@/lib/data'
import { useT } from './i18n/I18nProvider'
import { rotuloDado } from '@/lib/i18n/dados'

interface Props {
  onChange: (value: string) => void
}

export default function EventoDropdown({ onChange }: Props) {
  const { dict } = useT()
  const [open, setOpen]         = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('click', onClick)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('click', onClick); document.removeEventListener('keydown', onKey) }
  }, [])

  const toggle = (v: string) => {
    const next = new Set(selected)
    next.has(v) ? next.delete(v) : next.add(v)
    setSelected(next)
    onChange([...next].join(','))
  }

  const clear = () => {
    setSelected(new Set())
    onChange('')
  }

  const count = selected.size
  let displayText = dict.componentes.evento.todos
  if (count === 1) {
    const v = [...selected][0]
    const flat = EVENTOS_CATS.flatMap(c => c.items)
    const item = flat.find(i => i.v === v)
    displayText = item ? `${item.emoji} ${rotuloDado(dict.dados.eventos, item.v)}` : v
  } else if (count > 1) {
    displayText = dict.componentes.evento.varios
  }

  return (
    <div ref={ref} className="relative">
      {/* Trigger */}
      <button
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        className="flex items-center gap-1.5 cursor-pointer bg-transparent border-none p-0 font-[inherit] text-left"
        onClick={() => setOpen(!open)}
      >
        <span className="text-[.83rem] text-gray-500 truncate max-w-[110px]">{displayText}</span>
        {count > 1 && (
          <span className="bg-[#ff385c] text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0">
            {count}
          </span>
        )}
        <svg
          aria-hidden="true"
          className={`w-3 h-3 text-gray-400 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute top-full left-0 mt-3 w-[380px] bg-white rounded-2xl shadow-2xl border border-gray-100 z-[9999] overflow-hidden">
          <div className="max-h-72 overflow-y-auto p-3">
            <button
              className="w-full text-left text-xs text-gray-400 hover:text-gray-600 mb-3 transition-colors bg-transparent border-none cursor-pointer font-[inherit]"
              onClick={clear}
            >
              ✕ {dict.componentes.evento.limpar}
            </button>

            {EVENTOS_CATS.map(cat => {
              // cat.label = "emoji Grupo" (ex.: "🏢 Corporativo"); separa emoji do nome
              // e traduz só o nome (chave canônica em dict.dados.gruposEvento).
              const sep = cat.label.indexOf(' ')
              const grupoEmoji = sep > 0 ? cat.label.slice(0, sep) : ''
              const grupoNome = sep > 0 ? cat.label.slice(sep + 1) : cat.label
              return (
              <div key={cat.label} className="mb-3">
                <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2 px-1">
                  {grupoEmoji} {rotuloDado(dict.dados.gruposEvento, grupoNome)}
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {cat.items.map(item => (
                    <button
                      key={item.v}
                      type="button"
                      aria-pressed={selected.has(item.v)}
                      className={`flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg cursor-pointer transition-all border-none font-[inherit] text-left w-full
                        ${selected.has(item.v)
                          ? 'bg-[#fff0f3] text-[#ff385c] font-semibold'
                          : 'hover:bg-gray-50 text-gray-600 bg-transparent'}`}
                      onClick={() => toggle(item.v)}
                    >
                      <span aria-hidden="true">{item.emoji}</span>
                      {rotuloDado(dict.dados.eventos, item.v)}
                    </button>
                  ))}
                </div>
              </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
