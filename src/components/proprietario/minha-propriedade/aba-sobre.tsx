"use client";

import { Input } from "@/components/ui/imput";
import { Select } from "@/components/ui/select";


export function AbaSobre() {
  return (
    <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm space-y-6">

      {/* TÍTULO */}
      <div>
        <h2 className="font-semibold text-lg">Descrição do Espaço</h2>

        <div className="flex items-center gap-2 text-sm text-yellow-600 mt-1">
          ⚠️
          <p>
            Não inclua dados de contato aqui. Use conteúdo exclusivo e original.
          </p>
        </div>
      </div>

      {/* TEXTAREA */}
      <div className="flex flex-col gap-1">
        <label className="text-sm text-gray-500">
          Apresentação completa do espaço
        </label>

        <textarea
          placeholder="Apresente seu espaço, explique seus diferenciais..."
          className="border border-gray-200 rounded-lg px-3 py-2 h-40 resize-none focus:outline-none focus:ring-2 focus:ring-pink-500"
        />
      </div>

      {/* BOTÕES */}
      <div className="flex justify-end gap-3 pt-4">

        <button className="px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-100 transition">
          Cancelar
        </button>

        <button className="px-5 py-2 bg-pink-500 text-white rounded-lg shadow-sm hover:bg-pink-600 transition active:scale-95">
          💾 Salvar Alterações
        </button>

      </div>

    </div>
  );
}