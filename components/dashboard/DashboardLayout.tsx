import Header from './Header'
import Sidebar from './Sidebar'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />

      <main className="dashboard-container">
        <Sidebar />

        <section className="dash-content">
          {children}
        </section>
      </main>
    </>
  )
}