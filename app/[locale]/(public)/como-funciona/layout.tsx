import type { Metadata } from 'next'
import { getDictionary } from '@/lib/i18n/getDictionary'
import { isLocale, defaultLocale, localizar, type Locale } from '@/lib/i18n/config'

export function generateMetadata({ params }: { params: { locale: string } }): Metadata {
  const locale: Locale = isLocale(params.locale) ? params.locale : defaultLocale
  const dict = getDictionary(locale)
  const url = localizar(locale, '/como-funciona')
  return {
    title: dict.comoFunciona.meta.title,
    description: dict.comoFunciona.meta.description,
    alternates: { canonical: url },
    openGraph: {
      title: dict.comoFunciona.meta.ogTitle,
      description: dict.comoFunciona.meta.ogDescription,
      url,
    },
  }
}

export default function ComoFuncionaLayout({ children }: { children: React.ReactNode }) {
  return children
}
