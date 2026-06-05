"use client";

import { Input } from "@/components/ui/imput";
import { Select } from "@/components/ui/select";
import { useState } from "react";

export function AbaValores() {
  const [extras, setExtras] = useState([
    { nome: "", valor: "" }
  ]);

  function addExtra() {
    setExtras([...extras, { nome: "", valor: "" }]);
  }

  function updateExtra(index: number, field: string, value: string) {
    const updated = [...extras];
    updated[index][field as "nome" | "valor"] = value;
    setExtras(updated);
  }

  function removeExtra(index: number) {
    const updated = extras.filter((_, i) => i !== index);
    setExtras(updated);
  }

  return (
    <div className="space-y-6">

      {/* PREÇOS */}
      <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm space-y-4">

        <div>
          <h2 className="font-semibold text-lg">Preços de Referência</h2>
          <p className="text-sm text-gray-400">
            Valores orientativos exibidos no anúncio. Negociações pelo WhatsApp.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">

          {/* VALOR HORA */}
          <div className="flex flex-col gap-1">
            <label className="text-sm text-gray-500">Valor por Hora</label>
            <input
              placeholder="R$ 0,00"
              className="border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-pink-500 outline-none"
            />
          </div>

          {/* VALOR DIÁRIA */}
          <div className="flex flex-col gap-1">
            <label className="text-sm text-gray-500">
              Valor por Diária (dia completo)
            </label>
            <input
              placeholder="R$ 0,00"
              className="border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-pink-500 outline-none"
            />
          </div>

        </div>
      </div>

      {/* EXTRAS */}
      <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm space-y-4">

        <div>
          <h2 className="font-semibold text-lg">
            Custos Extras (opcionais para o cliente)
          </h2>
          <p className="text-sm text-gray-400">
            Serviços que o cliente pode contratar à parte.
          </p>
        </div>

        {/* LISTA */}
        <div className="space-y-3">
          {extras.map((item, index) => (
            <div key={index} className="flex gap-2 items-center">

              <input
                placeholder="Ex: Limpeza"
                value={item.nome}
                onChange={(e) =>
                  updateExtra(index, "nome", e.target.value)
                }
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2"
              />

              <input
                placeholder="R$ 0,00"
                value={item.valor}
                onChange={(e) =>
                  updateExtra(index, "valor", e.target.value)
                }
                className="w-32 border border-gray-200 rounded-lg px-3 py-2"
              />

              <button
                onClick={() => removeExtra(index)}
                className="text-red-500 hover:text-red-700"
              >
                ✕
              </button>

            </div>
          ))}
        </div>

        {/* ADD */}
        <button
          onClick={addExtra}
          className="text-sm px-3 py-2 border rounded-lg hover:bg-gray-100 transition"
        >
          + Adicionar item
        </button>

      </div>

      {/* BOTÕES */}
      <div className="flex justify-end gap-3">

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