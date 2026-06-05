"use client";

import { Input } from "@/components/ui/imput";
import { Select } from "@/components/ui/select";
import { useState } from "react";
import { useMemo } from "react";

export function AbaForca() {

  // 🔥 MOCK (depois vem do banco)
  const dados = {
    nome: true,
    descricao: true,
    endereco: true,
    fotos: false,
    preco: true,
    eventos: true,
    faq: false,
    servicos: true,
  };

  const checklist = [
    { label: "Nome da propriedade", ok: dados.nome, peso: 10 },
    { label: "Descrição completa", ok: dados.descricao, peso: 15 },
    { label: "Endereço preenchido", ok: dados.endereco, peso: 10 },
    { label: "Adicionar pelo menos 5 fotos", ok: dados.fotos, peso: 20 },
    { label: "Configurar preços", ok: dados.preco, peso: 10 },
    { label: "Selecionar tipos de eventos", ok: dados.eventos, peso: 10 },
    { label: "Adicionar FAQ", ok: dados.faq, peso: 10 },
    { label: "Selecionar serviços", ok: dados.servicos, peso: 15 },
  ];

  const progresso = useMemo(() => {
    const total = checklist.reduce((acc, item) => acc + item.peso, 0);
    const completo = checklist
      .filter((item) => item.ok)
      .reduce((acc, item) => acc + item.peso, 0);

    return Math.round((completo / total) * 100);
  }, [checklist]);

  return (
    <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm space-y-6">

      {/* HEADER */}
      <div>
        <h2 className="font-semibold text-lg flex items-center gap-2">
          🧠 Força do seu anúncio
        </h2>
        <p className="text-sm text-gray-400">
          Complete as informações para aumentar sua visibilidade e conversão.
        </p>
      </div>

      {/* BARRA */}
      <div className="space-y-2">
        <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-pink-500 transition-all"
            style={{ width: `${progresso}%` }}
          />
        </div>

        <p className="text-sm text-gray-500">
          {progresso}% completo
        </p>
      </div>

      {/* CHECKLIST */}
      <div className="space-y-3">

        {checklist.map((item, index) => (
          <div
            key={index}
            className={`flex items-center justify-between p-3 rounded-lg border ${
              item.ok
                ? "bg-green-50 border-green-200"
                : "bg-gray-50 border-gray-200"
            }`}
          >
            <span className="text-sm">{item.label}</span>

            <span className="text-sm font-medium">
              {item.ok ? "✔️" : "⬜"}
            </span>
          </div>
        ))}

      </div>

      {/* DICA */}
      {progresso < 100 && (
        <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg text-sm">
          💡 Complete seu anúncio para aparecer mais nas buscas.
        </div>
      )}

    </div>
  );
}