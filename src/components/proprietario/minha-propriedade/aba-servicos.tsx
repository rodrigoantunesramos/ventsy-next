"use client";

import { Input } from "@/components/ui/imput";
import { Select } from "@/components/ui/select";
import { useState } from "react";

const servicosBase = [
  "Climatizado",
  "Estacionamento",
  "Segurança",
  "Espaço Aberto",
  "Cozinha Equipada",
  "Gerador",
  "Piscina",
  "Wi-Fi",
  "Acessibilidade",
  "Hospedagem",
  "Palco / Som",
  "Decoração",
  "Bar / Choperia",
  "Churrasqueira",
  "Playground",
  "Quadra Esportiva",
  "Camarim",
  "Projetor / Telão",
  "Sauna",
  "Heliponto",

  // extras inteligentes
  "Ar Condicionado Central",
  "Iluminação Profissional",
  "Som Ambiente",
  "Isolamento Acústico",
  "Elevador",
  "Gerador Backup",
];

const servicosExtras = [
  "Buffet Completo",
  "Garçons / Staff",
  "Equipe de Segurança",
  "Bar Open Bar",
  "Mesas/Cadeiras",
  "Decoração Completa",
  "Floricultura",
  "DJ / Sonorização",
  "Foto e Vídeo",
  "Cerimonialista",
  "Valet",
  "Limpeza Pós-Evento",
  "Iluminação Especial",
  "Tendas",
  "Transfer",
  "Hospedagem de Convidados",

  // extras avançados
  "Assessoria de Evento",
  "Produção Completa",
  "Banda ao Vivo",
  "Show / Atração",
  "Segurança VIP",
  "Recepcionistas",
  "Catering Gourmet",
  "Bartender",
  "Animadores",
  "Brinquedos Infantis",
  "Painel LED",
  "Streaming ao Vivo",
  "Tradução Simultânea",
  "Gerador Extra",
];

export function AbaServicos() {
  const [selecionadosBase, setSelecionadosBase] = useState<string[]>([]);
  const [selecionadosExtras, setSelecionadosExtras] = useState<string[]>([]);

  function toggle(item: string, tipo: "base" | "extra") {
    if (tipo === "base") {
      setSelecionadosBase((prev) =>
        prev.includes(item)
          ? prev.filter((i) => i !== item)
          : [...prev, item]
      );
    } else {
      setSelecionadosExtras((prev) =>
        prev.includes(item)
          ? prev.filter((i) => i !== item)
          : [...prev, item]
      );
    }
  }

  function renderGrid(lista: string[], selecionados: string[], tipo: "base" | "extra") {
    return (
      <div className="grid grid-cols-3 gap-3">
        {lista.map((item) => {
          const ativo = selecionados.includes(item);

          return (
            <button
              key={item}
              onClick={() => toggle(item, tipo)}
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
    );
  }

  return (
    <div className="space-y-6">

      {/* BASE */}
      <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm space-y-4">
        <div>
          <h2 className="font-semibold text-lg">
            Serviços e Amenidades Disponíveis
          </h2>
          <p className="text-sm text-gray-400">
            Marque tudo que seu espaço oferece.
          </p>
        </div>

        {renderGrid(servicosBase, selecionadosBase, "base")}
      </div>

      {/* EXTRAS */}
      <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm space-y-4">
        <div>
          <h2 className="font-semibold text-lg">
            Serviços Extras que Você Pode Oferecer
          </h2>
          <p className="text-sm text-gray-400">
            Serviços adicionais disponíveis (podem ter custo extra).
          </p>
        </div>

        {renderGrid(servicosExtras, selecionadosExtras, "extra")}
      </div>

      {/* BOTÕES */}
      <div className="flex justify-end gap-3">

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