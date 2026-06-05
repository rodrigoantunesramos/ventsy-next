"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";



interface Event {
  id: string;
  name: string;
  cover: string;
  images: string[];
}

export function PropertyEvents({ events, propertyId }: any) {
  const [selected, setSelected] = useState<Event | null>(null);

  const hasMore = events.length > 4;

  const visibleEvents = hasMore ? events.slice(0, 4) : events;

  const router = useRouter();



  return (
    <div>
      <h2 className="text-2xl font-semibold mb-4">
        Ideias reais de eventos neste espaço
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">

        {visibleEvents.map((event, index) => {
          
          // 👉 SE FOR O ÚLTIMO E TEM MAIS EVENTOS
          if (hasMore && index === 3) {
            return (
              <div
                key={event.id}
                className="relative cursor-pointer group overflow-hidden rounded-2xl"
                onClick={() => {
                  router.push(`/propriedade/${propertyId}/eventos`);
                }}
              >
               
                {/* OVERLAY ESCURO GRADIENTE */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/40 to-transparent" />

                {/* TEXTO CENTRAL */}
                <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
                  <p className="text-lg font-semibold mb-2">
                    Ver todos os eventos
                  </p>
                  <span className="text-sm opacity-80">
                    {events.length} experiências
                  </span>
                </div>
              </div>
            );
          }

          // 👉 CARDS NORMAIS
          return (
            <div
              key={event.id}
              onClick={() => setSelected(event)}
              className="relative cursor-pointer group overflow-hidden rounded-2xl"
            >
              <img
                src={event.cover}
                className="w-full h-[320px] object-cover group-hover:scale-105 transition duration-300"
              />

              <div className="absolute inset-0 bg-black/30 group-hover:bg-black/40 transition" />

              <div className="absolute bottom-4 left-4 text-white">
                <p className="text-lg font-semibold drop-shadow-md">
                    {event.name}
                  </p>
              </div>
            </div>
          );
        })}

      </div>

      {/* MODAL */}
      {selected && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-4 max-w-3xl w-full relative">

            <button
              onClick={() => setSelected(null)}
              className="absolute top-2 right-2 text-black"
            >
              ✕
            </button>

            <h3 className="text-lg font-semibold mb-4">
              {selected.name}
            </h3>

            <div className="grid grid-cols-2 gap-2">
              {selected.images.map((img, i) => (
                <img
                  key={i}
                  src={img}
                  className="w-full h-40 object-cover rounded"
                />
              ))}
            </div>

          </div>
        </div>
      )}
    </div>
  );
}