// =============================
// FILE: /src/components/configuracoes/DangerZoneSection.tsx
// =============================
import { SectionCard } from "./SectionCard";

export function DangerZoneSection() {
  return (
    <div className="border border-red-300 bg-red-50 rounded-2xl p-6 space-y-4">
      <h2 className="text-lg font-semibold text-red-600">Zona de Perigo</h2>

      <DangerItem label="Despublicar anúncio" />
      <DangerItem label="Cancelar assinatura" />
      <DangerItem label="Excluir conta" danger />
    </div>
  );
}

function DangerItem({ label, danger }: any) {
  return (
    <div className="flex justify-between items-center">
      <span>{label}</span>
      <button
        className={`px-3 py-1 rounded-lg ${
          danger ? "bg-red-600 text-white" : "border"
        }`}
      >
        {danger ? "Excluir" : "Executar"}
      </button>
    </div>
  );
}