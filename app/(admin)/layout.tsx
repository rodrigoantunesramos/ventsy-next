import type { Metadata } from 'next'
import RootHtml from '@/components/RootHtml'
import { SITE_URL } from '@/lib/site'

// Root layout da área administrativa (/admin/*). Sem locale — área interna,
// PT-BR, noindex. A proteção server-side e o shell ficam em admin/layout.tsx.
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  robots: { index: false, follow: false },
}

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return <RootHtml lang="pt-BR">{children}</RootHtml>
}
