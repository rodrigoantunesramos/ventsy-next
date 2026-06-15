import { Suspense } from 'react'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import HomeFeed from '@/components/HomeFeed'

export default function Home() {
  return (
    <>
      <Header />
      <main className="mt-[88px]">
        <Suspense fallback={<div className="flex items-center justify-center py-20 text-gray-400 text-sm">Carregando espaços...</div>}>
          {/* HomeFeed é async Server Component: busca e renderiza os espaços no servidor */}
          <HomeFeed />
        </Suspense>
      </main>
      <Footer />
    </>
  )
}
