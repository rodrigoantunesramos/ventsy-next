'use client'

// =========================
// src/app/(dashboard)/planos/page.tsx
// =========================
import { PlanCard } from "src/components/proprietario/planos/PlanCard";
import { PlanHeader } from "src/components/proprietario/planos/PlanHeader";
import { Plan } from "@/types/plan";

const plans: Plan[] = [
  {
    name: "Básico",
    slug: "basico",
    price: "Grátis",
    current: true,
    features: [
      { label: "Cadastro de 1 propriedade", enabled: true },
      { label: "Até 10 fotos", enabled: true },
      { label: "Botão WhatsApp", enabled: true },
      { label: "Relatórios", enabled: false },
      { label: "Selo verificação", enabled: false },
      { label: "Destaque", enabled: false },
    ],
  },
  {
    name: "Pro",
    slug: "pro",
    price: "R$ 89/mês",
    highlighted: true,
    popular: true,
    features: [
      { label: "Tudo do básico", enabled: true },
      { label: "Fotos e vídeos ilimitados", enabled: true },
      { label: "Relatórios detalhados", enabled: true },
      { label: "Calendário de disponibilidade", enabled: true },
      { label: "Suporte prioritário", enabled: true },
    ],
  },
  {
    name: "Ultra",
    slug: "ultra",
    price: "R$ 149/mês",
    features: [
      { label: "Tudo do Pro", enabled: true },
      { label: "Aparecer no topo das buscas", enabled: true },
      { label: "Selo de verificação Gold", enabled: true },
      { label: "Destaque na home", enabled: true },
      { label: "Gerador de contratos PDF", enabled: true },
      { label: "Gerente de conta", enabled: true },
    ],
  },
];

export default function PlanosPage() {
  return (
    <div className="p-6">
      <PlanHeader />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {plans.map((plan) => (
          <PlanCard key={plan.slug} {...plan} />
        ))}
      </div>
    </div>
  );
}
