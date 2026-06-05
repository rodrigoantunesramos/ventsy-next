export function ResumoCard() {
  const resumo = {
    receitas: 120000,
    despesas: 45000,
    lucro: 75000,
  };

  return (
    <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm space-y-4">

      <h3 className="font-semibold text-lg">
        Resumo do Mês
      </h3>

      <div className="space-y-3">

        <div className="flex justify-between">
          <span className="text-gray-500 text-sm">Receitas</span>
          <span className="text-green-600 font-semibold">
            R$ {resumo.receitas.toLocaleString()}
          </span>
        </div>

        <div className="flex justify-between">
          <span className="text-gray-500 text-sm">Despesas</span>
          <span className="text-red-500 font-semibold">
            R$ {resumo.despesas.toLocaleString()}
          </span>
        </div>

        <div className="flex justify-between border-t pt-3">
          <span className="text-sm font-medium">Lucro Líquido</span>
          <span className="text-blue-600 font-bold">
            R$ {resumo.lucro.toLocaleString()}
          </span>
        </div>

      </div>

    </div>
  );
}