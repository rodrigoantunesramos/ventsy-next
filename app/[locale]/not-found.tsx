'use client'
import Link from 'next/link'
import { useT } from '@/components/i18n/I18nProvider'

// 404 dentro de um locale válido (ex.: /pt/inexistente). Renderiza DENTRO do
// [locale]/layout (que provê o I18nProvider), então pode usar useT().
export default function LocaleNotFound() {
  const { dict, lhref } = useT()
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="font-display text-6xl font-black text-brand">404</h1>
      <p className="text-lg text-ink-soft">{dict.common.paginaNaoEncontrada}</p>
      <Link href={lhref('/')} className="font-semibold text-brand underline">
        {dict.common.voltarInicio}
      </Link>
    </main>
  )
}
