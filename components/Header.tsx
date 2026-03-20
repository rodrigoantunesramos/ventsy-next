"use client";

import Link from "next/link";

interface HeaderProps {
  isLoggedIn: boolean;
  menuOpen: boolean;
  setMenuOpen: (open: boolean) => void;
  menuRef: React.RefObject<HTMLDivElement>;
}

export default function Header({
  isLoggedIn,
  menuOpen,
  setMenuOpen,
  menuRef,
}: HeaderProps) {
  return (
    <div className="header-right">
      
      {isLoggedIn ? (
        <Link
          href="/dashboard"
          className="btn-login btn-dashboard-header"
        >
          Dashboard
        </Link>
      ) : (
        <Link href="/login" className="btn-login">
          Entrar
        </Link>
      )}

      <div className="menu-hamburguer-container" ref={menuRef}>
        
        <button
          className="btn-menu"
          onClick={() => setMenuOpen(!menuOpen)}
        >
          ☰ Menu
        </button>

        <div className={`extra-menu-dropdown${menuOpen ? " open" : ""}`}>
          
          <Link href="/cadastro" onClick={() => setMenuOpen(false)}>
            ✏️ Cadastre seu espaço
          </Link>

          <Link href="/planos" onClick={() => setMenuOpen(false)}>
            💳 Planos
          </Link>

          <Link href="/como-funciona" onClick={() => setMenuOpen(false)}>
            💡 Como Funciona
          </Link>

          <Link href="/fale-conosco" onClick={() => setMenuOpen(false)}>
            💬 Fale Conosco
          </Link>

        </div>
      </div>
    </div>
  );
}