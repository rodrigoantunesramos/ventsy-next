import type { Metadata } from 'next'
import RootHtml from '@/components/RootHtml'
import { I18nProvider } from '@/components/i18n/I18nProvider'
import { getDictionary } from '@/lib/i18n/getDictionary'
import { locales, isLocale, defaultLocale, htmlLang, ogLocale, localizar, type Locale } from '@/lib/i18n/config'
import { buildAlternates } from '@/lib/i18n/seo'
import { SITE_URL, SITE_NAME, SITE_DESCRIPTION } from '@/lib/site'

// Root layout das rotas LOCALIZADAS (/pt /en /es). Define <html lang> por idioma,
// provê o dicionário aos Client Components e o JSON-LD base. As áreas internas
// (painel/admin/client/externo) têm seus próprios root layouts (lang pt-BR).
export function generateStaticParams() {
  return locales.map((locale) => ({ locale }))
}

export function generateMetadata({ params }: { params: { locale: string } }): Metadata {
  const locale: Locale = isLocale(params.locale) ? params.locale : 'pt'
  const title = 'VENTSY — Encontre o espaço perfeito para seu evento'
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: title, template: '%s · VENTSY' },
    description: SITE_DESCRIPTION,
    applicationName: SITE_NAME,
    alternates: buildAlternates(locale, '/'),
    openGraph: {
      type: 'website',
      locale: ogLocale[locale],
      siteName: SITE_NAME,
      url: `${SITE_URL}${localizar(locale, '/')}`,
      title,
      description: SITE_DESCRIPTION,
    },
    twitter: { card: 'summary_large_image', title, description: SITE_DESCRIPTION },
    robots: {
      index: true,
      follow: true,
      googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 },
    },
  }
}

export default function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: { locale: string }
}) {
  // O middleware garante um locale válido em runtime; fallback defensivo no SSG.
  const locale: Locale = isLocale(params.locale) ? params.locale : defaultLocale
  const dict = getDictionary(locale)

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${SITE_URL}/#organization`,
        name: SITE_NAME,
        url: SITE_URL,
        description: SITE_DESCRIPTION,
      },
      {
        '@type': 'WebSite',
        '@id': `${SITE_URL}/#website`,
        url: SITE_URL,
        name: SITE_NAME,
        description: SITE_DESCRIPTION,
        inLanguage: htmlLang[locale],
        publisher: { '@id': `${SITE_URL}/#organization` },
        potentialAction: {
          '@type': 'SearchAction',
          target: {
            '@type': 'EntryPoint',
            urlTemplate: `${SITE_URL}${localizar(locale, '/busca')}?cidade={search_term_string}`,
          },
          'query-input': 'required name=search_term_string',
        },
      },
    ],
  }

  return (
    <RootHtml lang={htmlLang[locale]} jsonLd={jsonLd}>
      <I18nProvider locale={locale} dict={dict}>
        {children}
      </I18nProvider>
    </RootHtml>
  )
}
