"use client";

import { Table } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/components/ui/moeda";

export default function DespesasPage() {
  const columns = [
    "Data",
    "Descrição",
    "Categoria",
    "Evento",
    "Status",
    "Valor",
  ];

  const despesas = [
    {
      data: "10/03/2026",
      descricao: "Conta de energia",
      categoria: "Energia",
      evento: "-",
      status: "pago",
      valor: 850,
    },
    {
      data: "12/03/2026",
      descricao: "Limpeza pós-evento",
      categoria: "Limpeza",
      evento: "Casamento Ana",
      status: "pendente",
      valor: 450,
    },
    {
      data: "08/03/2026",
      descricao: "Manutenção elétrica",
      categoria: "Manutenção",
      evento: "-",
      status: "atrasado",
      valor: 1200,
    },
  ];

  const data = despesas.map((item) => [
    item.data,
    item.descricao,
    item.categoria,
    item.evento,
    <Badge status={item.status as "pago" | "pendente" | "atrasado"} />,
    <span className="text-red-600 font-semibold">
      {formatCurrency(item.valor)}
    </span>,
  ]);

  return (
    <div className="space-y-6">

      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Despesas</h1>
          <p className="text-sm text-gray-400">
            Controle todos os gastos da sua operação
          </p>
        </div>

        <button className="bg-pink-500 text-white px-4 py-2 rounded-lg text-sm hover:bg-pink-600 transition">
          + Nova Despesa
        </button>
      </div>

      {/* TABELA */}
      <Table columns={columns} data={data} />

    </div>
  );
}