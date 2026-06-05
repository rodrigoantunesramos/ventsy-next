export function Select({ label }: { label: string }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm text-gray-500">{label}</label>
      <select className="border border-gray-200 rounded-lg px-3 py-2">
        <option>Selecione o tipo...</option>
      </select>
    </div>
  );
}