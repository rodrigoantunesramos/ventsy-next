"use client";

import { useState, useRef, useEffect } from "react";
import {
  EVENT_TYPES,
  groupEventsByCategory,
  CATEGORY_LABELS,
} from "@/components/public/eventTypes";

import {
  PartyPopper,
  Briefcase,
  GraduationCap,
  Church,
  Ticket,
  Dumbbell,
} from "lucide-react";

const CATEGORY_ICONS: Record<string, any> = {
  sociais: PartyPopper,
  corporativos: Briefcase,
  academicos: GraduationCap,
  religiosos: Church,
  entretenimento: Ticket,
  esportivo: Dumbbell,
};

export function EventTypeDropdown({
  value,
  onChange,
}: {
  value: string[];
  onChange: (value: string[]) => void;
}) {
  const [open, setOpen] = useState(false);

  // ✅ hooks SEMPRE dentro do componente
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const grouped = groupEventsByCategory(EVENT_TYPES);

  function toggleEvent(id: string) {
    if (value.includes(id)) {
      onChange(value.filter((v) => v !== id));
    } else {
      onChange([...value, id]);
    }
  }

  return (
    <div ref={ref} className="relative">
      
      {/* BOTÃO */}
      <button
        onClick={() => setOpen(!open)}
        className="text-sm w-full text-left flex flex-wrap gap-1"
      >
        {value.length === 0 && "Tipo de evento"}

        {value.map((id) => {
          const event = EVENT_TYPES.find((e) => e.id === id);
          return (
            <span
              key={id}
              className="bg-gray-100 px-2 py-1 rounded-md text-xs"
            >
              {event?.name}
            </span>
          );
        })}
      </button>

      {/* DROPDOWN */}
      {open && (
        <div className="absolute top-12 left-0 w-[420px] bg-white rounded-3xl shadow-2xl p-5 z-50 border border-gray-100">
          
          <div className="max-h-[320px] overflow-y-auto space-y-6 pr-1">
            
            {Object.entries(grouped).map(([category, events]) => {
              const Icon = CATEGORY_ICONS[category];

              return (
                <div key={category}>
                  
                  {/* CATEGORIA */}
                  <div className="flex items-center justify-center gap-2 mb-3 bg-gray-50 py-2 rounded-lg">
                    {Icon && <Icon size={14} className="text-gray-400" />}
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      {CATEGORY_LABELS[category]}
                    </p>
                  </div>

                  {/* GRID */}
                  <div className="grid grid-cols-2 gap-2">
                    {events.map((event) => {
                      const isActive = value.includes(event.id);

                      return (
                        <button
                          key={event.id}
                          onClick={() => toggleEvent(event.id)}
                          className={`
                            text-sm text-left px-4 py-2.5 rounded-xl transition-all
                            ${isActive
                              ? "bg-black text-white shadow-md scale-[1.02]"
                              : "bg-gray-50 hover:bg-gray-100 text-gray-700"
                            }
                          `}
                        >
                          {event.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}