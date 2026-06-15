import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Entrar',
  description: 'Acesse sua conta VENTSY para gerenciar seus espaços, reservas e anúncios.',
  alternates: { canonical: '/login' },
  // Página de login não agrega valor de busca e não deve ser indexada.
  robots: { index: false, follow: true },
}

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children
}
