"use client";

import { EventList } from "@/components/proprietario/eventos/event-list";
import { useApp } from "@/context/app-context";

export default function EventosPage() {
  const { eventos } = useApp();
    

  return (
    <div className="space-y-6">

      {/* HEADER */}
      <div className="flex justify-between items-center">

        <div>
          <h1 className="text-xl font-semibold">Eventos</h1>
          <p className="text-sm text-gray-400">
            Gerencie todos os eventos confirmados do seu espaço
          </p>
        </div>

        <button className="bg-pink-500 text-white px-4 py-2 rounded-lg text-sm hover:bg-pink-600">
          + Novo Evento
        </button>

      </div>

      {/* LISTA */}
      <EventList eventos={eventos} />

    </div>
  );
}