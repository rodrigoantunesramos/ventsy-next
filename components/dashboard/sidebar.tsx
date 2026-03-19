'use client'

import { useRouter } from 'next/navigation'

export default function Sidebar() {
  const router = useRouter()

  return (
    <aside className="dash-sidebar">
      <div className="perfil-resumo">
        <div className="sidebar-avatar">?</div>
        <h3>Usuário</h3>
        <span className="handle">@usuario</span>
        <div className="plano-chip">⭐ Plano</div>
      </div>

      <nav className="dash-menu">
        <a onClick={() => router.push('/dashboard')}>🏠 Dashboard</a>

        <span className="menu-section-label">Minha Propriedade</span>
        <a onClick={() => router.push('/dashboard/propriedade')}>📍 Minha Propriedade</a>
        <a onClick={() => router.push('/dashboard/fotos')}>📸 Fotos</a>

        <span className="menu-section-label">Gestão</span>
        <a onClick={() => router.push('/dashboard/financeiro')}>💰 Financeiro</a>
        <a onClick={() => router.push('/dashboard/documentos')}>📄 Documentos</a>
        <a onClick={() => router.push('/dashboard/equipe')}>👥 Equipe</a>
      </nav>
    </aside>
  )
}