"use client";

import { useState } from "react";

export function SecaoFotos({ titulo }: { titulo: string }) {
  const [fotos, setFotos] = useState<any[]>([]);

  return (
    <div className="bg-white p-4 rounded-xl border border-gray-100 space-y-4">

      <div className="flex justify-between">
        <h3 className="font-medium">{titulo}</h3>
        <span className="text-xs text-gray-400">{fotos.length} fotos</span>
      </div>

      {/* UPLOAD */}
      <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center">
        📷 Arraste ou selecione fotos
      </div>

      {/* LISTA */}
      <div className="grid grid-cols-4 gap-3">
        {fotos.map((foto, index) => (
          <div key={index} className="space-y-1">

            <div className="bg-gray-100 h-24 rounded-lg" />

            <input
              placeholder="Nome da foto"
              className="w-full text-xs border rounded px-2 py-1"
            />

          </div>
        ))}
      </div>

    </div>
  );
}