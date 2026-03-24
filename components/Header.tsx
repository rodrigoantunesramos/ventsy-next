'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import SearchBar from './SearchBar'

export default function Header() {
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
    <header className="w-full h-20 bg-white flex items-center px-[5%] shadow-sm fixed top-0 z-[9999] overflow-visible"> 
      {/* Logo */}
      <div className="flex-none flex items-center mr-4">
        <Link href="/" className="font-['Playfair_Display'] text-[1.6rem] font-black text-[#ff385c] no-underline flex items-center">
          VENTSY
        </Link>
      </div>

      {/* SearchBar centralizada */}
      <nav className="flex-[3] flex justify-center overflow-visible">
        <SearchBar />
      </nav>

      {/* Ações à direita */}
      <div className="flex-none flex items-center gap-3 ml-4">
        {isLoggedIn ? (
          <Link
            href="/dashboard"
            className="bg-[#0d0d0d] hover:bg-gray-800 text-white py-2 px-5 rounded-lg no-underline font-semibold text-sm transition-colors whitespace-nowrap inline-flex items-center"
          >
            Dashboard
          </Link>
        ) : (
          <Link
            href="/login"
            className="bg-[#ff385c] hover:bg-[#e0304f] text-white py-2 px-5 rounded-lg no-underline font-semibold text-sm transition-colors whitespace-nowrap inline-flex items-center"
          >
            Entrar
          </Link>
        )}

        {/* Menu hambúrguer */}
        <div className="relative" ref={menuRef}>
          <button
            className="bg-white border border-gray-200 rounded-full px-3.5 py-2 cursor-pointer text-sm flex items-center gap-1.5 hover:shadow-md transition-shadow font-[inherit]"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            ☰ Menu
          </button>

          {menuOpen && (
            <div className="absolute top-12 right-0 w-52 bg-white rounded-2xl shadow-2xl border border-gray-100 flex flex-col py-2 z-[2000]">
              <Link href="/cadastro" onClick={() => setMenuOpen(false)} className="px-5 py-3 no-underline text-gray-600 text-sm block hover:bg-gray-50 transition-colors"> 
                ✏️ Cadastre seu espaço
              </Link>
              <Link href="/planos" onClick={() => setMenuOpen(false)} className="px-5 py-3 no-underline text-gray-600 text-sm block hover:bg-gray-50 transition-colors">
                💳 Planos
              </Link>
              <Link href="/como-funciona" onClick={() => setMenuOpen(false)} className="px-5 py-3 no-underline text-gray-600 text-sm block hover:bg-gray-50 transition-colors">
                💡 Como Funciona
              </Link>
              <Link href="/fale-conosco" onClick={() => setMenuOpen(false)} className="px-5 py-3 no-underline text-gray-600 text-sm block hover:bg-gray-50 transition-colors">
                💬 Fale Conosco
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
