"use client";

import { useState } from "react";
import { FotosPropriedade } from "@/components/proprietario/fotos-propriedade/fotosdoespaco";
import { FotosEventos } from "@/components/proprietario/fotos-propriedade/fotosdeeventos";

export default function FotosPage() {
  const [tab, setTab] = useState<"propriedade" | "eventos">("propriedade");

  return (
    <div className="space-y-6">

      {/* HEADER */}
      <div className="flex justify-between items-center">
        <h1 className="text-xl font-semibold">📸 Fotos do Espaço</h1>

        <div className="flex gap-2">
          <button className="bg-black text-white px-4 py-2 rounded-lg">
            💾 Salvar
          </button>

          <button className="bg-pink-500 text-white px-4 py-2 rounded-lg">
            + Nova seção
          </button>
        </div>
      </div>

      {/* ALERTAS */}
      <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg text-sm">
        ⚠️ Você precisa cadastrar sua propriedade antes de adicionar fotos.
      </div>

      {/* TABS */}
      <div className="flex gap-2">
        <button
          onClick={() => setTab("propriedade")}
          className={`px-4 py-2 rounded-lg ${
            tab === "propriedade"
              ? "bg-pink-500 text-white"
              : "bg-gray-100"
          }`}
        >
          📷 Fotos do Espaço
        </button>

        <button
          onClick={() => setTab("eventos")}
          className={`px-4 py-2 rounded-lg ${
            tab === "eventos"
              ? "bg-pink-500 text-white"
              : "bg-gray-100"
          }`}
        >
          🎉 Fotos de Eventos
        </button>
      </div>

      {/* CONTEÚDO */}
      {tab === "propriedade" && <FotosPropriedade />}
      {tab === "eventos" && <FotosEventos />}

    </div>
  );
}