import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Buscar espaços para eventos',
  description:
    'Encontre e compare espaços para eventos no Brasil: casas de festa, sítios, salões, rooftops e mais. Filtre por cidade, capacidade e tipo de evento.',
  alternates: { canonical: '/busca' },
  openGraph: {
    title: 'Buscar espaços para eventos · VENTSY',
    description: 'Encontre e compare espaços para eventos no Brasil por cidade, capacidade e tipo de evento.',
    url: '/busca',
  },
}

export default function BuscaLayout({ children }: { children: React.ReactNode }) {
  return children
}
