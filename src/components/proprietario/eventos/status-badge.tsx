type Status = "confirmado" | "andamento" | "finalizado" | "cancelado";

export function EventStatusBadge({ status }: { status: Status }) {
  const styles = {
    confirmado: "bg-green-100 text-green-700",
    andamento: "bg-yellow-100 text-yellow-700",
    finalizado: "bg-blue-100 text-blue-700",
    cancelado: "bg-red-100 text-red-700",
  };

  const labels = {
    confirmado: "Confirmado",
    andamento: "Em andamento",
    finalizado: "Finalizado",
    cancelado: "Cancelado",
  };

  return (
    <span className={`px-2 py-1 rounded-md text-xs font-medium ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}