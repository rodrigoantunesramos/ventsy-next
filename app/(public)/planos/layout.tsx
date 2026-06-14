import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Planos e preços',
  description:
    'Escolha o plano ideal para anunciar seu espaço de eventos na VENTSY: Básico grátis, Pro e Ultra. Mais visibilidade, fotos e recursos premium.',
  alternates: { canonical: '/planos' },
  openGraph: {
    title: 'Planos e preços · VENTSY',
    description: 'Básico grátis, Pro e Ultra: escolha o plano ideal para anunciar seu espaço de eventos.',
    url: '/planos',
  },
}

export default function PlanosLayout({ children }: { children: React.ReactNode }) {
  return children
}
