"use client";

import { ResumoCard } from "@/components/proprietario/financeiro/relatorios/resumo-card";
import { MetasCard } from "@/components/proprietario/financeiro/relatorios/metas-card";

export default function RelatoriosPage() {
  return (
    <div className="space-y-6">

      {/* HEADER */}
      <div className="flex justify-between items-center">

        <div>
          <h1 className="text-xl font-semibold">Relatórios</h1>
          <p className="text-sm text-gray-400">
            Análise financeira e desempenho do seu espaço
          </p>
        </div>

        {/* FUTURO */}
        <div className="flex gap-2">
          <button className="border px-4 py-2 rounded-lg text-sm hover:bg-gray-100">
            Filtrar período
          </button>

          <button className="bg-pink-500 text-white px-4 py-2 rounded-lg text-sm hover:bg-pink-600">
            Exportar
          </button>
        </div>

      </div>

      {/* CARDS */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">

        <ResumoCard />

        <MetasCard />

      </div>

    </div>
  );
}