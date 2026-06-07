// Camada única de formatação i18n-ready (moeda, número, percentual, data).
// Centraliza TODA a formatação para suportar PT/EN/ES + BRL/USD/EUR sem
// hardcode de "R$" espalhado pelo código.
//
// As preferências ativas (idioma/moeda/fuso) ficam num holder mutável lido por
// TODAS as funções abaixo — assim a escolha em /painel/configuracoes vale no
// painel inteiro sem tocar cada call-site. No client o holder é hidratado do
// localStorage no import (instantâneo) e refinado pelo servidor (empresa_config)
// no boot do layout via setFormatPrefs(). No server, fica nos defaults.

export type Locale = 'pt-BR' | 'en-US' | 'es-ES'
export type Currency = 'BRL' | 'USD' | 'EUR'

export const DEFAULT_LOCALE: Locale = 'pt-BR'
export const DEFAULT_CURRENCY: Currency = 'BRL'

export const CURRENCY_BY_LOCALE: Record<Locale, Currency> = {
  'pt-BR': 'BRL',
  'en-US': 'USD',
  'es-ES': 'EUR',
}

// ── Preferências ativas ──────────────────────────────────────────────────────
const PREFS_KEY = 'ventsy_prefs'
let _locale: Locale = DEFAULT_LOCALE
let _currency: Currency = DEFAULT_CURRENCY
let _timeZone: string | undefined

/** Define as preferências ativas de formatação (idioma/moeda/fuso). */
export function setFormatPrefs(p: { locale?: Locale; currency?: Currency; timeZone?: string | null }): void {
  if (p.locale) _locale = p.locale
  if (p.currency) _currency = p.currency
  if (p.timeZone !== undefined) _timeZone = p.timeZone || undefined
}

/** Lê as preferências ativas de formatação. */
export function getFormatPrefs(): { locale: Locale; currency: Currency; timeZone?: string } {
  return { locale: _locale, currency: _currency, timeZone: _timeZone }
}

// Hidratação client-side no import — antes do primeiro paint já usa o salvo.
if (typeof window !== 'undefined') {
  try {
    const raw = window.localStorage.getItem(PREFS_KEY)
    if (raw) {
      const p = JSON.parse(raw) as { locale?: Locale; currency?: Currency; timeZone?: string }
      if (p.locale) _locale = p.locale
      if (p.currency) _currency = p.currency
      if (p.timeZone) _timeZone = p.timeZone
    }
  } catch {
    /* localStorage indisponível — segue nos defaults */
  }
}

type MoneyOpts = { currency?: Currency; locale?: Locale; maximumFractionDigits?: number }

/** Valor monetário completo. Ex.: formatMoney(2200) -> "R$ 2.200,00" (pt-BR/BRL). */
export function formatMoney(amount: number | null | undefined, opts: MoneyOpts = {}): string {
  const { currency = _currency, locale = _locale, maximumFractionDigits } = opts
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
  const { locale = _locale, maximumFractionDigits } = opts
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
  const { locale = _locale, maximumFractionDigits = 0 } = opts
  return new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits }).format(
    Number(fraction) || 0,
  )
}

function toDate(value: string | number | Date | null | undefined): Date | null {
  if (value == null || value === '') return null
  // Datas só-data (YYYY-MM-DD) são agnósticas de fuso: ancorar ao meio-dia local
  // evita o "off-by-one" de new Date('YYYY-MM-DD') ser interpretado como UTC.
  const v = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value + 'T12:00:00' : value
  const d = v instanceof Date ? v : new Date(v)
  return Number.isNaN(d.getTime()) ? null : d
}

export function formatDate(
  value: string | number | Date | null | undefined,
  opts: { locale?: Locale; style?: 'short' | 'medium' | 'long' } = {},
): string {
  const { locale = _locale, style = 'medium' } = opts
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

/** Data + hora, aplicando o fuso ativo (preferência do usuário). Para timestamps. */
export function formatDateTime(
  value: string | number | Date | null | undefined,
  opts: { locale?: Locale; timeZone?: string; withSeconds?: boolean } = {},
): string {
  const { locale = _locale, timeZone = _timeZone, withSeconds = false } = opts
  const d = toDate(value)
  if (!d) return ''
  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    ...(withSeconds ? { second: '2-digit' } : {}),
    ...(timeZone ? { timeZone } : {}),
  }).format(d)
}

export function formatDateRange(
  start: string | number | Date | null | undefined,
  end: string | number | Date | null | undefined,
  opts: { locale?: Locale } = {},
): string {
  const { locale = _locale } = opts
  const a = toDate(start)
  const b = toDate(end)
  if (a && b) {
    return new Intl.DateTimeFormat(locale, { day: '2-digit', month: 'short', year: 'numeric' })
      .formatRange(a, b)
  }
  return formatDate(a ?? b, { locale })
}
