export function CalendarioSidebar({ dias = {} }: any) {
  const total = 31;
  const bloqueados = Object.values(dias || {}).filter(
    (d) => d === "bloqueado"
  ).length;

  const reservados = Object.values(dias || {}).filter(
    (d) => d === "reservado"
  ).length;

  const livres = total - bloqueados - reservados;

  return (
    <div className="w-[280px] space-y-4">

      {/* RESUMO */}
      <div className="bg-white p-4 rounded-xl border border-gray-100">
        <h3 className="font-semibold mb-2">📊 Resumo do Mês</h3>

        <p>Total: {total}</p>
        <p className="text-green-600">Livres: {livres}</p>
        <p className="text-red-500">Bloqueados: {bloqueados}</p>
        <p className="text-blue-500">Reservados: {reservados}</p>
      </div>

      {/* AÇÕES */}
      <div className="bg-white p-4 rounded-xl border border-gray-100 space-y-2">

        <button className="w-full border p-2 rounded-lg">
          🔒 Bloquear fins de semana
        </button>

        <button className="w-full border p-2 rounded-lg">
          🔓 Liberar mês
        </button>

        <button className="w-full bg-pink-500 text-white p-2 rounded-lg">
          💾 Salvar
        </button>

      </div>

    </div>
  );
}