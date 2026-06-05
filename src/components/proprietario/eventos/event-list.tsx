import { EventCard } from "./event-card";

export function EventList({ eventos }: any) {
  if (!eventos.length) {
    return (
      <div className="bg-white p-10 rounded-xl border border-gray-100 text-center">
        <div className="text-4xl mb-3">📅</div>
        <p className="text-gray-500">
          Nenhum evento encontrado.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {eventos.map((evento: any, i: number) => (
        <EventCard key={i} evento={evento} />
      ))}
    </div>
  );
}