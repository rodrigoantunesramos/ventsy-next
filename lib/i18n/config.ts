// Configuração central de i18n: locales suportados, default e helpers de prefixo
// de URL. Sem dependências externas — apenas tipos e utilitários puros, seguros
// para importar tanto em Server quanto em Client Components.

export const locales = ['pt', 'en', 'es'] as const
export type Locale = (typeof locales)[number]

export const defaultLocale: Locale = 'pt'

// Rótulos exibidos no seletor de idioma.
export const localeLabels: Record<Locale, string> = {
  pt: 'Português',
  en: 'English',
  es: 'Español',
}

// Bandeira (emoji) por locale — usada no seletor.
export const localeFlags: Record<Locale, string> = {
  pt: '🇧🇷',
  en: '🇺🇸',
  es: '🇪🇸',
}

// Atributo lang do <html> por locale (BCP-47).
export const htmlLang: Record<Locale, string> = {
  pt: 'pt-BR',
  en: 'en',
  es: 'es',
}

// hreflang por locale para alternates de SEO.
export const hreflang: Record<Locale, string> = {
  pt: 'pt-BR',
  en: 'en',
  es: 'es',
}

// OpenGraph locale por locale.
export const ogLocale: Record<Locale, string> = {
  pt: 'pt_BR',
  en: 'en_US',
  es: 'es_ES',
}

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (locales as readonly string[]).includes(value)
}

// Prefixa um caminho com o locale. localizar('en', '/busca') => '/en/busca';
// localizar('pt', '/') => '/pt'. Assume caminho começando com '/'.
export function localizar(locale: Locale, path = '/'): string {
  const clean = path.startsWith('/') ? path : `/${path}`
  return clean === '/' ? `/${locale}` : `/${locale}${clean}`
}

// Remove o prefixo de locale de um caminho, se presente.
// '/en/busca' => '/busca'; '/en' => '/'; '/painel' => '/painel'.
export function semLocale(path: string): string {
  const m = path.match(/^\/(pt|en|es)(\/.*)?$/)
  return m ? m[2] || '/' : path
}

// Extrai o locale de um caminho, ou null se não houver prefixo.
export function localeDoPath(path: string): Locale | null {
  const m = path.match(/^\/(pt|en|es)(\/|$)/)
  return m && isLocale(m[1]) ? (m[1] as Locale) : null
}
