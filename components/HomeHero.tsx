// Server Component: a primeira dobra da home. Antes, a página caía direto nos
// carrosséis de categoria — sem <h1> e sem proposta de valor acima da dobra.
// Este hero resolve a hierarquia semântica (o único <h1> da home), comunica o
// valor e oferece caminhos claros (buscar / anunciar / categorias). A busca em
// si continua na SearchBar do header — aqui não duplicamos o componente.
import Link from 'next/link'
import { CATS } from '@/lib/data'
import { localizar, type Locale } from '@/lib/i18n/config'
import { getDictionary } from '@/lib/i18n/getDictionary'
import { rotuloDado } from '@/lib/i18n/dados'

// Atalhos em destaque — nomes canônicos que existem em CATS (rótulo é localizado).
const DESTAQUE = ['Casas de Festas', 'Sítios', 'Bares e Restaurantes', 'Rooftops', 'Chácaras', 'Salão de Festas']

export default function HomeHero({ locale }: { locale: Locale }) {
  const dict = getDictionary(locale)
  const h = dict.home.hero
  const chips = DESTAQUE
    .map((nome) => CATS.find((c) => c.nome === nome))
    .filter((c): c is { nome: string; emoji: string } => Boolean(c))

  return (
    <section className="relative isolate overflow-hidden bg-ink text-white pt-20">
      {/* Realce de marca: glow coral + um toque dourado, sem peso de imagem. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(60% 70% at 18% 12%, rgba(255,56,92,0.30), transparent 60%), radial-gradient(50% 60% at 92% 100%, rgba(245,158,11,0.14), transparent 55%)',
        }}
      />
      <div className="relative mx-auto max-w-[1200px] px-[5%] py-16 sm:py-20 lg:py-28 animate-fade-up">
        <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-white/70">
          <span aria-hidden="true">✦</span> {h.tag}
        </p>

        <h1 className="mt-5 max-w-3xl font-display text-4xl font-black leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
          {h.tituloA}
          <span className="text-brand">{h.tituloEm}</span>
          {h.tituloB}
        </h1>

        <p className="mt-5 max-w-2xl text-base leading-relaxed text-white/70 sm:text-lg">
          {h.sub}
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
          <Link
            href={localizar(locale, '/busca')}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-brand px-7 py-3.5 text-sm font-bold text-white no-underline shadow-pop transition-colors hover:bg-brand-600 sm:text-base"
          >
            <span aria-hidden="true">🔍</span> {h.ctaBuscar}
          </Link>
          <Link
            href={localizar(locale, '/anunciar')}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-white/25 px-7 py-3.5 text-sm font-bold text-white no-underline transition-colors hover:bg-white/10 sm:text-base"
          >
            {h.ctaAnunciar}
          </Link>
        </div>

        <div className="mt-9 flex flex-wrap items-center gap-2">
          <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-white/40">
            {h.populares}
          </span>
          {chips.map((c) => (
            <Link
              key={c.nome}
              href={`${localizar(locale, '/busca')}?tipo=${encodeURIComponent(c.nome)}`}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-sm text-white/80 no-underline transition-colors hover:border-white/40 hover:bg-white/10"
            >
              <span aria-hidden="true">{c.emoji}</span>
              {rotuloDado(dict.dados.categorias, c.nome)}
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
