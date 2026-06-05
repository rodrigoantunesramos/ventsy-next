type BadgeProps = {
  children?: React.ReactNode;
  color?: "green" | "red" | "blue" | "yellow" | "gray";
  status?: "pago" | "pendente" | "atrasado";
};

export function Badge({ children, color = "gray", status }: BadgeProps) {
  const base = "px-2 py-1 rounded-md text-xs font-medium";

  const colorMap: Record<string, string> = {
    green: "bg-green-100 text-green-700",
    red: "bg-red-100 text-red-700",
    blue: "bg-blue-100 text-blue-700",
    yellow: "bg-yellow-100 text-yellow-700",
    gray: "bg-gray-100 text-gray-700",
  };

  const statusMap: Record<string, { label: string; color: string }> = {
    pago: { label: "Pago", color: "green" },
    pendente: { label: "Pendente", color: "yellow" },
    atrasado: { label: "Atrasado", color: "red" },
  };

  // Se tiver status → usa ele
  if (status) {
    const config = statusMap[status];
    return (
      <span className={`${base} ${colorMap[config.color]}`}>
        {config.label}
      </span>
    );
  }

  // Caso contrário usa modo genérico
  return (
    <span className={`${base} ${colorMap[color]}`}>
      {children}
    </span>
  );
}