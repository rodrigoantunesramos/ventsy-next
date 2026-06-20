import type { Metadata } from 'next'
import { SITE_URL } from '@/lib/site'
import { locales, hreflang, localizar, defaultLocale, type Locale } from './config'

// Bloco `alternates` para o <head> de uma página: canonical absoluto do locale
// atual + hreflang das 3 versões + x-default (pt). Reforça o hreflang que já
// está no sitemap. `path` é relativo e SEM prefixo (ex.: '/busca', '/propriedade/123').
export function buildAlternates(locale: Locale, path: string): NonNullable<Metadata['alternates']> {
  const languages: Record<string, string> = {}
  for (const l of locales) languages[hreflang[l]] = `${SITE_URL}${localizar(l, path)}`
  languages['x-default'] = `${SITE_URL}${localizar(defaultLocale, path)}`
  return {
    canonical: `${SITE_URL}${localizar(locale, path)}`,
    languages,
  }
}
