import Header from '@/components/Header'
import Footer from '@/components/Footer'
import HomeFeed from '@/components/HomeFeed'

export default function Home() {
  return (
    <>
      <Header isLoggedIn={false} menuOpen={false} setMenuOpen={() => {}} menuRef={{ current: null }} />
      <main>
        <HomeFeed />
      </main>
      <Footer />
    </>
  )
}
