// Shell HTML compartilhado pelos múltiplos root layouts (localizado + áreas
// internas). Centraliza fontes, CSS global e <link>s de CDN para evitar
// duplicação. Cada root layout passa o `lang` apropriado.
import { DM_Sans, Playfair_Display } from 'next/font/google'
import '@/app/globals.css'
import '@/styles/publico.css'

// DM Sans é a fonte de corpo da marca (o publico.css/legal.css assumem DM Sans).
// Carregada aqui via next/font (otimizada, self-hosted) e exposta em --font-sans —
// substitui o antigo Inter e o @import de DM Sans por CDN (que baixava a fonte 2×).
const dmSans = DM_Sans({ subsets: ['latin'], variable: '--font-sans', display: 'swap' })
const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
})

// Bootstrap de tema ANTES do paint (evita flash claro→escuro). Lê a preferência
// salva em localStorage (ventsy_prefs.tema) e, se for 'escuro' — ou 'sistema'
// com o SO em escuro — liga a classe `dark` no <html>. Injetado só onde
// themeBootstrap=true (área do painel), mantendo as demais áreas no claro.
const THEME_BOOTSTRAP =
  "(function(){try{var p=JSON.parse(localStorage.getItem('ventsy_prefs')||'{}');var t=p.tema||'sistema';var d=t==='escuro'||(t!=='claro'&&window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches);if(d){document.documentElement.classList.add('dark');}}catch(e){}})();"

export default function RootHtml({
  lang,
  jsonLd,
  themeBootstrap,
  children,
}: {
  lang: string
  jsonLd?: object
  themeBootstrap?: boolean
  children: React.ReactNode
}) {
  return (
    <html lang={lang} className={`${dmSans.variable} ${playfair.variable}`} suppressHydrationWarning>
      <head>
        {themeBootstrap && <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />}
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
