"use client";

import { useState } from "react";
import { CalendarGrid } from "@/components/proprietario/calendario/calendariograde";
import { CalendarioSidebar } from "@/components/proprietario/calendario/calendariosidebar";
import { SeletorData } from "@/components/proprietario/calendario/calendarioseletor";
import { useApp } from "@/context/app-context";

export default function Calendario() {
  const hoje = new Date();
  const { calendario } = useApp();

  const [dias, setDias] = useState<any>({});
  const [mes, setMes] = useState(hoje.getMonth());
  const [ano, setAno] = useState(hoje.getFullYear());
  const [mostrarSeletor, setMostrarSeletor] = useState<"mes" | "ano" | null>(null);

  const nomesMeses = [
    "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
    "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"
  ];

  function proximoMes() {
    if (mes === 11) {
      setMes(0);
      setAno((a) => a + 1);
    } else {
      setMes(mes + 1);
    }
  }

  function mesAnterior() {
    if (mes === 0) {
      setMes(11);
      setAno((a) => a - 1);
    } else {
      setMes(mes - 1);
    }
  }

function handleClickDia(dia: number) {
  console.log("clicou no dia", dia);
}

  return (
    <div className="flex gap-6">

      <div className="flex-1 bg-white p-6 rounded-xl border border-gray-100">

        {/* HEADER */}
        <div className="flex items-center justify-between mb-6">

          <button onClick={mesAnterior} className="p-2 rounded-full hover:bg-gray-100">
            ←
          </button>

          <div className="text-center cursor-pointer">

            <h2 className="text-lg font-semibold">

              <span onClick={() => setMostrarSeletor("mes")}>
                {nomesMeses[mes]}
              </span>{" "}
              <span onClick={() => setMostrarSeletor("ano")}>
                {ano}
              </span>

            </h2>

          </div>

          <button onClick={proximoMes} className="p-2 rounded-full hover:bg-gray-100">
            →
          </button>

        </div>

        <CalendarGrid
              dias={calendario}
              onClickDia={handleClickDia}
              mes={mes}
              ano={ano}
            />

        {/* SELETOR */}
        {mostrarSeletor && (
          <SeletorData
            tipo={mostrarSeletor}
            mes={mes}
            ano={ano}
            setMes={setMes}
            setAno={setAno}
            fechar={() => setMostrarSeletor(null)}
          />
        )}

      </div>

      <CalendarioSidebar />

    </div>
  );
}