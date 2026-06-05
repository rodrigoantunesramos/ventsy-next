"use client";

import { Input } from "@/components/ui/imput";
import { Select } from "@/components/ui/select";
import { useState } from "react";


const estados = [
  "AC","AL","AP","AM","BA","CE","DF",
  "ES","GO","MA","MT","MS","MG","PA",
  "PB","PR","PE","PI","RJ","RN","RS",
  "RO","RR","SC","SP","SE","TO"
];

export function AbaEndereco() {
  const [estadoSelecionado, setEstadoSelecionado] = useState("");

  return (
    <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm space-y-6">

      {/* HEADER */}
      <div>
        <h2 className="font-semibold text-lg">Localização do Espaço</h2>
        <p className="text-sm text-gray-400">
          O endereço completo ajuda os clientes a traçarem a rota.
        </p>
      </div>

      {/* GRID */}
      <div className="grid grid-cols-2 gap-4">

        {/* CEP */}
        <Input label="CEP" placeholder="00000-000" />

        {/* LOGRADOURO */}
        <Input label="Logradouro (Rua / Avenida)" placeholder="Ex: Rua das Flores" />

        {/* NÚMERO */}
        <Input label="Número" placeholder="123" />

        {/* COMPLEMENTO */}
        <Input label="Complemento" placeholder="Sala, Bloco..." />

        {/* BAIRRO */}
        <Input label="Bairro" placeholder="Ex: Centro" />

        {/* CIDADE */}
        <Input label="Cidade" placeholder="Ex: São Paulo" />

      </div>

      {/* ESTADO */}
      <div className="space-y-2">
        <label className="text-sm text-gray-500">Estado</label>

        <div className="grid grid-cols-7 gap-2">
          {estados.map((uf) => (
            <button
              key={uf}
              onClick={() => setEstadoSelecionado(uf)}
              className={`py-2 rounded-lg border text-sm transition ${
                estadoSelecionado === uf
                  ? "bg-pink-500 text-white border-pink-500"
                  : "bg-gray-50 hover:bg-gray-100"
              }`}
            >
              {uf}
            </button>
          ))}
        </div>
      </div>

      {/* MAPA */}
      <div className="pt-4">
        <button className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded-lg hover:opacity-90 transition">
          📍 Atualizar Mapa
        </button>
      </div>

    </div>
  );
}