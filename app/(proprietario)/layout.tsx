import type { Metadata } from 'next'
import RootHtml from '@/components/RootHtml'
import PainelI18nProvider from '@/components/i18n/PainelI18nProvider'
import { SITE_URL } from '@/lib/site'

// Root layout da área do proprietário (/painel/*). Sem locale na URL — o idioma
// vem da preferência do dono (PainelI18nProvider). O shell visual fica no
// painel/layout.tsx.
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: 'Painel · VENTSY', template: '%s · VENTSY' },
  robots: { index: false, follow: false },
}

export default function ProprietarioRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <RootHtml lang="pt-BR">
      <PainelI18nProvider>{children}</PainelI18nProvider>
    </RootHtml>
  )
}
