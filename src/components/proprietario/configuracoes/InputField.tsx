// =============================
// FILE: /src/components/configuracoes/InputField.tsx
// =============================
export function InputField({ label, ...props }: any) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm text-gray-600">{label}</label>
      <input
        className="border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-400"
        {...props}
      />
    </div>
  );
}