"use client";

import { useState } from "react";
import { CalendarGrid } from "./calendariograde";
import { CalendarioSidebar } from "./calendariosidebar";
import { ModalEvento } from "./calendariomodal";

export function Calendario() {
  const [dias, setDias] = useState<any>({});
  const [diaSelecionado, setDiaSelecionado] = useState<number | null>(null);

  function handleClickDia(dia: number) {
    setDiaSelecionado(dia);
  }

  function salvarEvento(dia: number, evento: any) {
    setDias((prev: any) => ({
      ...prev,
      [dia]: {
        status: "reservado",
        evento,
      },
    }));

    setDiaSelecionado(null);
  }

  return (
    <div className="flex gap-6">

      {/* CALENDÁRIO */}
      <div className="flex-1 bg-white p-6 rounded-xl border border-gray-100">

        <h2 className="text-lg font-semibold mb-4">
          Março 2026
        </h2>

        <CalendarGrid dias={dias} onClickDia={handleClickDia} />

      </div>

      {/* SIDEBAR */}
      <CalendarioSidebar dias={dias} />

      {/* MODAL */}
      {diaSelecionado && (
        <ModalEvento
          dia={diaSelecionado}
          onClose={() => setDiaSelecionado(null)}
          onSave={salvarEvento}
        />
      )}

    </div>
  );
}