import type { Metadata } from 'next'
import { getDictionary } from '@/lib/i18n/getDictionary'
import { isLocale, defaultLocale, localizar, type Locale } from '@/lib/i18n/config'
import { buildAlternates } from '@/lib/i18n/seo'

export function generateMetadata({ params }: { params: { locale: string } }): Metadata {
  const locale: Locale = isLocale(params.locale) ? params.locale : defaultLocale
  const dict = getDictionary(locale)
  return {
    title: dict.cadastro.meta.title,
    description: dict.cadastro.meta.description,
    alternates: buildAlternates(locale, '/cadastro'),
    openGraph: {
      title: dict.cadastro.meta.ogTitle,
      description: dict.cadastro.meta.ogDescription,
      url: localizar(locale, '/cadastro'),
    },
  }
}

export default function CadastroLayout({ children }: { children: React.ReactNode }) {
  return children
}
