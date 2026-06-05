"use client";

import { useState } from "react";

export function PropertyTypeSelect({ value, onChange }: any) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = PROPRIEDADE_TYPES.filter((item) =>
    item.nome.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="relative">
      {/* Trigger */}
      <div
        onClick={() => setOpen(!open)}
        className="w-full border p-3 rounded-lg cursor-pointer bg-white"
      >
        {value || "Selecione um tipo"}
      </div>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 mt-2 w-full bg-white border rounded-xl shadow-lg p-3 max-h-80 overflow-auto">
          
          {/* Busca */}
          <input
            placeholder="Buscar tipo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full mb-3 p-2 border rounded-lg outline-none"
          />

          {/* Lista */}
          <div className="grid grid-cols-2 gap-2">
            {filtered.map((item) => (
              <div
                key={item.nome}
                onClick={() => {
                  onChange(item.nome);
                  setOpen(false);
                }}
                className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-100 cursor-pointer"
              >
                <span className="text-lg">{item.emoji}</span>
                <span className="text-sm">{item.nome}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}