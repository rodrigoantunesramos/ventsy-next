import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Anuncie seu espaço',
  description:
    'Anuncie seu espaço de eventos na VENTSY e alcance milhares de pessoas procurando o local ideal. Cadastro rápido e gratuito.',
  alternates: { canonical: '/anunciar' },
  openGraph: {
    title: 'Anuncie seu espaço · VENTSY',
    description: 'Cadastre seu espaço de eventos e receba solicitações de quem procura o local ideal. Grátis para começar.',
    url: '/anunciar',
  },
}

export default function AnunciarLayout({ children }: { children: React.ReactNode }) {
  return children
}
