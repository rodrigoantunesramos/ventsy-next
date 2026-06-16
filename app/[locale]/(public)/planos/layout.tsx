import type { Metadata } from 'next'
import { getDictionary } from '@/lib/i18n/getDictionary'
import { isLocale, defaultLocale, localizar, type Locale } from '@/lib/i18n/config'
import { buildAlternates } from '@/lib/i18n/seo'

export function generateMetadata({ params }: { params: { locale: string } }): Metadata {
  const locale: Locale = isLocale(params.locale) ? params.locale : defaultLocale
  const dict = getDictionary(locale)
  const url = localizar(locale, '/planos')
  return {
    title: dict.planos.meta.title,
    description: dict.planos.meta.description,
    alternates: buildAlternates(locale, '/planos'),
    openGraph: {
      title: dict.planos.meta.ogTitle,
      description: dict.planos.meta.ogDescription,
      url,
    },
  }
}

export default function PlanosLayout({ children }: { children: React.ReactNode }) {
  return children
}
