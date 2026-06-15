import type { Metadata } from 'next'
import { getDictionary } from '@/lib/i18n/getDictionary'
import { isLocale, defaultLocale, localizar, type Locale } from '@/lib/i18n/config'

export function generateMetadata({ params }: { params: { locale: string } }): Metadata {
  const locale: Locale = isLocale(params.locale) ? params.locale : defaultLocale
  const dict = getDictionary(locale)
  return {
    title: dict.auth.meta.loginTitulo,
    description: dict.auth.meta.loginDescricao,
    alternates: { canonical: localizar(locale, '/login') },
    // Página de login não agrega valor de busca e não deve ser indexada.
    robots: { index: false, follow: true },
  }
}

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children
}
