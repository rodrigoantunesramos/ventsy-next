"use client";

import { useState } from "react";
import { AbaContato } from "@/components/proprietario/minha-propriedade/aba-contato";
import { AbaSobre } from "@/components/proprietario/minha-propriedade/aba-sobre";
import { AbaValores } from "@/components/proprietario/minha-propriedade/aba-valores";
import { AbaEndereco } from "@/components/proprietario/minha-propriedade/aba-endereco";
import { AbaEventos } from "@/components/proprietario/minha-propriedade/aba-eventos";
import { AbaFAQ } from "@/components/proprietario/minha-propriedade/aba-faq";
import { AbaServicos } from "@/components/proprietario/minha-propriedade/aba-servicos";
import { AbaForca } from "@/components/proprietario/minha-propriedade/aba-forca";



export default function PropriedadePage() {
  const [tab, setTab] = useState("contato");

  return (
    <div className="space-y-6">

      {/* HEADER */}
      <div className="flex justify-between items-center">
        <h1 className="text-xl font-semibold">Minha Propriedade</h1>

        <button className="text-sm border px-3 py-2 rounded-lg">
          Ver Anúncio Público
        </button>
      </div>

      {/* TABS */}
      <div className="flex gap-2 flex-wrap">
        {[
          "contato",
          "sobre",
          "valores",
          "endereco",
          "eventos",
          "faq",
          "servicos",
          "forca",
        ].map((item) => (
          <button
            key={item}
            onClick={() => setTab(item)}
            className={`px-3 py-1 rounded-md text-sm ${
              tab === item
                ? "bg-pink-500 text-white"
                : "bg-gray-100"
            }`}
          >
            {item}
          </button>
        ))}
      </div>
      

      {/* CONTEÚDO */}
      {tab === "contato" && <AbaContato/>}
      {tab === "sobre" && <AbaSobre/>}
      {tab === "valores" && <AbaValores/>}
      {tab === "endereco" && <AbaEndereco/>}
      {tab === "eventos" && <AbaEventos/>}
      {tab === "faq" && <AbaFAQ/>}
      {tab === "servicos" && <AbaServicos/>}
      {tab === "forca" && <AbaForca/>}


    </div>
  );
}