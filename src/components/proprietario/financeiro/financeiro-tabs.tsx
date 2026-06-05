"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// 👇 AQUI
import { BarChart3, DollarSign, TrendingDown, Calendar, FileText } from "lucide-react";

export const financeiroTabs = [
  { label: "Painel", href: "/financeiro", icon: BarChart3 },
  { label: "Receitas", href: "/financeiro/receitas", icon: DollarSign },
  { label: "Despesas", href: "/financeiro/despesas", icon: TrendingDown },
  { label: "Eventos", href: "/financeiro/eventos", icon: Calendar },
  { label: "Relatórios", href: "/financeiro/relatorios", icon: FileText },
];

export function FinanceiroTabs() {
  const pathname = usePathname();
  const isActive = (href: string) => {
    if (!pathname) return false;

    // Página principal do financeiro
    if (href === "/financeiro") {
      return pathname === "/financeiro";
    }

    // Subpáginas
    return pathname.startsWith(href);
  };

  return (
    <div className="flex flex-wrap gap-2">
      {financeiroTabs.map((tab) => {
        const Icon = tab.icon;
        const active = isActive(tab.href);

        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition ${
              active ? "bg-pink-500 text-white" : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            <Icon size={16} />
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
  