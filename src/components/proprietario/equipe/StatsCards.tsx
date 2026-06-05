"use client";

import { Employee } from "@/types/employee";
import { getEmployeeCost } from "@/lib/calc";

interface Props {
  employees: Employee[];
  charges: any;
}

export function StatsCards({ employees, charges }: Props) {
  const totalEmployees = employees.length;

  const totalSalary = employees.reduce((acc, e) => acc + e.salary, 0);

  const totalChargesValue = employees.reduce((acc, e) => {
    const cost = getEmployeeCost(e.salary, e.contractType, charges);
    return acc + cost.charges;
  }, 0);

  const totalMonthly = totalSalary + totalChargesValue;

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      
      <Card
        title="Funcionários"
        value={totalEmployees}
        icon="👥"
      />

      <Card
        title="Folha Bruta"
        value={formatCurrency(totalSalary)}
        icon="💰"
      />

      <Card
        title="Encargos"
        value={formatCurrency(totalChargesValue)}
        highlight
        icon="📊"
      />

      <Card
        title="Custo Total"
        value={formatCurrency(totalMonthly)}
        highlight
        icon="🔥"
      />

    </div>
  );
}

/* -------------------- CARD -------------------- */

function Card({ title, value, highlight, icon }: any) {
  return (
    <div className="relative group bg-white/70 backdrop-blur border border-gray-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5">
      
      {/* glow elegante */}
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-transparent via-black/5 to-transparent opacity-0 group-hover:opacity-100 transition" />

      <div className="flex items-center justify-between">
        
        <div>
          <p className="text-xs text-gray-500">{title}</p>

          <h2
            className={`text-2xl font-semibold mt-1 ${
              highlight ? "text-red-500" : "text-gray-900"
            }`}
          >
            {value}
          </h2>
        </div>

        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-medium ${
            highlight
              ? "bg-red-100 text-red-600"
              : "bg-gray-100 text-gray-600"
          }`}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}

/* -------------------- FORMAT -------------------- */

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}