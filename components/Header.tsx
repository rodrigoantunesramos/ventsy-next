'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import SearchBar from './SearchBar'
import { useT } from './i18n/I18nProvider'
import LocaleSwitcher from './i18n/LocaleSwitcher'

export default function Header() {
  const { dict, lhref } = useT()
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsLoggedIn(!!session)
    })
  }, [])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [])

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
          <Link
            href="/painel"
            className="bg-ink hover:bg-ink-soft text-white py-2 px-5 rounded-lg no-underline font-semibold text-sm transition-colors whitespace-nowrap inline-flex items-center"
          >
            {dict.common.painel}
          </Link>
        ) : (
          <Link
            href={lhref('/login')}
            className="bg-brand hover:bg-brand-600 text-white py-2 px-5 rounded-lg no-underline font-semibold text-sm transition-colors whitespace-nowrap inline-flex items-center"
          >
            {dict.common.entrar}
          </Link>
        )}

        {/* Menu hambúrguer */}
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
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
