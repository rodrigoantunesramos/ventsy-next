import type { Metadata } from 'next'
import { getDictionary } from '@/lib/i18n/getDictionary'
import { isLocale, defaultLocale, localizar, type Locale } from '@/lib/i18n/config'

export function generateMetadata({ params }: { params: { locale: string } }): Metadata {
  const locale: Locale = isLocale(params.locale) ? params.locale : defaultLocale
  const dict = getDictionary(locale)
  const m = dict.faleConosco.meta
  return {
    title: m.title,
    description: m.description,
    alternates: { canonical: localizar(locale, '/fale-conosco') },
    openGraph: {
      title: m.ogTitle,
      description: m.ogDescription,
      url: localizar(locale, '/fale-conosco'),
    },
  }
}

export default function FaleConoscoLayout({ children }: { children: React.ReactNode }) {
  return children
}
