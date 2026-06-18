'use client'
// Provider de i18n da ÁREA LOGADA (/painel). Diferente do público, o locale NÃO
// vem da URL (o painel não tem prefixo) — vem da PREFERÊNCIA do dono (lib/prefs,
// espelhada de empresa_config no localStorage). Reusa o I18nProvider/useT() para
// que os componentes do painel consumam `dict` igual ao público.
import { useEffect, useState } from 'react'
import { I18nProvider } from '@/components/i18n/I18nProvider'
import { getDictionary } from '@/lib/i18n/getDictionary'
import { isLocale, defaultLocale, htmlLang, type Locale } from '@/lib/i18n/config'
import { loadStoredPrefs } from '@/lib/prefs'

function localeDaPref(): Locale {
  const idioma = loadStoredPrefs()?.idioma
  return isLocale(idioma) ? idioma : defaultLocale
}

export default function PainelI18nProvider({ children }: { children: React.ReactNode }) {
  // SSR começa em PT (default); o idioma real da pref é aplicado no cliente após
  // o mount (sem mismatch de hidratação — a 1ª render é PT nos dois lados).
  const [locale, setLocale] = useState<Locale>(defaultLocale)

  useEffect(() => {
    const sync = () => {
      const l = localeDaPref()
      setLocale(l)
      document.documentElement.lang = htmlLang[l]
      // Alinha o cookie público para que links do painel → site abram no mesmo idioma.
      document.cookie = `NEXT_LOCALE=${l};path=/;max-age=${60 * 60 * 24 * 365}`
    }
    sync()
    window.addEventListener('ventsy:prefs', sync)
    return () => window.removeEventListener('ventsy:prefs', sync)
  }, [])

  return (
    <I18nProvider locale={locale} dict={getDictionary(locale)}>
      {children}
    </I18nProvider>
  )
}
