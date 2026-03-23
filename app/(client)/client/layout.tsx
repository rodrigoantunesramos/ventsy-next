'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

interface UserProfile {
  nome: string
  email: string
  inicial: string
}

const MENU_ITEMS = [
  { href: '/client',           label: '🏠 Início',            rota: '/client'           },
  { href: '/client/favoritos', label: '❤️ Favoritos',          rota: '/client/favoritos' },
  { href: '/client/conversas', label: '💬 Conversas',          rota: '/client/conversas' },
  { href: '/client/avaliacoes',label: '⭐ Minhas Avaliações',  rota: '/client/avaliacoes'},
]

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const [profile,     setProfile]  = useState<UserProfile | null>(null)
  const [sidebarOpen, setSidebar]  = useState(false)
  const [avatarOpen,  setAvatar]   = useState(false)
  const [loading,     setLoading]  = useState(true)

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
        const { data: perfil } = await supabase.from('usuarios').select('nome').eq('id', user.id).single()
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
      <div className="fixed inset-0 bg-white flex flex-col items-center justify-center z-[9999]">
        <span className="font-['Georgia,serif'] italic text-[2rem] text-[#ff385c] font-bold">VENTSY</span>
        <div className="flex gap-1.5 mt-4">
          {[0, 1, 2].map(i => (
            <span
              key={i}
              className="w-2 h-2 rounded-full bg-[#ff385c] animate-bounce-dot"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f7f7f8]">

      {/* ── HEADER ──────────────────────────────────────────────── */}
      <header className="sticky top-0 z-[100] bg-white border-b border-[#f0f0f0] flex items-center justify-between px-5 h-[60px]">
        <div className="flex items-center gap-3">
          {/* Hambúrguer (só mobile) */}
          <button
            onClick={() => setSidebar(!sidebarOpen)}
            aria-label="Menu"
            className="md:hidden flex flex-col gap-[5px] bg-transparent border-none cursor-pointer p-2"
          >
            <span className="block w-[22px] h-0.5 bg-gray-700 rounded-sm" />
            <span className="block w-[22px] h-0.5 bg-gray-700 rounded-sm" />
            <span className="block w-[22px] h-0.5 bg-gray-700 rounded-sm" />
          </button>
          <Link href="/">
            <span className="font-['Georgia,serif'] italic text-[1.4rem] text-[#ff385c] font-bold">VENTSY</span>
          </Link>
        </div>

        {/* Avatar dropdown */}
        <div className="relative" ref={avatarRef}>
          <button
            onClick={() => setAvatar(!avatarOpen)}
            className="w-[38px] h-[38px] rounded-full bg-[#ff385c] text-white border-none cursor-pointer text-base font-bold"
          >
            {profile?.inicial ?? '?'}
          </button>

          {avatarOpen && (
            <div className="absolute top-12 right-0 bg-white rounded-xl shadow-[0_8px_32px_rgba(0,0,0,.12)] border border-[#f0f0f0] min-w-[200px] py-2 z-[200]">
              <div className="px-4 py-2.5 border-b border-[#f0f0f0]">
                <div className="font-bold text-[.9rem]">{profile?.nome}</div>
                <div className="text-[.78rem] text-gray-400 mt-0.5">{profile?.email}</div>
              </div>
              {MENU_ITEMS.map(item => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="block px-4 py-2.5 text-[.88rem] text-gray-700 no-underline hover:bg-gray-50 transition-colors"
                  onClick={() => setAvatar(false)}
                >
                  {item.label}
                </Link>
              ))}
              <button
                onClick={handleSair}
                className="w-full text-left px-4 py-2.5 border-none bg-transparent cursor-pointer text-[.88rem] text-[#ff385c] border-t border-[#f0f0f0] mt-1 font-[inherit] hover:bg-gray-50 transition-colors"
              >
                🚪 Sair
              </button>
            </div>
          )}
        </div>
      </header>

      {/* ── OVERLAY MOBILE ────────────────────────────────────────── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-[149] md:hidden"
          onClick={() => setSidebar(false)}
        />
      )}

      {/* ── CORPO ─────────────────────────────────────────────────── */}
      <div className="flex min-h-[calc(100vh-60px)]">

        {/* ── SIDEBAR ─────────────────────────────────────────────── */}
        <aside
          className={`
            w-[260px] flex-shrink-0 bg-white border-r border-[#f0f0f0] flex flex-col
            sticky top-[60px] h-[calc(100vh-60px)] overflow-y-auto
            max-md:fixed max-md:z-[150] max-md:h-[calc(100vh-60px)] max-md:transition-[left_.28s_ease]
            ${sidebarOpen ? 'max-md:left-0' : 'max-md:-left-[280px]'}
          `}
        >
          {/* Perfil */}
          <div className="px-5 pt-6 pb-4 border-b border-[#f5f5f5]">
            <div className="w-12 h-12 rounded-full bg-[#ff385c] text-white flex items-center justify-center font-bold text-[1.2rem] mb-2.5">
              {profile?.inicial ?? '?'}
            </div>
            <div className="font-bold text-[.95rem] text-gray-900">{profile?.nome}</div>
            <div className="mt-2 inline-flex items-center gap-1 bg-[#fff5f6] text-[#ff385c] border border-[rgba(255,56,92,.2)] rounded-full px-2.5 py-[3px] text-[.75rem] font-semibold">
              🎉 Cliente
            </div>
          </div>

          {/* Nav */}
          <nav className="py-3 flex-1">
            <div className="px-5 pt-2.5 pb-1 text-[.68rem] font-bold text-gray-300 tracking-[.08em] uppercase">
              Minha Área
            </div>
            {MENU_ITEMS.map(item => {
              const isActive = pathname === item.rota
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setSidebar(false)}
                  className={`block px-5 py-[9px] text-[.88rem] no-underline border-l-[3px] transition-all
                    ${isActive
                      ? 'bg-[#fff5f6] text-[#ff385c] border-l-[#ff385c] font-semibold'
                      : 'text-gray-600 border-transparent hover:bg-[#fff5f6] hover:text-[#ff385c] hover:border-l-[#ff385c]'
                    }`}
                >
                  {item.label}
                </Link>
              )
            })}
            <div className="border-t border-[#f5f5f5] my-3" />
            <Link
              href="/busca"
              className="block px-5 py-[9px] text-[.88rem] text-gray-600 no-underline border-l-[3px] border-transparent hover:bg-[#fff5f6] hover:text-[#ff385c] hover:border-l-[#ff385c] transition-all"
            >
              🔍 Explorar espaços
            </Link>
          </nav>
        </aside>

        {/* ── CONTEÚDO ──────────────────────────────────────────────── */}
        <main className="flex-1 min-w-0 overflow-x-hidden">
          {children}
        </main>
      </div>
    </div>
  )
}
