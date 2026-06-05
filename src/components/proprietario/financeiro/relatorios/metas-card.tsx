type Meta = {
  label: string;
  valor: number;
  cor: string;
};

export function MetasCard() {
  const metas: Meta[] = [
    { label: "Meta Receita", valor: 80, cor: "bg-green-500" },
    { label: "Eventos", valor: 65, cor: "bg-blue-500" },
    { label: "Redução Despesas", valor: 40, cor: "bg-red-500" },
    { label: "Taxa Ocupação", valor: 75, cor: "bg-pink-500" },
  ];

  return (
    <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm space-y-5">

      <h3 className="font-semibold text-lg">
        Metas vs Realizado
      </h3>

      {metas.map((meta) => (
        <div key={meta.label} className="space-y-1">

          <div className="flex justify-between text-sm">
            <span className="text-gray-600">{meta.label}</span>
            <span className="font-medium">{meta.valor}%</span>
          </div>

          <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={`h-full ${meta.cor} rounded-full`}
              style={{ width: `${meta.valor}%` }}
            />
          </div>

        </div>
      ))}

    </div>
  );
}