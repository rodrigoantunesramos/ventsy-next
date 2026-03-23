import Header from '@/components/Header'
import Footer from '@/components/Footer'
import HomeFeed from '@/components/HomeFeed'

export default function Home() {
  return (
    <>
      <Header />
      <main className="mt-[88px]">
        <HomeFeed />
      </main>
      <Footer />
    </>
  )
}
