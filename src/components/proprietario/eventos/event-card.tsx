import { EventStatusBadge } from "./status-badge";

type Evento = {
  nome: string;
  cliente: string;
  data: string;
  local: string;
  valor: number;
  status: "confirmado" | "andamento" | "finalizado" | "cancelado";
};

export function EventCard({ evento }: { evento: Evento }) {
  return (
    <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition cursor-pointer">

      <div className="flex justify-between items-start mb-3">
        <span className="text-xs text-gray-400">{evento.data}</span>

        <span className="text-green-600 font-semibold text-sm">
          R$ {evento.valor.toLocaleString()}
        </span>
      </div>

      <h3 className="font-semibold text-sm">{evento.nome}</h3>

      <p className="text-xs text-gray-500">
        {evento.cliente} • {evento.local}
      </p>

      <div className="mt-3">
        <EventStatusBadge status={evento.status} />
      </div>

    </div>
  );
}