// Página PÚBLICA de uma propriedade — /propriedade/[id].
// Server Component "casca": gera metadata dinâmica + JSON-LD (EventVenue +
// AggregateRating) no servidor, e renderiza a experiência interativa como ilha
// cliente (_PropriedadeClient: galeria, reserva, avaliações, etc.).

import type { Metadata } from 'next'
import { SITE_NAME, abs } from '@/lib/site'
import { isLocale, defaultLocale, localizar, htmlLang, type Locale } from '@/lib/i18n/config'
import { buildAlternates } from '@/lib/i18n/seo'
import { getDictionary } from '@/lib/i18n/getDictionary'
import { fetchPropriedadeMeta, fetchPropriedadeFotos, type PropMeta } from './_data'
import PropriedadeClient from './_PropriedadeClient'

export const revalidate = 300

export async function generateMetadata({ params }: { params: { locale: string; id: string } }): Promise<Metadata> {
  const locale: Locale = isLocale(params.locale) ? params.locale : defaultLocale
  const t = getDictionary(locale).propriedade
  const prop = await fetchPropriedadeMeta(Number(params.id))
  if (!prop) return { title: t.meta.tituloFallback }

  const local = [prop.cidade, prop.estado].filter(Boolean).join(', ')
  const titulo = `${prop.nome || t.meta.tituloFallback}${local ? ` — ${local}` : ''}`
  const desc = (
    prop.descricao ||
    `${t.meta.descConhecaA} ${prop.nome || t.meta.descConhecaEsteEspaco} ${t.meta.descParaEvento}${local ? ` ${t.meta.descEm} ${local}` : ''} ${t.meta.descNa} ${SITE_NAME}.`
  )
    .replace(/\s+/g, ' ')
    .slice(0, 160)
  const img = prop.imagem_url || undefined
  const url = localizar(locale, `/propriedade/${prop.id}`)

  return {
    title: titulo,
    description: desc,
    alternates: buildAlternates(locale, `/propriedade/${prop.id}`),
    openGraph: {
      title: prop.nome || titulo,
      description: desc,
      type: 'website',
      url: abs(url),
      ...(img ? { images: [{ url: img }] } : {}),
    },
    twitter: { card: img ? 'summary_large_image' : 'summary', title: prop.nome || titulo, description: desc },
    // Espaços ainda não publicados (rascunho) não devem ser indexados.
    ...(prop.publicada === false ? { robots: { index: false, follow: true } } : {}),
  }
}

function eventVenueLd(prop: PropMeta, locale: Locale) {
  const t = getDictionary(locale).propriedade
  const img = prop.imagem_url
  const capacidade = prop.capacidade ? Number(String(prop.capacidade).replace(/\D/g, '')) : 0
  const nota = prop.avaliacao ? Number(prop.avaliacao) : 0

  return {
    '@context': 'https://schema.org',
    '@type': 'EventVenue',
    name: prop.nome || t.meta.tituloFallback,
    inLanguage: htmlLang[locale],
    ...(prop.descricao ? { description: prop.descricao.replace(/\s+/g, ' ').slice(0, 400) } : {}),
    ...(img ? { image: img } : {}),
    url: abs(localizar(locale, `/propriedade/${prop.id}`)),
    ...(prop.cidade || prop.estado
      ? {
          address: {
            '@type': 'PostalAddress',
            ...(prop.cidade ? { addressLocality: prop.cidade } : {}),
            ...(prop.estado ? { addressRegion: prop.estado } : {}),
            addressCountry: 'BR',
          },
        }
      : {}),
    ...(capacidade > 0 ? { maximumAttendeeCapacity: capacidade } : {}),
    ...(nota > 0 && prop.nAvaliacoes > 0
      ? {
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: nota.toFixed(1),
            reviewCount: prop.nAvaliacoes,
            bestRating: 5,
            worstRating: 1,
          },
        }
      : {}),
  }
}

// Breadcrumb (Início › região › espaço) — sinal de navegação para o Google.
function breadcrumbLd(prop: PropMeta, locale: Locale) {
  const local = prop.cidade || prop.estado || ''
  const buscaPath = prop.cidade
    ? localizar(locale, `/busca?cidade=${encodeURIComponent(prop.cidade)}`)
    : prop.estado
      ? localizar(locale, `/busca?estado=${encodeURIComponent(prop.estado)}`)
      : localizar(locale, '/busca')
  const nome = prop.nome || getDictionary(locale).propriedade.meta.tituloFallback
  const itens: Array<Record<string, unknown>> = [
    { '@type': 'ListItem', position: 1, name: SITE_NAME, item: abs(localizar(locale, '/')) },
  ]
  if (local) itens.push({ '@type': 'ListItem', position: 2, name: local, item: abs(buscaPath) })
  itens.push({ '@type': 'ListItem', position: local ? 3 : 2, name: nome })
  return { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: itens }
}

// FAQPage a partir do FAQ do anúncio (quando houver) — elegível a rich snippet.
function faqLd(prop: PropMeta) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const faq = Array.isArray(prop.faq) ? (prop.faq as any[]).filter((f) => f?.pergunta && f?.resposta) : []
  if (!faq.length) return null
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mainEntity: faq.map((f: any) => ({
      '@type': 'Question',
      name: f.pergunta,
      acceptedAnswer: { '@type': 'Answer', text: f.resposta },
    })),
  }
}

export default async function PropriedadePage({ params }: { params: { locale: string; id: string } }) {
  const locale: Locale = isLocale(params.locale) ? params.locale : defaultLocale
  // Busca a propriedade e suas fotos no servidor para semear a ilha cliente:
  // o herói entra no HTML inicial (LCP) em vez de aparecer só após o fetch.
  const [prop, fotos] = await Promise.all([
    fetchPropriedadeMeta(Number(params.id)),
    fetchPropriedadeFotos(Number(params.id)),
  ])

  const faqLdData = prop ? faqLd(prop) : null
  return (
    <>
      {prop && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(eventVenueLd(prop, locale)) }} />
      )}
      {prop && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd(prop, locale)) }} />
      )}
      {faqLdData && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLdData) }} />
      )}
      <PropriedadeClient initialProp={prop} initialFotos={fotos} />
    </>
  )
}
