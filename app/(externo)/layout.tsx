import type { Metadata } from 'next'
import RootHtml from '@/components/RootHtml'
import { SITE_URL } from '@/lib/site'

// Root layout das rotas por token (contrato/proposta/ingressos/feedback/pesquisa).
// Acessadas por link direto — sem locale, sem SEO, PT-BR, noindex.
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  robots: { index: false, follow: false },
}

export default function ExternoRootLayout({ children }: { children: React.ReactNode }) {
  return <RootHtml lang="pt-BR">{children}</RootHtml>
}
