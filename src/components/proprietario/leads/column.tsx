"use client";

import { Droppable, Draggable } from "@hello-pangea/dnd";
import { LeadCard } from "./card";

export function Column({ title, leads, droppableId, onCardClick }: any) {
  return (
    <div className="bg-gray-50 p-3 rounded-xl w-72 flex-shrink-0">

      <h3 className="text-sm font-semibold mb-3">{title}</h3>

      <Droppable droppableId={droppableId}>
        {(provided) => (
          <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-2 min-h-[100px]">

            {leads.map((lead: any, index: number) => (
              <Draggable key={lead.id} draggableId={lead.id} index={index}>
                {(provided) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    {...provided.dragHandleProps}
                  >
                    <LeadCard lead={lead} onClick={onCardClick} />
                  </div>
                )}
              </Draggable>
            ))}

            {provided.placeholder}

          </div>
        )}
      </Droppable>

    </div>
  );
}