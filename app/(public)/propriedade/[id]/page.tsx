// Página PÚBLICA de uma propriedade — /propriedade/[id].
// Server Component "casca": gera metadata dinâmica + JSON-LD (EventVenue +
// AggregateRating) no servidor, e renderiza a experiência interativa como ilha
// cliente (_PropriedadeClient: galeria, reserva, avaliações, etc.).

import type { Metadata } from 'next'
import { SITE_NAME, abs } from '@/lib/site'
import { fetchPropriedadeMeta, type PropMeta } from './_data'
import PropriedadeClient from './_PropriedadeClient'

export const revalidate = 300

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const prop = await fetchPropriedadeMeta(Number(params.id))
  if (!prop) return { title: 'Espaço para eventos' }

  const local = [prop.cidade, prop.estado].filter(Boolean).join(', ')
  const titulo = `${prop.nome || 'Espaço para eventos'}${local ? ` — ${local}` : ''}`
  const desc = (prop.descricao || `Conheça ${prop.nome || 'este espaço'} para o seu evento${local ? ` em ${local}` : ''} na ${SITE_NAME}.`)
    .replace(/\s+/g, ' ')
    .slice(0, 160)
  const img = prop.imagem_url || undefined

  return {
    title: titulo,
    description: desc,
    alternates: { canonical: `/propriedade/${prop.id}` },
    openGraph: {
      title: prop.nome || titulo,
      description: desc,
      type: 'website',
      url: abs(`/propriedade/${prop.id}`),
      ...(img ? { images: [{ url: img }] } : {}),
    },
    twitter: { card: img ? 'summary_large_image' : 'summary', title: prop.nome || titulo, description: desc },
    // Espaços ainda não publicados (rascunho) não devem ser indexados.
    ...(prop.publicada === false ? { robots: { index: false, follow: true } } : {}),
  }
}

function eventVenueLd(prop: PropMeta) {
  const img = prop.imagem_url
  const capacidade = prop.capacidade ? Number(String(prop.capacidade).replace(/\D/g, '')) : 0
  const nota = prop.avaliacao ? Number(prop.avaliacao) : 0

  return {
    '@context': 'https://schema.org',
    '@type': 'EventVenue',
    name: prop.nome || 'Espaço para eventos',
    ...(prop.descricao ? { description: prop.descricao.replace(/\s+/g, ' ').slice(0, 400) } : {}),
    ...(img ? { image: img } : {}),
    url: abs(`/propriedade/${prop.id}`),
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

export default async function PropriedadePage({ params }: { params: { id: string } }) {
  const prop = await fetchPropriedadeMeta(Number(params.id))

  return (
    <>
      {prop && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(eventVenueLd(prop)) }} />
      )}
      <PropriedadeClient />
    </>
  )
}
