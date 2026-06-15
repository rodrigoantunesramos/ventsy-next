'use client'
// Provê o locale + dicionário (vindos do Server via props) para todos os Client
// Components da árvore localizada. Use `useT()` para ler.
import { createContext, useContext } from 'react'
import type { Locale } from '@/lib/i18n/config'
import { defaultLocale, localizar } from '@/lib/i18n/config'
import ptDict, { type Dictionary } from '@/lib/i18n/dictionaries/pt'

type I18nValue = {
  locale: Locale
  dict: Dictionary
  // Prefixa um caminho com o locale atual: lhref('/busca') => '/en/busca'.
  lhref: (path?: string) => string
}

const I18nContext = createContext<I18nValue | null>(null)

export function I18nProvider({
  locale,
  dict,
  children,
}: {
  locale: Locale
  dict: Dictionary
  children: React.ReactNode
}) {
  const value: I18nValue = {
    locale,
    dict,
    lhref: (path = '/') => localizar(locale, path),
  }
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useT(): I18nValue {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useT() precisa estar dentro de <I18nProvider>')
  return ctx
}

// Variante tolerante: fora de um <I18nProvider> (ex.: árvores ainda não
// localizadas como /painel) cai no dicionário PT + locale padrão, sem prefixo
// de URL. Útil em componentes compartilhados pelas duas árvores.
export function useTOptional(): I18nValue {
  const ctx = useContext(I18nContext)
  if (ctx) return ctx
  return {
    locale: defaultLocale,
    dict: ptDict,
    lhref: (path = '/') => path,
  }
}
