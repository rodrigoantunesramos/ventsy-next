"use client";

import { useDiaryStore } from "src/components/proprietario/diario/useDiaryStore";

export function SearchBar({ value, onChange, onSearch }: any) {
  return (
    <div className="flex gap-2">
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Buscar por texto, nome, empresa..."
        className="w-full border p-2 rounded-lg"
      />

      <button
        onClick={onSearch}
        className="bg-blue-600 text-white px-4 rounded-lg hover:scale-105 transition"
      >
        🔍
      </button>
    </div>
  );
}