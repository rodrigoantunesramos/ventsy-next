type Status = "negociacao" | "contratado" | "finalizado" | "perdido";

export function StatusBadge({ status }: { status: Status }) {
  const styles = {
    negociacao: "bg-yellow-100 text-yellow-700",
    contratado: "bg-green-100 text-green-700",
    finalizado: "bg-blue-100 text-blue-700",
    perdido: "bg-red-100 text-red-700",
  };

  const labels = {
    negociacao: "Em negociação",
    contratado: "Contratado",
    finalizado: "Finalizado",
    perdido: "Perdido",
  };

  return (
    <span className={`px-2 py-1 rounded-md text-xs font-medium ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}