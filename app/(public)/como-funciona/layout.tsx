import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Como funciona',
  description:
    'Entenda como anunciar seu espaço ou encontrar e reservar o local perfeito para o seu evento na VENTSY — do anúncio à reserva, passo a passo.',
  alternates: { canonical: '/como-funciona' },
  openGraph: {
    title: 'Como funciona · VENTSY',
    description: 'Do anúncio à reserva: entenda como a VENTSY conecta quem busca e quem oferece espaços para eventos.',
    url: '/como-funciona',
  },
}

export default function ComoFuncionaLayout({ children }: { children: React.ReactNode }) {
  return children
}
