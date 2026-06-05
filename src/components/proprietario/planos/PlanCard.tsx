// =========================
// src/components/planos/PlanCard.tsx
// =========================
"use client";

import { useRouter } from "next/navigation";
import { Plan } from "@/types/plan";
import { PlanFeature } from "./PlanFeature";
import { Star, Rocket } from "lucide-react";

export function PlanCard(plan: Plan) {
  const router = useRouter();

  const handleClick = () => {
    if (plan.current) return;
    router.push(`/pagamento?plano=${plan.slug}`);
  };

  return (
    <div
      className={`relative p-6 rounded-2xl shadow-md transition transform hover:scale-[1.02] bg-white ${
        plan.highlighted ? "border-2 border-red-500" : "border"
      }`}
    >
      {/* Badge */}
      {plan.current && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs px-3 py-1 rounded-full">
          Seu plano atual
        </span>
      )}

      {plan.popular && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-red-500 text-white text-xs px-3 py-1 rounded-full flex items-center gap-1">
          <Star size={12} /> Mais popular
        </span>
      )}

      {/* Nome */}
      <div className="text-center mb-6">
        <h2 className="text-xl font-semibold flex items-center justify-center gap-2">
          {plan.name === "Ultra" && <Rocket size={16} />}
          {plan.name}
        </h2>
        <p className="text-2xl font-bold mt-2">{plan.price}</p>
      </div>

      {/* Features */}
      <div className="space-y-2 mb-6">
        {plan.features.map((feature, index) => (
          <PlanFeature key={index} label={feature.label} enabled={feature.enabled} />
        ))}
      </div>

      {/* Button */}
      <button
        onClick={handleClick}
        disabled={plan.current}
        className={`w-full py-2 rounded-lg font-medium transition ${
          plan.current
            ? "bg-gray-300 text-gray-600 cursor-not-allowed"
            : "bg-red-500 hover:bg-red-600 text-white"
        }`}
      >
        {plan.current ? "Plano Atual" : `Assinar ${plan.name}`}
      </button>
    </div>
  );
}