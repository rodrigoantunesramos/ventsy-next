// Resolve o dicionário de um locale (uso em Server Components / generateMetadata).
// Import estático dos 3 dicionários: ficam no bundle do SERVIDOR apenas. O Client
// recebe somente o dicionário do locale ativo, via props do I18nProvider.
import type { Locale } from './config'
import type { Dictionary } from './dictionaries/pt'
import pt from './dictionaries/pt'
import en from './dictionaries/en'
import es from './dictionaries/es'

const dicts: Record<Locale, Dictionary> = { pt, en, es }

export function getDictionary(locale: Locale): Dictionary {
  return dicts[locale] ?? pt
}
