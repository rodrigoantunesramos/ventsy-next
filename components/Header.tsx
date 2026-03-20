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
    <header className="header">
      <div className="header-left">
        <Link href="/" className="logo">VENTSY</Link>
      </div>

      <nav className="header-center">
        <SearchBar />
      </nav>

      <div className="header-right">
        {isLoggedIn
          ? <Link href="app/(dashboard)/dashboard/page.tsx" className="btn-login btn-dashboard-header">Dashboard</Link>
          : <Link href="/login" className="btn-login">Entrar</Link>
        }
        <div className="menu-hamburguer-container" ref={menuRef}>
          <button className="btn-menu" onClick={() => setMenuOpen(!menuOpen)}>☰ Menu</button>
          <div className={`extra-menu-dropdown${menuOpen ? ' open' : ''}`}>
            <Link href="/cadastro" onClick={() => setMenuOpen(false)}>✏️ Cadastre seu espaço</Link>
            <Link href="/planos" onClick={() => setMenuOpen(false)}>💳 Planos</Link>
            <Link href="/como-funciona" onClick={() => setMenuOpen(false)}>💡 Como Funciona</Link>
            <Link href="/fale-conosco" onClick={() => setMenuOpen(false)}>💬 Fale Conosco</Link>
          </div>
        </div>
      </div>
    </header>
  )
}
