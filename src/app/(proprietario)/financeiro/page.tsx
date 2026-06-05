"use client";

import { SummaryCard } from "@/components/proprietario/financeiro/summary-card";
import { ChartBar } from "@/components/proprietario/financeiro/chart-bar";
import { ChartPie } from "@/components/proprietario/financeiro/chart-pie";
import { MetasCard } from "@/components/proprietario/financeiro/metas-card";
import { EventosList } from "@/components/proprietario/financeiro/eventos-list";

export default function FinanceiroDashboard() {
  return (
    <div className="space-y-6">

      {/* CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <SummaryCard title="Receita Total" value="R$ 120.000" color="green" />
        <SummaryCard title="Despesas" value="R$ 45.000" color="red" />
        <SummaryCard title="Lucro Líquido" value="R$ 75.000" color="blue" />
        <SummaryCard title="Eventos no mês" value="18" color="gray" />
      </div>

      {/* GRÁFICOS */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">

        <div className="xl:col-span-2">
          <ChartBar />
        </div>

        <div>
          <ChartPie />
        </div>

      </div>

      {/* METAS + EVENTOS */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">

        <MetasCard />

        <EventosList />

      </div>

    </div>
  );
}