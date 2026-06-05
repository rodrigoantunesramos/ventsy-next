"use client";

import { useState } from "react";

export function ModalEvento({ dia, onClose, onSave }: any) {
  const [nome, setNome] = useState("");
  const [cliente, setCliente] = useState("");
  const [obs, setObs] = useState("");

  function handleSave() {
    onSave(dia, {
      nome,
      cliente,
      obs,
    });
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
      onClick={onClose} // 👈 clicar fora fecha
    >

      {/* MODAL */}
      <div
        className="bg-white p-6 rounded-xl w-[400px] space-y-4"
        onClick={(e) => e.stopPropagation()} // 👈 impede fechar ao clicar dentro
      >

        <h2 className="font-semibold text-lg">
          📅 Evento - Dia {dia}
        </h2>

        <input
          placeholder="Nome do evento"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          className="w-full border p-2 rounded"
        />

        <input
          placeholder="Cliente"
          value={cliente}
          onChange={(e) => setCliente(e.target.value)}
          className="w-full border p-2 rounded"
        />

        <textarea
          placeholder="Observações"
          value={obs}
          onChange={(e) => setObs(e.target.value)}
          className="w-full border p-2 rounded"
        />

        <div className="flex justify-end gap-2">

          <button
            onClick={onClose}
            className="px-3 py-2 border rounded"
          >
            Cancelar
          </button>

          <button
            onClick={handleSave}
            className="bg-pink-500 text-white px-4 py-2 rounded"
          >
            Salvar
          </button>

        </div>

      </div>
    </div>
  );
}