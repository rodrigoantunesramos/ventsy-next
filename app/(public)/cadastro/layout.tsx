import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Criar conta',
  description:
    'Crie sua conta gratuita na VENTSY para anunciar seu espaço de eventos ou gerenciar suas reservas. Leva menos de um minuto.',
  alternates: { canonical: '/cadastro' },
  openGraph: {
    title: 'Criar conta · VENTSY',
    description: 'Crie sua conta gratuita para anunciar seu espaço ou reservar o local do seu evento.',
    url: '/cadastro',
  },
}

export default function CadastroLayout({ children }: { children: React.ReactNode }) {
  return children
}
