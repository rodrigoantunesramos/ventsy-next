'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import '@/styles/client.css'

interface UserProfile {
  nome: string
  email: string
  inicial: string
}

const MENU_ITEMS = [
  { href: '/client',          label: '🏠 Início',          rota: '/client'          },
  { href: '/client/favoritos', label: '❤️ Favoritos',       rota: '/client/favoritos' },
  { href: '/client/conversas', label: '💬 Conversas',       rota: '/client/conversas' },
  { href: '/client/avaliacoes',label: '⭐ Minhas Avaliações',rota: '/client/avaliacoes'},
]

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const [profile,    setProfile]  = useState<UserProfile | null>(null)
  const [sidebarOpen, setSidebar] = useState(false)
  const [avatarOpen,  setAvatar]  = useState(false)
  const [loading,    setLoading]  = useState(true)

  const router    = useRouter()
  const pathname  = usePathname()
  const avatarRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }

      const user = session.user
      let nome   = user.email ?? ''

      try {
        const { data: perfil } = await supabase
          .from('usuarios')
          .select('nome')
          .eq('id', user.id)
          .single()
        if (perfil?.nome) nome = perfil.nome
      } catch { /* silencioso */ }

      const inicial = (nome.split(' ')[0]?.[0] ?? '?').toUpperCase()
      setProfile({ nome, email: user.email ?? '', inicial })
      setLoading(false)
    })()
  }, [router])

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (!avatarRef.current?.contains(e.target as Node)) setAvatar(false)
    }
    document.addEventListener('click', h)
    return () => document.removeEventListener('click', h)
  }, [])

  const handleSair = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (loading) {
    return (
      <div style={{
        position: 'fixed', inset: 0, background: '#fff',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', zIndex: 9999,
      }}>
        <div style={{ fontFamily: 'Georgia,serif', fontStyle: 'italic', fontSize: '2rem', color: '#ff385c' }}>
          VENTSY
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 16 }}>
          {[0,1,2].map(i => (
            <span key={i} style={{
              width: 8, height: 8, borderRadius: '50%', background: '#ff385c',
              animation: `bounce 1s ${i * 0.15}s infinite`,
            }} />
          ))}
        </div>
        <style>{`@keyframes bounce{0%,80%,100%{transform:scale(0)}40%{transform:scale(1)}}`}</style>
      </div>
    )
  }

  return (
    <div className="cl-root">

      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: '#fff', borderBottom: '1px solid #f0f0f0',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 20px', height: 60,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={() => setSidebar(!sidebarOpen)}
            aria-label="Menu"
            className="cl-btn-toggle"
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 8, flexDirection: 'column', gap: 5 }}
          >
            <span style={{ display: 'block', width: 22, height: 2, background: '#333', borderRadius: 2 }} />
            <span style={{ display: 'block', width: 22, height: 2, background: '#333', borderRadius: 2 }} />
            <span style={{ display: 'block', width: 22, height: 2, background: '#333', borderRadius: 2 }} />
          </button>
          <Link href="/">
            <span style={{ fontFamily: 'Georgia,serif', fontStyle: 'italic', fontSize: '1.4rem', color: '#ff385c', fontWeight: 700 }}>
              VENTSY
            </span>
          </Link>
        </div>

        {/* Avatar dropdown */}
        <div ref={avatarRef} style={{ position: 'relative' }}>
          <button
            onClick={() => setAvatar(!avatarOpen)}
            style={{
              width: 38, height: 38, borderRadius: '50%',
              background: '#ff385c', color: '#fff',
              border: 'none', cursor: 'pointer',
              fontSize: '1rem', fontWeight: 700,
            }}
          >
            {profile?.inicial ?? '?'}
          </button>

          {avatarOpen && (
            <div style={{
              position: 'absolute', top: 46, right: 0,
              background: '#fff', borderRadius: 12,
              boxShadow: '0 8px 32px rgba(0,0,0,.12)',
              border: '1px solid #f0f0f0',
              minWidth: 200, padding: '8px 0', zIndex: 200,
            }}>
              <div style={{ padding: '10px 16px', borderBottom: '1px solid #f0f0f0' }}>
                <div style={{ fontWeight: 700, fontSize: '.9rem' }}>{profile?.nome}</div>
                <div style={{ fontSize: '.78rem', color: '#999', marginTop: 2 }}>{profile?.email}</div>
              </div>
              {MENU_ITEMS.map(item => (
                <Link key={item.href} href={item.href}
                  style={{ display: 'block', padding: '9px 16px', fontSize: '.88rem', color: '#333', textDecoration: 'none' }}
                  onClick={() => setAvatar(false)}
                >
                  {item.label}
                </Link>
              ))}
              <button
                onClick={handleSair}
                style={{
                  width: '100%', textAlign: 'left', padding: '9px 16px',
                  border: 'none', background: 'none', cursor: 'pointer',
                  fontSize: '.88rem', color: '#ff385c',
                  borderTop: '1px solid #f0f0f0', marginTop: 4,
                }}
              >
                🚪 Sair
              </button>
            </div>
          )}
        </div>
      </header>

      {/* ── OVERLAY MOBILE ─────────────────────────────────────────────────── */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebar(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 149 }}
        />
      )}

      {/* ── CORPO ──────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', minHeight: 'calc(100vh - 60px)' }}>

        {/* ── SIDEBAR ────────────────────────────────────────────────────── */}
        <aside
          className="cl-sidebar"
          style={{ left: sidebarOpen ? 0 : undefined } as React.CSSProperties}
        >
          <div style={{ padding: '24px 20px 16px', borderBottom: '1px solid #f5f5f5' }}>
            <div style={{
              width: 48, height: 48, borderRadius: '50%',
              background: '#ff385c', color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 700, fontSize: '1.2rem', marginBottom: 10,
            }}>
              {profile?.inicial ?? '?'}
            </div>
            <div style={{ fontWeight: 700, fontSize: '.95rem', color: '#111' }}>{profile?.nome}</div>
            <div style={{
              marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 4,
              background: '#fff5f6', color: '#ff385c',
              border: '1px solid rgba(255,56,92,.2)',
              borderRadius: 20, padding: '3px 10px', fontSize: '.75rem', fontWeight: 600,
            }}>
              🎉 Cliente
            </div>
          </div>

          <nav style={{ padding: '12px 0', flex: 1 }}>
            <div style={{ padding: '10px 20px 4px', fontSize: '.68rem', fontWeight: 700, color: '#bbb', letterSpacing: '.08em', textTransform: 'uppercase' }}>
              Minha Área
            </div>
            {MENU_ITEMS.map(item => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebar(false)}
                className={`cl-menu-link${pathname === item.rota ? ' active' : ''}`}
              >
                {item.label}
              </Link>
            ))}
            <div style={{ borderTop: '1px solid #f5f5f5', margin: '12px 0' }} />
            <Link href="/busca" className="cl-menu-link">🔍 Explorar espaços</Link>
          </nav>
        </aside>

        {/* ── CONTEÚDO ───────────────────────────────────────────────────── */}
        <main style={{ flex: 1, minWidth: 0, overflowX: 'hidden' }}>
          {children}
        </main>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .cl-sidebar {
            left: ${sidebarOpen ? '0' : '-280px'} !important;
          }
        }
      `}</style>
    </div>
  )
}
