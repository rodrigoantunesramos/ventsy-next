import { Suspense } from 'react'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import HomeFeed from '@/components/HomeFeed'
import { getDictionary } from '@/lib/i18n/getDictionary'
import { isLocale, defaultLocale, type Locale } from '@/lib/i18n/config'

export default function Home({ params }: { params: { locale: string } }) {
  const locale: Locale = isLocale(params.locale) ? params.locale : defaultLocale
  const dict = getDictionary(locale)
  return (
    <>
      <Header />
      <main className="mt-[88px]">
        <Suspense fallback={<div className="flex items-center justify-center py-20 text-gray-400 text-sm">{dict.home.carregandoEspacos}</div>}>
          {/* HomeFeed é async Server Component: busca e renderiza os espaços no servidor */}
          <HomeFeed locale={locale} />
        </Suspense>
      </main>
      <Footer />
    </>
  )
}
