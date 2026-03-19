'use client'
import { useEffect, useRef, useState } from 'react'
import { EVENTOS_CATS } from '@/lib/data'

interface Props {
  onChange: (value: string) => void
}

export default function EventoDropdown({ onChange }: Props) {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
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
  let displayText = 'Todos os eventos'
  if (count === 1) {
    const v = [...selected][0]
    const flat = EVENTOS_CATS.flatMap(c => c.items)
    const item = flat.find(i => i.v === v)
    displayText = item ? `${item.emoji} ${item.v}` : v
  } else if (count > 1) {
    displayText = 'Eventos'
  }

  return (
    <div ref={ref} style={{ position: 'relative' }} id="tipo-container">
      <div className={`tipo-display${open ? ' open' : ''}`} onClick={() => setOpen(!open)}>
        <span>{displayText}</span>
        {count > 1 && <span className="tipo-badge">{count}</span>}
        <svg className="tipo-caret" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path d="M6 9l6 6 6-6" />
        </svg>
      </div>

      {open && (
        <div className="evento-dropdown">
          <div className="evento-grid-wrap">
            <button className="ev-clear" onClick={clear}>✕ Limpar seleção</button>
            {EVENTOS_CATS.map(cat => (
              <div key={cat.label}>
                <div className="ev-cat-label">{cat.label}</div>
                <div className="ev-grid">
                  {cat.items.map(item => (
                    <div
                      key={item.v}
                      className={`ev-item${selected.has(item.v) ? ' selected' : ''}`}
                      onClick={() => toggle(item.v)}
                    >
                      <span>{item.emoji}</span>
                      {item.label}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
