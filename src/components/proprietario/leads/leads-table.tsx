import { StatusBadge } from "./status-badge";

export function LeadsTable({ data }: any) {

  if (!data.length) {
    return (
      <div className="bg-white p-10 rounded-xl border border-gray-100 text-center">
        <div className="text-4xl mb-3">🎉</div>
        <p className="text-gray-500">
          Nenhum cliente encontrado. Que tal adicionar o primeiro?
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      <table className="w-full text-sm">

        <thead className="bg-gray-50 text-gray-500">
          <tr>
            <th className="text-left p-3">Evento</th>
            <th className="text-left p-3">Cliente</th>
            <th className="text-left p-3">Data</th>
            <th className="text-left p-3">Status</th>
          </tr>
        </thead>

        <tbody>
          {data.map((item: any, i: number) => (
            <tr key={i} className="border-t hover:bg-gray-50">

              <td className="p-3 font-medium">{item.evento}</td>
              <td className="p-3">{item.cliente}</td>
              <td className="p-3">{item.data}</td>
              <td className="p-3">
                <StatusBadge status={item.status} />
              </td>

            </tr>
          ))}
        </tbody>

      </table>
    </div>
  );
}