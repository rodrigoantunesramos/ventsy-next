'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import SearchBar from './SearchBar'
import { useT } from './i18n/I18nProvider'
import LocaleSwitcher from './i18n/LocaleSwitcher'

export default function Header() {
  const { dict, lhref } = useT()
  const router = useRouter()
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsLoggedIn(!!session)
    })
    // Reage a login/logout (inclusive em outra aba) sem precisar recarregar.
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setIsLoggedIn(!!session)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [])

  const handleSair = async () => {
    setMenuOpen(false)
    await supabase.auth.signOut()
    setIsLoggedIn(false)
    router.push(lhref('/'))
    router.refresh()
  }

  // Links públicos — reaproveitados no menu do visitante e no menu de conta.
  const linksPublicos = (
    <>
      <Link href={lhref('/anunciar')} onClick={() => setMenuOpen(false)} className="px-5 py-3 no-underline text-gray-600 text-sm block hover:bg-gray-50 transition-colors">
        ✏️ {dict.header.anuncieSeuEspaco}
      </Link>
      <Link href={lhref('/planos')} onClick={() => setMenuOpen(false)} className="px-5 py-3 no-underline text-gray-600 text-sm block hover:bg-gray-50 transition-colors">
        💳 {dict.header.planos}
      </Link>
      <Link href={lhref('/como-funciona')} onClick={() => setMenuOpen(false)} className="px-5 py-3 no-underline text-gray-600 text-sm block hover:bg-gray-50 transition-colors">
        💡 {dict.header.comoFunciona}
      </Link>
      <Link href={lhref('/fale-conosco')} onClick={() => setMenuOpen(false)} className="px-5 py-3 no-underline text-gray-600 text-sm block hover:bg-gray-50 transition-colors">
        💬 {dict.header.faleConosco}
      </Link>
    </>
  )

  return (
    <header className="w-full h-20 bg-white flex items-center px-[5%] shadow-card fixed top-0 z-[9999] overflow-visible">
      {/* Logo */}
      <div className="flex-none flex items-center mr-4">
        <Link
          href={lhref('/')}
          className="font-display text-[1.6rem] font-black tracking-tight text-brand no-underline flex items-center"
        >
          VENTSY
        </Link>
      </div>

      {/* SearchBar centralizada */}
      <nav className="flex-[3] flex justify-center overflow-visible min-w-0">
        <SearchBar />
      </nav>

      {/* Ações à direita */}
      <div className="flex-none flex items-center gap-3 ml-4">
        <div className="hidden sm:block"><LocaleSwitcher /></div>

        {isLoggedIn ? (
          /* Logado: um único menu de conta (troca de painel + atalhos + sair).
             Absorve o antigo botão "Painel" e o menu "☰" — sem botão separado. */
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              aria-haspopup="true"
              aria-expanded={menuOpen}
              aria-label={dict.common.minhaConta}
              onClick={() => setMenuOpen(!menuOpen)}
              className="bg-white border border-gray-200 rounded-full pl-3.5 pr-1.5 py-1 cursor-pointer text-sm flex items-center gap-2 hover:shadow-md transition-shadow font-[inherit]"
            >
              <span className="hidden sm:inline font-semibold text-gray-700">{dict.common.minhaConta}</span>
              <span className="w-8 h-8 rounded-full bg-ink text-white flex items-center justify-center" aria-hidden="true">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </span>
            </button>

            {menuOpen && (
              <div className="absolute top-12 right-0 w-64 bg-white rounded-2xl shadow-2xl border border-gray-100 flex flex-col py-2 z-[2000]">
                {/* Troca de painel — o coração do recurso */}
                <div className="px-5 pb-1 pt-1 text-[0.68rem] font-bold uppercase tracking-[0.08em] text-gray-300">
                  {dict.common.painel}
                </div>
                <Link href="/painel" onClick={() => setMenuOpen(false)} className="px-5 py-3 no-underline text-gray-800 text-sm font-semibold flex items-center gap-2.5 hover:bg-gray-50 transition-colors">
                  🏢 {dict.common.painelProprietario}
                </Link>
                <Link href="/client" onClick={() => setMenuOpen(false)} className="px-5 py-3 no-underline text-gray-800 text-sm font-semibold flex items-center gap-2.5 hover:bg-gray-50 transition-colors">
                  🎉 {dict.common.minhaArea}
                </Link>
                <div className="my-1.5 border-t border-gray-100" />
                {linksPublicos}
                <div className="my-1.5 border-t border-gray-100" />
                <button
                  type="button"
                  onClick={handleSair}
                  className="text-left px-5 py-3 text-sm text-brand font-semibold bg-transparent border-none cursor-pointer hover:bg-gray-50 transition-colors font-[inherit]"
                >
                  🚪 {dict.common.sair}
                </button>
              </div>
            )}
          </div>
        ) : (
          /* Visitante: Entrar + menu "☰" com os links públicos (inalterado). */
          <>
            <Link
              href={lhref('/login')}
              className="bg-brand hover:bg-brand-600 text-white py-2 px-5 rounded-lg no-underline font-semibold text-sm transition-colors whitespace-nowrap inline-flex items-center"
            >
              {dict.common.entrar}
            </Link>

            <div className="relative" ref={menuRef}>
              <button
                type="button"
                aria-haspopup="true"
                aria-expanded={menuOpen}
                aria-label={dict.common.abrirMenu}
                className="bg-white border border-gray-200 rounded-full px-3.5 py-2 cursor-pointer text-sm flex items-center gap-1.5 hover:shadow-md transition-shadow font-[inherit]"
                onClick={() => setMenuOpen(!menuOpen)}
              >
                <span aria-hidden="true">☰</span> <span className="hidden sm:inline">{dict.common.menu}</span>
              </button>

              {menuOpen && (
                <div className="absolute top-12 right-0 w-52 bg-white rounded-2xl shadow-2xl border border-gray-100 flex flex-col py-2 z-[2000]">
                  {linksPublicos}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </header>
  )
}
