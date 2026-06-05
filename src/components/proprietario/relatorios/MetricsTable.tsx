// components/MetricsTable.tsx
export function MetricsTable() {
  const metrics = [
    { name: 'Visualizações', total: 1200, avg: 40 },
    { name: 'Cliques', total: 600, avg: 20 },
    { name: 'Conversões', total: 120, avg: 4 },
  ]

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-gray-500">
          <th>Métrica</th>
          <th>Total</th>
          <th>Média/Dia</th>
        </tr>
      </thead>
      <tbody>
        {metrics.map((m) => (
          <tr key={m.name} className="border-t">
            <td className="py-2">{m.name}</td>
            <td>{m.total}</td>
            <td>{m.avg}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}