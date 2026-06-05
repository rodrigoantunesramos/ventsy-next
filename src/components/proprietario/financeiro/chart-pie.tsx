export function ChartPie() {
  const data = [
    { label: "Aluguel", value: 50 },
    { label: "Buffet", value: 25 },
    { label: "Decoração", value: 15 },
    { label: "Outros", value: 10 },
  ];

  return (
    <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
      <h3 className="font-semibold mb-4">Fontes de Receita</h3>

      <div className="space-y-2">
        {data.map((item) => (
          <div key={item.label} className="flex justify-between text-sm">
            <span>{item.label}</span>
            <span>{item.value}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}