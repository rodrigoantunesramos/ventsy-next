"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsLoggedIn(!!session);
    });
  }, []);

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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
