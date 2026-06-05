"use client";

import { useState } from "react";
import { useParams } from "next/navigation";

interface Event {
  id: string;
  name: string;
  cover: string;
  images: string[];
}

const events: Event[] = [
  {
    id: "1",
    name: "Casamento Luxo",
    cover: "https://images.unsplash.com/photo-1519741497674-611481863552",
    images: [
      "https://images.unsplash.com/photo-1519741497674-611481863552",
      "https://images.unsplash.com/photo-1520854221256-17451cc331bf",
      "https://images.unsplash.com/photo-1505236858219-8359eb29e329",
    ],
  },
  {
    id: "2",
    name: "Aniversário 30 anos",
    cover: "https://images.unsplash.com/photo-1464366400600-7168b8af9bc3",
    images: [
      "https://images.unsplash.com/photo-1464366400600-7168b8af9bc3",
      "https://images.unsplash.com/photo-1505236858219-8359eb29e329",
    ],
  },
  {
    id: "3",
    name: "Evento Corporativo",
    cover: "https://images.unsplash.com/photo-1515168833906-d2a3b82b302a",
    images: [
      "https://images.unsplash.com/photo-1515168833906-d2a3b82b302a",
      "https://images.unsplash.com/photo-1556761175-4b46a572b786",
    ],
  },
  {
    id: "4",
    name: "Chá de bebê",
    cover: "https://images.unsplash.com/photo-1521335629791-ce4aec67dd47",
    images: [
      "https://images.unsplash.com/photo-1521335629791-ce4aec67dd47",
    ],
  },
  {
    id: "5",
    name: "Festa temática",
    cover: "https://images.unsplash.com/photo-1505236858219-8359eb29e329",
    images: [
      "https://images.unsplash.com/photo-1505236858219-8359eb29e329",
    ],
  },
];

export default function EventosPage() {
  const { id } = useParams(); // id da propriedade
  const [selected, setSelected] = useState<Event | null>(null);

  return (
    <div className="max-w-7xl mx-auto p-6">

      {/* HEADER */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold">
          Inspirações do espaço
        </h1>
        <p className="text-gray-500">
          Veja como outros clientes decoraram este espaço
        </p>
      </div>

      {/* GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
        {events.map((event) => (
          <div
            key={event.id}
            onClick={() => setSelected(event)}
            className="relative cursor-pointer group overflow-hidden rounded-2xl"
          >
            <img
              src={event.cover}
              className="w-full h-[300px] object-cover group-hover:scale-105 transition duration-300"
            />

            <div className="absolute inset-0 bg-black/30 group-hover:bg-black/40 transition" />

            <div className="absolute bottom-4 left-4 text-white">
              <p className="text-lg font-semibold">{event.name}</p>
            </div>
          </div>
        ))}
      </div>

      {/* MODAL */}
      {selected && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-4 max-w-4xl w-full relative">

            <button
              onClick={() => setSelected(null)}
              className="absolute top-2 right-2 text-black text-xl"
            >
              ✕
            </button>

            <h2 className="text-xl font-semibold mb-4">
              {selected.name}
            </h2>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
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