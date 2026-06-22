'use client'

// Shell premium da Área do Cliente (contratante). Tokens do projeto (tema-aware),
// navegação agrupada com ícones, troca de tema, central de notificações e menu
// de avatar. A navegação/identidade vivem em ./_nav.

import { useEffect, useRef, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { usuarioTemPropriedade } from '@/lib/perfis'
import NotificationBell from '@/components/NotificationBell'
import ThemeToggle from '@/components/ThemeToggle'
import { ToastProvider } from '@/components/Toast'
import { NAV, Icon } from './_nav'

interface UserProfile { nome: string; email: string; inicial: string }

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [sidebarOpen, setSidebar] = useState(false)
  const [avatarOpen, setAvatar] = useState(false)
  const [loading, setLoading] = useState(true)
  const [isProprietario, setIsProprietario] = useState(false)

  const router = useRouter()
  const pathname = usePathname()
  const avatarRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }
      const user = session.user
      let nome = user.email ?? ''
      try {
        const { data: perfil } = await supabase.from('usuarios').select('nome').eq('id', user.id).single()
        if (perfil?.nome) nome = perfil.nome
      } catch { /* silencioso */ }
      const inicial = (nome.split(' ')[0]?.[0] ?? '?').toUpperCase()
      setProfile({ nome, email: user.email ?? '', inicial })
      setLoading(false)
      usuarioTemPropriedade(user.id).then(setIsProprietario)
    })()
  }, [router])

  useEffect(() => {
    const h = (e: MouseEvent) => { if (!avatarRef.current?.contains(e.target as Node)) setAvatar(false) }
    document.addEventListener('click', h)
    return () => document.removeEventListener('click', h)
  }, [])

  // Fecha a sidebar mobile ao navegar.
  useEffect(() => { setSidebar(false) }, [pathname])

  const handleSair = async () => { await supabase.auth.signOut(); router.push('/login') }

  const trocaPainel = isProprietario
    ? { href: '/painel', label: 'Painel do proprietário', icon: 'building' as const }
    : { href: '/anunciar', label: 'Anunciar meu espaço', icon: 'building' as const }

  const isActive = (href: string) =>
    href === '/client' ? pathname === '/client' : pathname === href || pathname.startsWith(href + '/')

  if (loading) {
    return (
      <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-canvas">
        <span className="font-display text-[2rem] font-bold italic text-brand">VENTSY</span>
        <div className="mt-4 flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <span key={i} className="h-2 w-2 animate-bounce rounded-full bg-brand" style={{ animationDelay: `${i * 0.15}s` }} />
          ))}
        </div>
      </div>
    )
  }

  return (
    <ToastProvider>
      <div className="min-h-screen bg-canvas">
        {/* ── HEADER ───────────────────────────────────────────────────────── */}
        <header className="sticky top-0 z-[100] flex h-[60px] items-center justify-between border-b border-line bg-surface px-4 sm:px-5">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebar(!sidebarOpen)} aria-label="Menu" className="flex flex-col gap-[5px] p-2 md:hidden">
              <span className="block h-0.5 w-[22px] rounded-sm bg-ink-soft" />
              <span className="block h-0.5 w-[22px] rounded-sm bg-ink-soft" />
              <span className="block h-0.5 w-[22px] rounded-sm bg-ink-soft" />
            </button>
            <Link href="/"><span className="font-display text-[1.4rem] font-bold italic text-brand">VENTSY</span></Link>
          </div>

          <div className="flex items-center gap-1">
            <ThemeToggle />
            <NotificationBell verTodasHref="/client/notificacoes" />
            <div className="relative" ref={avatarRef}>
              <button onClick={() => setAvatar(!avatarOpen)} className="flex h-[38px] w-[38px] items-center justify-center rounded-full bg-brand text-base font-bold text-white">
                {profile?.inicial ?? '?'}
              </button>
              {avatarOpen && (
                <div className="absolute right-0 top-12 z-[200] min-w-[224px] rounded-2xl border border-line bg-surface py-2 shadow-pop">
                  <div className="border-b border-line px-4 py-2.5">
                    <div className="text-[.9rem] font-bold text-ink">{profile?.nome}</div>
                    <div className="mt-0.5 truncate text-[.78rem] text-ink-muted">{profile?.email}</div>
                  </div>
                  {[
                    { href: '/client/perfil', label: 'Meu perfil', icon: 'user' as const },
                    { href: '/client/carteira', label: 'Carteira', icon: 'wallet' as const },
                    { href: '/client/indique', label: 'Indique e ganhe', icon: 'gift' as const },
                  ].map((i) => (
                    <Link key={i.href} href={i.href} onClick={() => setAvatar(false)} className="flex items-center gap-2.5 px-4 py-2.5 text-[.86rem] text-ink-soft transition hover:bg-brand-50 hover:text-brand">
                      <Icon name={i.icon} size={16} />{i.label}
                    </Link>
                  ))}
                  <Link href={trocaPainel.href} onClick={() => setAvatar(false)} className="flex items-center gap-2.5 border-t border-line px-4 py-2.5 text-[.86rem] font-semibold text-ink transition hover:bg-brand-50 hover:text-brand">
                    <Icon name={trocaPainel.icon} size={16} />{trocaPainel.label}
                  </Link>
                  <button onClick={handleSair} className="flex w-full items-center gap-2.5 border-t border-line px-4 py-2.5 text-left text-[.86rem] text-brand transition hover:bg-brand-50">
                    <Icon name="logout" size={16} />Sair
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* ── OVERLAY MOBILE ───────────────────────────────────────────────── */}
        {sidebarOpen && <div className="fixed inset-0 z-[149] bg-black/40 md:hidden" onClick={() => setSidebar(false)} />}

        <div className="flex min-h-[calc(100vh-60px)]">
          {/* ── SIDEBAR ─────────────────────────────────────────────────────── */}
          <aside className={`flex w-[264px] flex-shrink-0 flex-col overflow-y-auto border-r border-line bg-surface sticky top-[60px] h-[calc(100vh-60px)]
            max-md:fixed max-md:z-[150] max-md:transition-[left] max-md:duration-300 ${sidebarOpen ? 'max-md:left-0' : 'max-md:-left-[300px]'}`}>
            {/* Perfil */}
            <div className="border-b border-line px-5 pb-4 pt-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand text-[1.2rem] font-bold text-white">{profile?.inicial ?? '?'}</div>
              <div className="mt-2.5 text-[.95rem] font-bold text-ink">{profile?.nome}</div>
              <div className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-brand/20 bg-brand-50 px-2.5 py-[3px] text-[.72rem] font-semibold text-brand">
                <Icon name="sparkle" size={12} /> Cliente Ventsy
              </div>
            </div>

            {/* Navegação agrupada */}
            <nav className="flex-1 py-3">
              {NAV.map((grupo) => (
                <div key={grupo.group} className="mb-1">
                  <div className="px-5 pb-1 pt-3 text-[.66rem] font-bold uppercase tracking-[.09em] text-ink-muted/70">{grupo.group}</div>
                  {grupo.items.map((item) => {
                    const active = item.href.startsWith('/client') && isActive(item.href)
                    return (
                      <Link key={item.href} href={item.href}
                        className={`flex items-center gap-3 border-l-[3px] px-5 py-[8px] text-[.86rem] transition-all ${active ? 'border-brand bg-brand-50 font-semibold text-brand' : 'border-transparent text-ink-soft hover:bg-brand-50 hover:text-brand'}`}>
                        <Icon name={item.icon} size={17} />{item.label}
                      </Link>
                    )
                  })}
                </div>
              ))}
              <div className="my-3 border-t border-line" />
              <Link href={trocaPainel.href} className="flex items-center gap-3 border-l-[3px] border-transparent px-5 py-[8px] text-[.86rem] font-semibold text-ink-soft transition-all hover:bg-brand-50 hover:text-brand">
                <Icon name={trocaPainel.icon} size={17} />{trocaPainel.label}
              </Link>
            </nav>
          </aside>

          {/* ── CONTEÚDO ────────────────────────────────────────────────────── */}
          <main className="min-w-0 flex-1 overflow-x-hidden p-4 sm:p-6 lg:p-8">
            <div className="mx-auto max-w-6xl animate-fade-up">{children}</div>
          </main>
        </div>
      </div>
    </ToastProvider>
  )
}
