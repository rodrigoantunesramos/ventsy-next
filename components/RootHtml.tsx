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
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/flatpickr/dist/flatpickr.min.css" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/icon?family=Material+Icons" />
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
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
