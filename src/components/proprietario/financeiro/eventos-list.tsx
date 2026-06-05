export function EventosList() {
  const eventos = [
    {
      data: "12/03",
      nome: "Casamento Ana & João",
      local: "Salão Principal",
      valor: "R$ 12.000",
    },
    {
      data: "15/03",
      nome: "Evento Corporativo XP",
      local: "Área Externa",
      valor: "R$ 8.000",
    },
    {
      data: "20/03",
      nome: "Aniversário 50 anos",
      local: "Espaço VIP",
      valor: "R$ 6.500",
    },
  ];

  return (
    <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
      <h3 className="font-semibold mb-4">Próximos Eventos</h3>

      <div className="space-y-3">
        {eventos.map((e, i) => (
          <div
            key={i}
            className="flex justify-between items-center border-b pb-2"
          >
            <div>
              <p className="text-sm font-medium">{e.nome}</p>
              <p className="text-xs text-gray-400">
                {e.data} • {e.local}
              </p>
            </div>

            <span className="text-sm font-semibold text-green-600">
              {e.valor}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}