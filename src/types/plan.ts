// =========================
// src/types/plan.ts
// =========================
export type PlanFeatureType = {
  label: string;
  enabled: boolean;
};

export type Plan = {
  name: string;
  slug: string;
  price: string;
  features: PlanFeatureType[];
  highlighted?: boolean;
  current?: boolean;
  popular?: boolean;
};