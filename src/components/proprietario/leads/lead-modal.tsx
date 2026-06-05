"use client";

import { X } from "lucide-react";
import { useApp } from "@/context/app-context";

export function LeadModal({ lead, onClose }: any) {
  if (!lead) return null;

  const { addEvento } = useApp();

  function handleConvert() {
    const novoEvento = {
      nome: lead.evento,
      cliente: lead.cliente,
      data: lead.data,
      local: "A definir",
      valor: 0,
      status: "confirmado",
    };

    addEvento(novoEvento);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">

      {/* OVERLAY */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />

      {/* MODAL */}
      <div className="relative bg-white w-full max-w-2xl rounded-xl shadow-lg p-6 z-10">

        {/* HEADER */}
        <div className="flex justify-between items-start mb-4">
          <div>
            <h2 className="text-lg font-semibold">{lead.evento}</h2>
            <p className="text-sm text-gray-400">{lead.cliente}</p>
          </div>

          <button onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* GRID */}
        <div className="grid grid-cols-2 gap-4 text-sm">

          <div>
            <p className="text-gray-400">Data do evento</p>
            <p className="font-medium">{lead.data}</p>
          </div>

          <div>
            <p className="text-gray-400">Tipo</p>
            <p className="font-medium">{lead.tipo || "Casamento"}</p>
          </div>

          <div>
            <p className="text-gray-400">Local</p>
            <p className="font-medium">{lead.local || "Salão Principal"}</p>
          </div>

          <div>
            <p className="text-gray-400">Pessoas</p>
            <p className="font-medium">{lead.pessoas || 100}</p>
          </div>

        </div>

        {/* OBSERVAÇÕES */}
        <div className="mt-6">
          <p className="text-gray-400 text-sm mb-1">Observações</p>

          <textarea
            placeholder="Adicionar observações..."
            className="w-full border rounded-lg p-3 text-sm"
          />
        </div>

        {/* AÇÕES */}
        <div className="flex justify-end gap-2 mt-6">

          <button className="border px-4 py-2 rounded-lg text-sm">
            Marcar como perdido
          </button>

          <button
            onClick={handleConvert}
            className="bg-pink-500 text-white px-4 py-2 rounded-lg text-sm"
          >
            Converter em evento
          </button>

        </div>
      </div>
    </div>
  );
}