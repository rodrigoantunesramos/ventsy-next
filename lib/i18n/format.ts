// Formatação sensível a locale via Intl nativo do JS (zero dependências).
import type { Locale } from './config'

const intlLocale: Record<Locale, string> = {
  pt: 'pt-BR',
  en: 'en-US',
  es: 'es-ES',
}

// IMPORTANTE: preços são SEMPRE em BRL — o Ventsy é um marketplace brasileiro e
// não há conversão de câmbio. O locale afeta apenas separadores e a posição do
// símbolo (ex.: "R$ 1.234,56" em pt vs "R$1,234.56" em en).
export function formatMoney(
  locale: Locale,
  value: number,
  opts?: Intl.NumberFormatOptions,
): string {
  return new Intl.NumberFormat(intlLocale[locale], {
    style: 'currency',
    currency: 'BRL',
    ...opts,
  }).format(value)
}

export function formatNumber(
  locale: Locale,
  value: number,
  opts?: Intl.NumberFormatOptions,
): string {
  return new Intl.NumberFormat(intlLocale[locale], opts).format(value)
}

export function formatDate(
  locale: Locale,
  value: Date | string | number,
  opts: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'long', year: 'numeric' },
): string {
  const d = value instanceof Date ? value : new Date(value)
  return new Intl.DateTimeFormat(intlLocale[locale], opts).format(d)
}

// Plural via Intl.PluralRules. `forms` mapeia categorias CLDR → string; `#` é
// substituído pela contagem. Ex.: plural('en', n, { one: '# space', other: '# spaces' }).
export function plural(
  locale: Locale,
  count: number,
  forms: Partial<Record<Intl.LDMLPluralRule, string>> & { other: string },
): string {
  const rule = new Intl.PluralRules(intlLocale[locale]).select(count)
  return (forms[rule] ?? forms.other).replace('#', String(count))
}
