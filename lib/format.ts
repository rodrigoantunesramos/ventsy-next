// Camada única de formatação i18n-ready (moeda, número, percentual, data).
// Centraliza TODA a formatação para suportar PT/EN/ES + BRL/USD/EUR sem
// hardcode de "R$" espalhado pelo código. Enquanto a troca de idioma/moeda
// não tem provider, os defaults são pt-BR / BRL.

export type Locale = 'pt-BR' | 'en-US' | 'es-ES'
export type Currency = 'BRL' | 'USD' | 'EUR'

export const DEFAULT_LOCALE: Locale = 'pt-BR'
export const DEFAULT_CURRENCY: Currency = 'BRL'

export const CURRENCY_BY_LOCALE: Record<Locale, Currency> = {
  'pt-BR': 'BRL',
  'en-US': 'USD',
  'es-ES': 'EUR',
}

type MoneyOpts = { currency?: Currency; locale?: Locale; maximumFractionDigits?: number }

/** Valor monetário completo. Ex.: formatMoney(2200) -> "R$ 2.200,00" */
export function formatMoney(amount: number | null | undefined, opts: MoneyOpts = {}): string {
  const { currency = DEFAULT_CURRENCY, locale = DEFAULT_LOCALE, maximumFractionDigits } = opts
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    ...(maximumFractionDigits != null ? { maximumFractionDigits } : {}),
  }).format(Number(amount) || 0)
}

/** Moeda sem centavos — para KPIs/dashboards. Ex.: "R$ 48.700" */
export function formatMoneyShort(amount: number | null | undefined, opts: MoneyOpts = {}): string {
  return formatMoney(amount, { ...opts, maximumFractionDigits: 0 })
}

export function formatNumber(
  value: number | null | undefined,
  opts: { locale?: Locale; maximumFractionDigits?: number } = {},
): string {
  const { locale = DEFAULT_LOCALE, maximumFractionDigits } = opts
  return new Intl.NumberFormat(
    locale,
    maximumFractionDigits != null ? { maximumFractionDigits } : {},
  ).format(Number(value) || 0)
}

/** Percentual a partir de uma fração (0.15 -> "15%"). */
export function formatPercent(
  fraction: number | null | undefined,
  opts: { locale?: Locale; maximumFractionDigits?: number } = {},
): string {
  const { locale = DEFAULT_LOCALE, maximumFractionDigits = 0 } = opts
  return new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits }).format(
    Number(fraction) || 0,
  )
}

function toDate(value: string | number | Date | null | undefined): Date | null {
  if (value == null || value === '') return null
  const d = value instanceof Date ? value : new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

export function formatDate(
  value: string | number | Date | null | undefined,
  opts: { locale?: Locale; style?: 'short' | 'medium' | 'long' } = {},
): string {
  const { locale = DEFAULT_LOCALE, style = 'medium' } = opts
  const d = toDate(value)
  if (!d) return ''
  const fmt: Intl.DateTimeFormatOptions =
    style === 'short'
      ? { day: '2-digit', month: '2-digit', year: 'numeric' }
      : style === 'long'
        ? { day: 'numeric', month: 'long', year: 'numeric' }
        : { day: '2-digit', month: 'short', year: 'numeric' }
  return new Intl.DateTimeFormat(locale, fmt).format(d)
}

export function formatDateRange(
  start: string | number | Date | null | undefined,
  end: string | number | Date | null | undefined,
  opts: { locale?: Locale } = {},
): string {
  const { locale = DEFAULT_LOCALE } = opts
  const a = toDate(start)
  const b = toDate(end)
  if (a && b) {
    return new Intl.DateTimeFormat(locale, { day: '2-digit', month: 'short', year: 'numeric' })
      .formatRange(a, b)
  }
  return formatDate(a ?? b, { locale })
}
