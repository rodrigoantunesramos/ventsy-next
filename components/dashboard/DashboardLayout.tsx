import Header from './Header'
import Sidebar from './Sidebar'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      <main className="flex">
        <Sidebar />
        <section className="flex-1 min-w-0">
          {children}
        </section>
      </main>
    </>
  )
}
