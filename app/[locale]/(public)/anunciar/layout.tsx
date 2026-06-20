import type { Metadata } from 'next'
import { getDictionary } from '@/lib/i18n/getDictionary'
import { isLocale, defaultLocale, localizar, type Locale } from '@/lib/i18n/config'
import { buildAlternates } from '@/lib/i18n/seo'

export function generateMetadata({ params }: { params: { locale: string } }): Metadata {
  const locale: Locale = isLocale(params.locale) ? params.locale : defaultLocale
  const dict = getDictionary(locale)
  return {
    title: dict.anunciar.meta.title,
    description: dict.anunciar.meta.description,
    alternates: buildAlternates(locale, '/anunciar'),
    openGraph: {
      title: dict.anunciar.meta.ogTitle,
      description: dict.anunciar.meta.ogDescription,
      url: localizar(locale, '/anunciar'),
    },
  }
}

export default function AnunciarLayout({ children }: { children: React.ReactNode }) {
  return children
}
