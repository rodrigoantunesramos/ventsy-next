import { Suspense } from 'react'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import HomeFeed from '@/components/HomeFeed'
import HomeHero from '@/components/HomeHero'
import { getDictionary } from '@/lib/i18n/getDictionary'
import { isLocale, defaultLocale, type Locale } from '@/lib/i18n/config'

// Esqueleto exibido enquanto o HomeFeed (async Server Component) busca os espaços.
// Substitui o antigo texto "Carregando..." por uma silhueta dos carrosséis, que
// reduz a sensação de salto (CLS) e parece mais com o conteúdo final.
function HomeFeedSkeleton({ label }: { label: string }) {
  return (
    <div className="mx-auto max-w-[1440px] px-[5%]" role="status" aria-live="polite">
      <span className="sr-only">{label}</span>
      <div aria-hidden="true">
        {[0, 1].map((s) => (
          <div key={s} className="mb-9">
            <div className="mb-4 h-5 w-48 animate-pulse rounded-md bg-gray-200" />
            <div className="flex gap-3.5 overflow-hidden">
              {Array.from({ length: 7 }).map((_, i) => (
                <div key={i} className="w-[188px] flex-none">
                  <div className="h-[120px] w-full animate-pulse rounded-2xl bg-gray-200" />
                  <div className="mt-3 h-3.5 w-3/4 animate-pulse rounded bg-gray-200" />
                  <div className="mt-2 h-3 w-1/2 animate-pulse rounded bg-gray-200" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function Home({ params }: { params: { locale: string } }) {
  const locale: Locale = isLocale(params.locale) ? params.locale : defaultLocale
  const dict = getDictionary(locale)
  return (
    <>
      <Header />
      {/* O HomeHero já compensa o header fixo (pt-20 = h-20 do header) — por isso
          o <main> não precisa mais do antigo `mt-[88px]` cravado. */}
      <main>
        <HomeHero locale={locale} />
        <div className="pt-8 pb-4">
          <Suspense fallback={<HomeFeedSkeleton label={dict.home.carregandoEspacos} />}>
            <HomeFeed locale={locale} />
          </Suspense>
        </div>
      </main>
      <Footer />
    </>
  )
}
