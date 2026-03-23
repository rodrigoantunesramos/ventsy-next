'use client'

import { useState, useRef, useEffect } from 'react'

interface Props {
  url?: string
  title?: string
}

export default function ShareButton({ url, title = 'Confira este espaço' }: Props) {
  const [open, setOpen]     = useState(false)
  const [copied, setCopied] = useState(false)
  const ref                 = useRef<HTMLDivElement>(null)

  const href = url || (typeof window !== 'undefined' ? window.location.href : '')

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const copy = async () => {
    await navigator.clipboard.writeText(href)
    setCopied(true)
    setTimeout(() => { setCopied(false); setOpen(false) }, 2000)
  }

  return (
    <div className="cl-share-wrap" ref={ref}>
      <button className="cl-share-btn" onClick={() => setOpen(!open)}>
        <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"/>
          <polyline points="16 6 12 2 8 6"/>
          <line x1="12" y1="2" x2="12" y2="15"/>
        </svg>
        Compartilhar
      </button>

      {open && (
        <div className="cl-share-drop">
          <button onClick={copy}>
            {copied ? '✅ Link copiado!' : '🔗 Copiar link'}
          </button>
          <a
            href={`https://wa.me/?text=${encodeURIComponent(title + ' — ' + href)}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpen(false)}
          >
            💬 WhatsApp
          </a>
          <a
            href={`mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent('Confira: ' + href)}`}
            onClick={() => setOpen(false)}
          >
            📧 E-mail
          </a>
        </div>
      )}
    </div>
  )
}
