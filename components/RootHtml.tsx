// Shell HTML compartilhado pelos múltiplos root layouts (localizado + áreas
// internas). Centraliza fontes, CSS global e <link>s de CDN para evitar
// duplicação. Cada root layout passa o `lang` apropriado.
import { Inter, Playfair_Display } from 'next/font/google'
import '@/app/globals.css'
import '@/styles/publico.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-sans', display: 'swap' })
const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
})

export default function RootHtml({
  lang,
  jsonLd,
  children,
}: {
  lang: string
  jsonLd?: object
  children: React.ReactNode
}) {
  return (
    <html lang={lang} className={`${inter.variable} ${playfair.variable}`}>
      <head>
        {/* Material Icons ainda é webfont; preconectar às origens do Google Fonts
            acelera seu carregamento (display=block evita o flash do texto da
            ligadura). flatpickr e Leaflet saíram do shell — agora vêm por import
            nos componentes (SearchBar/SearchMap), carregados só onde são usados. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/icon?family=Material+Icons&display=block" />
        {jsonLd && (
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
          />
        )}
      </head>
      <body className="font-sans antialiased">{children}</body>
    </html>
  )
}
