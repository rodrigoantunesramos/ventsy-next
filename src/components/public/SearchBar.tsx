"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { EventTypeDropdown } from "./EventTypeDropdown";

import {
  EVENT_TYPES,
  groupEventsByCategory,
  CATEGORY_LABELS,
} from "src/components/public/eventTypes";

export function SearchBar() {
  const [location, setLocation] = useState("");
  const [eventTypes, setEventTypes] = useState<string[]>([]);
  
  const [guests, setGuests] = useState("");

  const [open, setOpen] = useState(false);
  const groupedEvents = groupEventsByCategory(EVENT_TYPES);

  function handleSearch() {
    const filters = {
      location,
      eventTypes,
      guests,
    };

    console.log("BUSCA:", filters);

    // 👉 Próximo passo:
    // router.push(`/search?location=${location}&event=${eventType}&guests=${guests}`)
  }

  return (
    <div className="flex items-center bg-white border rounded-full shadow-md px-2 py-2 gap-2 w-full">
      
      {/* LOCAL */}
      <div className="flex-1 px-3 border-r">
        <input
          type="text"
          placeholder="Nome, bairro, cidade, estado..."
          className="w-full outline-none text-sm"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
        />
      </div>

      {/* EVENTO */}
      <div className="flex-1 px-3 border-r">
  <EventTypeDropdown
    value={eventTypes}
    onChange={setEventTypes}
  />
</div>

      {/* CONVIDADOS */}
      <div className="w-[150px] px-3 border-r">
        <input
          type="number"
          placeholder="Convidados"
          className="w-full outline-none text-sm"
          value={guests}
          onChange={(e) => setGuests(e.target.value)}
        />
      </div>

      {/* BOTÃO */}
      <button
        onClick={handleSearch}
        className="bg-black text-white rounded-full p-3 hover:scale-105 transition"
      >
        <Search size={18} />
      </button>
    </div>
  );
}