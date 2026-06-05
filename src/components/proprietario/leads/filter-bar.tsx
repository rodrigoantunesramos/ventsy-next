export function FilterBar() {
  return (
    <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex flex-wrap gap-3">

      <select className="border rounded-lg px-3 py-2 text-sm">
        <option>Todos os status</option>
        <option>Em negociação</option>
        <option>Contratado</option>
        <option>Finalizado</option>
        <option>Perdido</option>
      </select>

      <select className="border rounded-lg px-3 py-2 text-sm">
        <option>Todos os tipos</option>
        <option>Casamento</option>
        <option>Corporativo</option>
      </select>

      <input
        placeholder="Buscar por nome..."
        className="border rounded-lg px-3 py-2 text-sm flex-1 min-w-[200px]"
      />

      <select className="border rounded-lg px-3 py-2 text-sm">
        <option>10 por página</option>
        <option>20</option>
        <option>50</option>
      </select>

    </div>
  );
}