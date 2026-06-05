"use client";

import { useMemo, useState } from "react";
import { SearchCard } from "./SearchCard";
import { SearchMap } from "./SearchMap";

type Property = {
  id: number;
  name: string;
  city: string;
  price: number;
  capacity: number;
  eventTypes: string[];
  image: string;
  lat: number;
  lng: number;
};

const MOCK_PROPERTIES: Property[] = [
  {
    id: 1,
    name: "Espaço Sunset",
    city: "Rio de Janeiro",
    price: 500,
    capacity: 150,
    eventTypes: ["casamento", "aniversario"],
    lat: -22.9068,
    lng: -43.1729,
    image: "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85",
  },
  {
    id: 2,
    name: "Chácara Verde",
    city: "Rio de Janeiro",
    price: 600,
    capacity: 200,
    eventTypes: ["casamento", "show"],
    lat: -22.95,
    lng: -43.21,
    image: "https://images.unsplash.com/photo-1501183638710-841dd1904471",
  },
];

export function SearchResults({ searchParams }: any) {
  const { location, event, guests } = searchParams;

  const [hoveredId, setHoveredId] = useState<number | null>(null);

  const filtered = useMemo(() => {
    return MOCK_PROPERTIES.filter((property) => {
      const matchLocation =
        !location ||
        property.city.toLowerCase().includes(location.toLowerCase());

      const matchEvent =
        !event ||
        property.eventTypes.includes(event);

      const matchGuests =
        !guests || property.capacity >= Number(guests);

      return matchLocation && matchEvent && matchGuests;
    });
  }, [location, event, guests]);

  return (
    <div className="flex gap-6 h-[calc(100vh-100px)]">
      
      {/* LISTA */}
      <div className="w-1/2 overflow-y-auto pr-2">
        <h1 className="text-2xl font-bold mb-4">
          {filtered.length} resultados
        </h1>

        <div className="space-y-4">
          {filtered.map((property) => (
            <SearchCard
              key={property.id}
              property={property}
              onHover={setHoveredId}
            />
          ))}
        </div>
      </div>

      {/* MAPA */}
      <div className="w-1/2 sticky top-20 h-full">
        <SearchMap
          properties={filtered}
          hoveredId={hoveredId}
        />
      </div>
    </div>
  );
}