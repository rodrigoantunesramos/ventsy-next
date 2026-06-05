type Evento = {
  data: string;
  nome: string;
  tipo: string;
  local: string;
  pessoas: number;
  valor: number;
};

export function EventCard({ evento }: { evento: Evento }) {

  // 🎨 CORES POR TIPO
  const tipoColors: Record<string, string> = {
    casamento: "border-l-pink-500",
    corporativo: "border-l-blue-500",
    formatura: "border-l-purple-500",
    aniversario: "border-l-yellow-500",
  };

  const tipoKey = evento.tipo.toLowerCase();

  const borderColor =
    tipoColors[tipoKey] || "border-l-gray-300";

  return (
    <div
      className={`bg-white border border-gray-100 border-l-4 ${borderColor} rounded-xl p-5 shadow-sm hover:shadow-md transition cursor-pointer`}
    >

      {/* DATA + VALOR */}
      <div className="flex justify-between items-start mb-3">
        <span className="text-xs text-gray-400">{evento.data}</span>

        <span className="text-green-600 font-semibold text-sm">
          R$ {evento.valor.toLocaleString()}
        </span>
      </div>

      {/* NOME */}
      <h3 className="font-semibold text-sm mb-1">
        {evento.nome}
      </h3>

      {/* INFO */}
      <p className="text-xs text-gray-500">
        {evento.tipo} • {evento.local}
      </p>

      <p className="text-xs text-gray-400 mt-1">
        {evento.pessoas} pessoas
      </p>

      <span className="text-xs px-2 py-1 rounded bg-gray-100">
        {evento.tipo}
        </span>

    </div>
  );
}