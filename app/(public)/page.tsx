import Header from '@/components/Header'
import Footer from '@/components/Footer'
import HomeFeed from '@/components/HomeFeed'

export default function Home() {
  return (
    <>
      <Header isLoggedIn={undefined} menuOpen={undefined} setMenuOpen={undefined} menuRef={undefined} />
      <main>
        <HomeFeed />
      </main>
      <Footer />
    </>
  )
}
