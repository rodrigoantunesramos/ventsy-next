// =========================
// src/components/planos/PlanFeature.tsx
// =========================
import { Check, X } from "lucide-react";

export function PlanFeature({ label, enabled }: { label: string; enabled: boolean }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      {enabled ? (
        <Check className="text-green-500 w-4 h-4" />
      ) : (
        <X className="text-gray-400 w-4 h-4" />
      )}
      <span className={enabled ? "text-gray-800" : "text-gray-400 line-through"}>
        {label}
      </span>
    </div>
  );
}