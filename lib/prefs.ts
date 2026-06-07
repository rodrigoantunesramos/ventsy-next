// Preferências de exibição do painel (idioma / moeda / fuso / formato de data).
// Fonte de verdade no servidor (empresa_config); aqui mantemos o espelho no
// localStorage + a aplicação no holder de lib/format (setFormatPrefs), para que
// TODO o painel formate moeda/data/número conforme a escolha do dono — sem "R$"
// hardcode e sem prop-drilling. Importado apenas por componentes client.

import { setFormatPrefs, type Locale, type Currency } from '@/lib/format'

export type Idioma = 'pt' | 'en' | 'es'
export type FormatoData = 'auto' | 'short' | 'long'

const STORAGE_KEY = 'ventsy_prefs'

export const IDIOMAS: { v: Idioma; label: string; bandeira: string }[] = [
  { v: 'pt', label: 'Português (Brasil)', bandeira: '🇧🇷' },
  { v: 'en', label: 'English (US)', bandeira: '🇺🇸' },
  { v: 'es', label: 'Español', bandeira: '🇪🇸' },
]

export const MOEDAS: { v: Currency; label: string; simbolo: string }[] = [
  { v: 'BRL', label: 'Real brasileiro (BRL)', simbolo: 'R$' },
  { v: 'USD', label: 'US Dollar (USD)', simbolo: '$' },
  { v: 'EUR', label: 'Euro (EUR)', simbolo: '€' },
]

// Fusos comuns de operação (lista enxuta; o valor é IANA, usado pelo Intl).
export const FUSOS: { v: string; label: string }[] = [
  { v: 'America/Sao_Paulo', label: 'Brasília (GMT-3)' },
  { v: 'America/Manaus', label: 'Manaus (GMT-4)' },
  { v: 'America/Rio_Branco', label: 'Rio Branco (GMT-5)' },
  { v: 'America/Noronha', label: 'Fernando de Noronha (GMT-2)' },
  { v: 'America/New_York', label: 'New York (GMT-5/-4)' },
  { v: 'America/Mexico_City', label: 'Ciudad de México (GMT-6)' },
  { v: 'Europe/Lisbon', label: 'Lisboa (GMT+0/+1)' },
  { v: 'Europe/Madrid', label: 'Madrid (GMT+1/+2)' },
  { v: 'UTC', label: 'UTC (GMT+0)' },
]

export const FORMATOS_DATA: { v: FormatoData; label: string }[] = [
  { v: 'auto', label: 'Automático (pelo idioma)' },
  { v: 'short', label: 'Numérico — 31/12/2026' },
  { v: 'long', label: 'Por extenso — 31 de dezembro de 2026' },
]

export const LOCALE_BY_IDIOMA: Record<Idioma, Locale> = {
  pt: 'pt-BR',
  en: 'en-US',
  es: 'es-ES',
}

/** Moeda sugerida ao trocar de idioma (o dono ainda pode sobrescrever). */
export const MOEDA_BY_IDIOMA: Record<Idioma, Currency> = {
  pt: 'BRL',
  en: 'USD',
  es: 'EUR',
}

export type Prefs = {
  idioma: Idioma
  locale: Locale
  moeda: Currency
  fuso: string
  formato_data: FormatoData
}

export const DEFAULT_PREFS: Prefs = {
  idioma: 'pt',
  locale: 'pt-BR',
  moeda: 'BRL',
  fuso: 'America/Sao_Paulo',
  formato_data: 'auto',
}

/** Lê as preferências salvas no navegador (ou null se ausentes/inválidas). */
export function loadStoredPrefs(): Prefs | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw ? { ...DEFAULT_PREFS, ...(JSON.parse(raw) as Partial<Prefs>) } : null
  } catch {
    return null
  }
}

/**
 * Aplica preferências em todo o painel: calcula o locale a partir do idioma,
 * atualiza o holder de lib/format (moeda/data/fuso) e persiste no localStorage.
 * Chame ao salvar em /painel/configuracoes e no boot do layout (com os dados do
 * servidor). Dispara um evento para componentes que queiram reagir na hora.
 */
export function applyPrefs(input: { idioma?: Idioma; moeda?: Currency; fuso?: string; formato_data?: FormatoData }): Prefs {
  const base = loadStoredPrefs() ?? DEFAULT_PREFS
  const idioma = input.idioma ?? base.idioma
  const prefs: Prefs = {
    idioma,
    locale: LOCALE_BY_IDIOMA[idioma],
    moeda: input.moeda ?? base.moeda,
    fuso: input.fuso ?? base.fuso,
    formato_data: input.formato_data ?? base.formato_data,
  }
  setFormatPrefs({ locale: prefs.locale, currency: prefs.moeda, timeZone: prefs.fuso })
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
      window.dispatchEvent(new CustomEvent('ventsy:prefs', { detail: prefs }))
    } catch {
      /* ignore */
    }
  }
  return prefs
}
