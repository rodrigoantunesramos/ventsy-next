import type { MetadataRoute } from 'next'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { SITE_URL } from '@/lib/site'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const admin = supabaseAdmin as any

// Revalida o sitemap a cada 6h (ISR) para refletir novos espaços/listas.
export const revalidate = 21600

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const estaticas: MetadataRoute.Sitemap = [
    { url: SITE_URL,                          changeFrequency: 'daily',   priority: 1 },
    { url: `${SITE_URL}/busca`,               changeFrequency: 'daily',   priority: 0.9 },
    { url: `${SITE_URL}/listas`,              changeFrequency: 'weekly',  priority: 0.8 },
    { url: `${SITE_URL}/planos`,              changeFrequency: 'monthly', priority: 0.6 },
    { url: `${SITE_URL}/como-funciona`,       changeFrequency: 'monthly', priority: 0.6 },
    { url: `${SITE_URL}/anunciar`,            changeFrequency: 'monthly', priority: 0.7 },
    { url: `${SITE_URL}/fale-conosco`,        changeFrequency: 'yearly',  priority: 0.4 },
    { url: `${SITE_URL}/cadastro`,            changeFrequency: 'yearly',  priority: 0.5 },
    { url: `${SITE_URL}/termos`,              changeFrequency: 'yearly',  priority: 0.3 },
    { url: `${SITE_URL}/privacidade`,         changeFrequency: 'yearly',  priority: 0.3 },
  ]

  // Propriedades publicadas — o ativo SEO long-tail mais valioso.
  let propriedades: MetadataRoute.Sitemap = []
  try {
    const { data } = await admin.from('propriedades').select('id').eq('publicada', true).limit(5000)
    propriedades = (data || []).map((p: { id: number | string }) => ({
      url: `${SITE_URL}/propriedade/${p.id}`,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    }))
  } catch { /* sem propriedades no sitemap se a consulta falhar */ }

  // Listas públicas (vitrine da comunidade).
  let listas: MetadataRoute.Sitemap = []
  try {
    const { data } = await admin.from('listas').select('slug').eq('publica', true).limit(2000)
    listas = (data || [])
      .filter((l: { slug?: string }) => l.slug)
      .map((l: { slug: string }) => ({
        url: `${SITE_URL}/listas/${l.slug}`,
        changeFrequency: 'weekly' as const,
        priority: 0.6,
      }))
  } catch { /* idem */ }

  return [...estaticas, ...propriedades, ...listas]
}
