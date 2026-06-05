"use client";

import { Input } from "@/components/ui/imput";
import { Select } from "@/components/ui/select";
import { useState } from "react";


const categorias = [
  {
    nome: "Sociais & Celebrações",
    itens: [
      "Casamento",
      "Noivado",
      "Aniversário",
      "Festa Infantil",
      "Chá de Bebê",
      "Chá Revelação",
      "Debutante",
    ],
  },
  {
    nome: "Corporativo",
    itens: [
      "Reunião",
      "Treinamento",
      "Conferência",
      "Seminário",
      "Workshop",
      "Palestra",
      "Congresso",
      "Hackathon",
      "Lançamento",
      "Pop-up Store",
      "Happy Hour",
      "Confraternização",
      "Field Day",
    ],
  },
  {
    nome: "Acadêmico",
    itens: [
      "Formatura",
      "Colação de Grau",
      "Apresentações",
    ],
  },
  {
    nome: "Religioso",
    itens: [
      "Batizado",
      "Encontro Religioso",
      "Vigília",
      "Retiro",
    ],
  },
  {
    nome: "Entretenimento",
    itens: [
      "Show",
      "Festival",
      "Teatro",
      "Exposição",
      "Vernissage",
    ],
  },
  {
    nome: "Esportivo & Outdoor",
    itens: [
      "Torneios",
      "Dia de Campo",
      "Acampamento",
      "Motocross",
      "Radical",
      "Futebol",
      "Pesca",
    ],
  },
];

export function AbaEventos() {
  const [selecionados, setSelecionados] = useState<string[]>([]);

  function toggleItem(item: string) {
    setSelecionados((prev) =>
      prev.includes(item)
        ? prev.filter((i) => i !== item)
        : [...prev, item]
    );
  }

  return (
    <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm space-y-6">

      {/* HEADER */}
      <div>
        <h2 className="font-semibold text-lg">
          Quais eventos seu espaço recebe?
        </h2>
        <p className="text-sm text-gray-400">
          Selecione todos os tipos de celebrações permitidos no seu local.
        </p>
      </div>

      {/* LISTA */}
      <div className="space-y-6">

        {categorias.map((categoria) => (
          <div key={categoria.nome}>
            <h3 className="text-sm font-semibold text-gray-500 mb-2">
              {categoria.nome}
            </h3>

            <div className="grid grid-cols-3 gap-3">
              {categoria.itens.map((item) => {
                const ativo = selecionados.includes(item);

                return (
                  <button
                    key={item}
                    onClick={() => toggleItem(item)}
                    className={`p-3 rounded-xl border text-sm transition ${
                      ativo
                        ? "bg-pink-500 text-white border-pink-500"
                        : "bg-gray-50 hover:bg-gray-100"
                    }`}
                  >
                    {item}
                  </button>
                );
              })}
            </div>
          </div>
        ))}

      </div>

      {/* BOTÕES */}
      <div className="flex justify-end gap-3 pt-4">

        <button className="px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-100">
          Cancelar
        </button>

        <button className="px-5 py-2 bg-pink-500 text-white rounded-lg shadow-sm hover:bg-pink-600">
          💾 Salvar Alterações
        </button>

      </div>

    </div>
  );
}