"use client";

import { EventCard } from "@/components/proprietario/financeiro/eventos/event-card";

export default function EventosPage() {
  const eventos = [
    {
      data: "12 Mar 2026",
      nome: "Casamento Ferreira",
      tipo: "Casamento",
      local: "Salão Principal",
      pessoas: 200,
      valor: 15000,
    },
    {
      data: "15 Mar 2026",
      nome: "Formatura Direito",
      tipo: "Formatura",
      local: "Área Externa",
      pessoas: 120,
      valor: 10000,
    },
    {
      data: "20 Mar 2026",
      nome: "Evento Corporativo XP",
      tipo: "Corporativo",
      local: "Espaço VIP",
      pessoas: 80,
      valor: 8000,
    },
  ];

  // 🔥 ordena por data (simples mock)
  const eventosOrdenados = eventos.sort((a, b) =>
    a.data.localeCompare(b.data)
  );

  return (
    <div className="space-y-6">

      {/* HEADER */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-semibold">Eventos</h1>
          <p className="text-sm text-gray-400">
            Acompanhe todos os eventos realizados
          </p>
        </div>

        <button className="bg-pink-500 text-white px-4 py-2 rounded-lg text-sm hover:bg-pink-600 transition">
          + Novo Evento
        </button>
      </div>

      {/* LISTA */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">

        {eventosOrdenados.map((evento, i) => (
          <EventCard key={i} evento={evento} />
        ))}

      </div>

    </div>
  );
}