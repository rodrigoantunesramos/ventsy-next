import type { Metadata } from 'next'
import RootHtml from '@/components/RootHtml'
import { SITE_URL } from '@/lib/site'

// Root layout da área do cliente/contratante (/client/*). Sem locale — área
// interna, PT-BR, noindex. O shell visual fica em client/layout.tsx.
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: 'Minha Área · VENTSY', template: '%s · VENTSY' },
  robots: { index: false, follow: false },
}

export default function ClientRootLayout({ children }: { children: React.ReactNode }) {
  return <RootHtml lang="pt-BR">{children}</RootHtml>
}
