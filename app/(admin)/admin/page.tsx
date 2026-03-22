'use client'
// ─────────────────────────────────────────────────────────────────
// VENTSY Admin — Painel de Administração Central
// Rota: /admin
//
// Acesso restrito ao proprietário (verificação por e-mail em
// ADMIN_EMAILS dentro de /public/admin/admin.js).
//
// TODO: adicionar verificação server-side no middleware quando pronto.
// ─────────────────────────────────────────────────────────────────

import Script from 'next/script'

import AdminLoadingScreen from '@/components/admin/AdminLoadingScreen'
import AdminLoginScreen   from '@/components/admin/AdminLoginScreen'
import AdminSidebar       from '@/components/admin/AdminSidebar'
import AdminTopbar        from '@/components/admin/AdminTopbar'
import AdminModals        from '@/components/admin/AdminModals'

import PageDashboard    from '@/components/admin/pages/PageDashboard'
import PageAnalytics    from '@/components/admin/pages/PageAnalytics'
import PagePropriedades from '@/components/admin/pages/PagePropriedades'
import PageUsuarios     from '@/components/admin/pages/PageUsuarios'
import PageIncompletos  from '@/components/admin/pages/PageIncompletos'
import PageAssinaturas  from '@/components/admin/pages/PageAssinaturas'
import PagePlanos       from '@/components/admin/pages/PagePlanos'
import PageConfig       from '@/components/admin/pages/PageConfig'
import PageFinanceiro   from '@/components/admin/pages/PageFinanceiro'
import PageQualidade    from '@/components/admin/pages/PageQualidade'
import PageComunicacao  from '@/components/admin/pages/PageComunicacao'
import PageCupons       from '@/components/admin/pages/PageCupons'
import PageLogs         from '@/components/admin/pages/PageLogs'

export default function AdminPage() {
  return (
    <div className="admin-root">
      {/* ── Scripts CDN ────────────────────────────────────────── */}
      <Script
        src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"
        strategy="beforeInteractive"
      />
      <Script
        src="https://cdn.jsdelivr.net/npm/chart.js"
        strategy="beforeInteractive"
      />

      {/* ── Lógica do painel (extraída do admin.html original) ── */}
      <Script
        src="/admin/admin.js"
        strategy="afterInteractive"
      />

      {/* ── Loading & Login ─────────────────────────────────────── */}
      <AdminLoadingScreen />
      <AdminLoginScreen />

      {/* ── Sidebar ─────────────────────────────────────────────── */}
      <AdminSidebar />

      {/* ── Área principal ──────────────────────────────────────── */}
      <div className="admin-main" id="main-content">
        <AdminTopbar />

        <div className="admin-content">
          <PageDashboard />
          <PageAnalytics />
          <PagePropriedades />
          <PageUsuarios />
          <PageIncompletos />
          <PageAssinaturas />
          <PagePlanos />
          <PageConfig />
          <PageFinanceiro />
          <PageQualidade />
          <PageComunicacao />
          <PageCupons />
          <PageLogs />
        </div>
      </div>

      {/* ── Modais ──────────────────────────────────────────────── */}
      <AdminModals />

      {/* ── Toasts ──────────────────────────────────────────────── */}
      <div id="toast-container"></div>
    </div>
  )
}
