"use client";

import { Input } from "@/components/ui/imput";
import { Select } from "@/components/ui/select";
import { useState } from "react";


type FAQ = {
  pergunta: string;
  resposta: string;
};

export function AbaFAQ() {
  const [faqs, setFaqs] = useState<FAQ[]>([
    {
      pergunta: "Regras de Cobrança",
      resposta: "",
    },
  ]);

  function addFAQ() {
    setFaqs([...faqs, { pergunta: "", resposta: "" }]);
  }

  function updateFAQ(index: number, field: "pergunta" | "resposta", value: string) {
    const updated = [...faqs];
    updated[index][field] = value;
    setFaqs(updated);
  }

  function removeFAQ(index: number) {
    const updated = faqs.filter((_, i) => i !== index);
    setFaqs(updated);
  }

  return (
    <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm space-y-6">

      {/* HEADER */}
      <div>
        <h2 className="font-semibold text-lg">
          Perguntas Frequentes (FAQ)
        </h2>
        <p className="text-sm text-gray-400">
          Ajude seus clientes respondendo às dúvidas mais comuns.
        </p>
      </div>

      {/* LISTA */}
      <div className="space-y-4">

        {faqs.map((faq, index) => (
          <div key={index} className="border rounded-xl p-4 space-y-3 bg-gray-50">

            {/* PERGUNTA */}
            <input
              value={faq.pergunta}
              onChange={(e) =>
                updateFAQ(index, "pergunta", e.target.value)
              }
              placeholder="Digite a pergunta"
              className="w-full border border-gray-200 rounded-lg px-3 py-2"
            />

            {/* RESPOSTA */}
            <textarea
              value={faq.resposta}
              onChange={(e) =>
                updateFAQ(index, "resposta", e.target.value)
              }
              placeholder="Ex: Valor inclui 6 horas de uso..."
              className="w-full border border-gray-200 rounded-lg px-3 py-2 h-24 resize-none"
            />

            {/* REMOVER */}
            {faqs.length > 1 && (
              <button
                onClick={() => removeFAQ(index)}
                className="text-red-500 text-sm hover:underline"
              >
                Remover
              </button>
            )}

          </div>
        ))}

      </div>

      {/* ADD */}
      <button
        onClick={addFAQ}
        className="w-full border-2 border-dashed border-gray-300 py-3 rounded-xl text-sm hover:bg-gray-50 transition"
      >
        + Adicionar Nova Pergunta
      </button>

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