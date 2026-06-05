export function MetasCard() {
  const metas = [
    { label: "Meta Receita", value: 80 },
    { label: "Eventos", value: 60 },
    { label: "Redução Despesas", value: 40 },
    { label: "Taxa Ocupação", value: 70 },
  ];

  return (
    <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm space-y-4">
      <h3 className="font-semibold">Metas do Mês</h3>

      {metas.map((meta) => (
        <div key={meta.label}>
          <div className="flex justify-between text-sm">
            <span>{meta.label}</span>
            <span>{meta.value}%</span>
          </div>

          <div className="w-full bg-gray-200 h-2 rounded mt-1">
            <div
              className="bg-pink-500 h-2 rounded"
              style={{ width: `${meta.value}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}