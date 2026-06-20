import type { MetadataRoute } from 'next'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { SITE_URL } from '@/lib/site'
import { locales, hreflang, localizar, defaultLocale } from '@/lib/i18n/config'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const admin = supabaseAdmin as any

// Revalida o sitemap a cada 6h (ISR) para refletir novos espaços/listas.
export const revalidate = 21600

type CF = 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never'

// Bloco hreflang de um caminho: aponta para as 3 versões + x-default (pt).
function languagesDe(path: string): Record<string, string> {
  const languages: Record<string, string> = {}
  locales.forEach((l) => {
    languages[hreflang[l]] = `${SITE_URL}${localizar(l, path)}`
  })
  languages['x-default'] = `${SITE_URL}${localizar(defaultLocale, path)}`
  return languages
}

// Gera as 3 entradas localizadas de um caminho, cada uma com o bloco hreflang.
function localizado(path: string, changeFrequency: CF, priority: number): MetadataRoute.Sitemap {
  const languages = languagesDe(path)
  return locales.map((l) => ({
    url: `${SITE_URL}${localizar(l, path)}`,
    changeFrequency,
    priority,
    alternates: { languages },
  }))
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const estaticas: MetadataRoute.Sitemap = [
    ...localizado('/', 'daily', 1),
    ...localizado('/busca', 'daily', 0.9),
    ...localizado('/listas', 'weekly', 0.8),
    ...localizado('/planos', 'monthly', 0.6),
    ...localizado('/como-funciona', 'monthly', 0.6),
    ...localizado('/anunciar', 'monthly', 0.7),
    ...localizado('/fale-conosco', 'yearly', 0.4),
    ...localizado('/cadastro', 'yearly', 0.5),
    ...localizado('/termos', 'yearly', 0.3),
    ...localizado('/privacidade', 'yearly', 0.3),
  ]

  // Propriedades publicadas — o ativo SEO long-tail mais valioso (× 3 locales).
  let propriedades: MetadataRoute.Sitemap = []
  try {
    const { data } = await admin.from('propriedades').select('id').eq('publicada', true).limit(5000)
    propriedades = (data || []).flatMap((p: { id: number | string }) =>
      localizado(`/propriedade/${p.id}`, 'weekly', 0.8),
    )
  } catch { /* sem propriedades no sitemap se a consulta falhar */ }

  // Listas públicas (vitrine da comunidade) × 3 locales.
  let listas: MetadataRoute.Sitemap = []
  try {
    const { data } = await admin.from('listas').select('slug').eq('publica', true).limit(2000)
    listas = (data || [])
      .filter((l: { slug?: string }) => l.slug)
      .flatMap((l: { slug: string }) => localizado(`/listas/${l.slug}`, 'weekly', 0.6))
  } catch { /* idem */ }

  return [...estaticas, ...propriedades, ...listas]
}
