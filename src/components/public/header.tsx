"use client";

import { useState } from "react";
import { SearchBar } from "src/components/public/SearchBar";

export function Header() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 bg-white shadow-sm h-16 flex items-center justify-between px-6">
      
      {/* Logo */}
      <div className="text-xl font-bold">
        Ventsy
      </div>

      {/* Busca */}
      <div className="w-1/2 hidden md:block">
        <SearchBar />
      </div>

      {/* Menu */}
      <div className="relative">
        <div
          onClick={() => setOpen(!open)}
          className="cursor-pointer flex items-center gap-2"
        >
          <div className="w-8 h-8 bg-gray-300 rounded-full" />
        </div>

        {open && (
          <div className="absolute right-0 mt-2 w-48 bg-white shadow-md rounded-xl p-2">
            <button className="w-full text-left px-4 py-2 hover:bg-gray-100 rounded-lg">
              Perfil
            </button>
            <button className="w-full text-left px-4 py-2 hover:bg-gray-100 rounded-lg">
              Minhas reservas
            </button>
            <button className="w-full text-left px-4 py-2 hover:bg-gray-100 rounded-lg text-red-500">
              Sair
            </button>
          </div>
        )}
      </div>
    </header>
  );
}