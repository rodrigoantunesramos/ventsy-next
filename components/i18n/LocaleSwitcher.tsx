'use client'
// Troca de idioma preservando o caminho atual: remove o prefixo de locale,
// aplica o novo, grava o cookie NEXT_LOCALE e navega.
import { useEffect, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { locales, localeLabels, localeFlags, localizar, semLocale, type Locale } from '@/lib/i18n/config'
import { useT } from './I18nProvider'

export default function LocaleSwitcher() {
  const { locale, dict } = useT()
  const pathname = usePathname()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [])

  const trocar = (novo: Locale) => {
    setOpen(false)
    if (novo === locale) return
    document.cookie = `NEXT_LOCALE=${novo};path=/;max-age=${60 * 60 * 24 * 365}`
    router.push(localizar(novo, semLocale(pathname || '/')))
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={dict.header.idioma}
        className="bg-white border border-gray-200 rounded-full px-3 py-2 cursor-pointer text-sm flex items-center gap-1.5 hover:shadow-md transition-shadow font-[inherit]"
        onClick={() => setOpen((v) => !v)}
      >
        <span aria-hidden="true">{localeFlags[locale]}</span>
        <span className="font-semibold uppercase">{locale}</span>
      </button>

      {open && (
        <div className="absolute top-12 right-0 w-44 bg-white rounded-2xl shadow-2xl border border-gray-100 flex flex-col py-2 z-[2000]">
          {locales.map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => trocar(l)}
              className={`px-4 py-2.5 text-sm flex items-center gap-2.5 text-left hover:bg-gray-50 transition-colors ${
                l === locale ? 'font-semibold text-brand' : 'text-gray-600'
              }`}
            >
              <span aria-hidden="true">{localeFlags[l]}</span>
              {localeLabels[l]}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
