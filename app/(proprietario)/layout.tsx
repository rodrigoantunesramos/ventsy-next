import type { Metadata } from 'next'
import RootHtml from '@/components/RootHtml'
import { SITE_URL } from '@/lib/site'

// Root layout da área do proprietário (/painel/*). Sem locale — área interna,
// PT-BR, fora do SEO. O shell visual (sidebar/topbar) fica no painel/layout.tsx.
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: 'Painel · VENTSY', template: '%s · VENTSY' },
  robots: { index: false, follow: false },
}

export default function ProprietarioRootLayout({ children }: { children: React.ReactNode }) {
  return <RootHtml lang="pt-BR">{children}</RootHtml>
}
