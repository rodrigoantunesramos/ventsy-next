export function ChartBar() {
  const data = [
    { mes: "Jan", receita: 20000, despesa: 8000 },
    { mes: "Fev", receita: 25000, despesa: 12000 },
    { mes: "Mar", receita: 18000, despesa: 9000 },
    { mes: "Abr", receita: 30000, despesa: 15000 },
    { mes: "Mai", receita: 28000, despesa: 13000 },
    { mes: "Jun", receita: 32000, despesa: 16000 },
  ];

  return (
    <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
      <h3 className="font-semibold mb-4">
        Receita vs Despesa (6 meses)
      </h3>

      <div className="space-y-3">
        {data.map((item) => (
          <div key={item.mes}>
            <p className="text-sm text-gray-500">{item.mes}</p>

            <div className="flex gap-2">
              <div
                className="bg-green-400 h-3 rounded"
                style={{ width: `${item.receita / 400}px` }}
              />
              <div
                className="bg-red-400 h-3 rounded"
                style={{ width: `${item.despesa / 400}px` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}