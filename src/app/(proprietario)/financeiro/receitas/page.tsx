"use client";

import { ReceitaTable } from "@/components/proprietario/financeiro/receitas/receita-table";
import { Button } from "@/components/ui/button";
import { useApp } from "@/context/app-context";

export default function ReceitasPage() {
  const { receitas } = useApp();

  return (
    <div className="space-y-6">

      {/* HEADER */}
      <div className="flex justify-between items-center">
        <h1 className="text-xl font-semibold">Receitas</h1>

        <Button>+ Nova Receita</Button>
      </div>

      {/* TABELA */}
      <ReceitaTable data={receitas} />
    </div>
  );
}