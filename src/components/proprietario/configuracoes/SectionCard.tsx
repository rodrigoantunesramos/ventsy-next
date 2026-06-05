// =============================
// FILE: /src/components/configuracoes/SectionCard.tsx
// =============================
export function SectionCard({ title, children }: any) {
  return (
    <div className="bg-white border rounded-2xl shadow-sm p-6 space-y-4">
      <h2 className="text-lg font-semibold">{title}</h2>
      {children}
    </div>
  );
}