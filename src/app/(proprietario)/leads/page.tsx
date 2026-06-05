"use client";

import {
  Users,
  Clock,
  CheckCircle,
  Calendar,
  XCircle,
} from "lucide-react";

import { SummaryCard } from "@/components/proprietario/leads/summary-card";
import { FilterBar } from "@/components/proprietario/leads/filter-bar";
import { LeadsTable } from "@/components/proprietario/leads/leads-table";
import { KanbanBoard } from "@/components/proprietario/leads/board";

export default function LeadsPage() {
  const leads = [
    {
      evento: "Casamento João & Ana",
      cliente: "João Silva",
      data: "12/03/2026",
      status: "contratado",
    },
    {
      evento: "Evento XP",
      cliente: "Maria Souza",
      data: "20/03/2026",
      status: "negociacao",
    },
    {
      evento: "Aniversário 50 anos",
      cliente: "Carlos Lima",
      data: "25/03/2026",
      status: "perdido",
    },
  ];

  return (
    <div className="space-y-6">

      {/* HEADER */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-semibold">Clientes & Eventos</h1>
          <p className="text-sm text-gray-400">
            Gerencie todos os seus contatos, negociações e eventos.
          </p>
        </div>

        <div className="flex gap-2">
          <button className="border px-3 py-2 rounded-lg text-sm">Excel</button>
          <button className="border px-3 py-2 rounded-lg text-sm">PDF</button>
          <button className="bg-pink-500 text-white px-4 py-2 rounded-lg text-sm">
            + Novo Cliente
          </button>
        </div>
      </div>

      {/* CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">

        <SummaryCard title="Clientes" value={120} icon={Users} description="Total cadastrados" />
        <SummaryCard title="Negociação" value={30} icon={Clock} description="Em andamento" />
        <SummaryCard title="Contratados" value={50} icon={CheckCircle} description="Confirmados" />
        <SummaryCard title="Finalizados" value={20} icon={Calendar} description="Realizados" />
        <SummaryCard title="Perdidos" value={20} icon={XCircle} description="Encerrados" />

      </div>

      {/* FILTROS */}
      <FilterBar />

      {/* TABELA */}
      <KanbanBoard />

    </div>
  );
}