"use client";

import { DragDropContext } from "@hello-pangea/dnd";
import { useState } from "react";
import { Column } from "./column";
import { LeadModal } from "./lead-modal";
import { useApp } from "@/context/app-context";

export function KanbanBoard() {
  const { addEvento, addReceita, bloquearData, isDataDisponivel } = useApp();

  const [data, setData] = useState({
    negociacao: [
      { id: "1", evento: "Casamento João", cliente: "João", data: "12/03" },
    ],
    contratado: [
      { id: "2", evento: "Evento XP", cliente: "Maria", data: "20/03" },
    ],
    finalizado: [],
    perdido: [
      { id: "3", evento: "Aniversário", cliente: "Carlos", data: "25/03" },
    ],
  });

  const [selectedLead, setSelectedLead] = useState<any>(null);

  // 🔥 DRAG
  function onDragEnd(result: any) {
    const { source, destination } = result;

    if (!destination) return;

    const sourceCol = data[source.droppableId as keyof typeof data];
    const destCol = data[destination.droppableId as keyof typeof data];

    const sourceItems = [...sourceCol];
    const destItems = [...destCol];

    const [movedItem] = sourceItems.splice(source.index, 1);

    destItems.splice(destination.index, 0, movedItem);

    setData({
      ...data,
      [source.droppableId]: sourceItems,
      [destination.droppableId]: destItems,
    });
  }

  // 🔥 CLICK CARD
  function handleCardClick(lead: any) {
    setSelectedLead(lead);
  }

  // 🔥 REMOVE LEAD
  function removeLead(leadId: string) {
    const newData: any = {};

    for (const col in data) {
      newData[col] = data[col as keyof typeof data].filter(
        (l: any) => l.id !== leadId
      );
    }

    setData(newData);
  }

  // 🔥 CONVERTER
function handleConvert(lead: any) {
  // 🚫 validação
  if (!isDataDisponivel(lead.data)) {
    alert("Já existe um evento nessa data!");
    return;
  }

  const novoEvento = {
    id: Date.now().toString(),
    nome: lead.evento,
    cliente: lead.cliente,
    data: lead.data,
    local: "A definir",
    valor: 0,
    status: "confirmado",
  };

  addEvento(novoEvento);

  addReceita({
    id: Date.now().toString(),
    data: lead.data,
    descricao: lead.evento,
    categoria: "Aluguel de espaço",
    evento: lead.evento,
    status: "pendente",
    valor: 0,
  });

  bloquearData(lead.data, novoEvento);

  removeLead(lead.id);

  setSelectedLead(null);
}

  return (
    <>
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-4">
          {Object.entries(data).map(([columnId, leads]) => (
            <Column
              key={columnId}
              title={columnId.charAt(0).toUpperCase() + columnId.slice(1)}
              droppableId={columnId}
              leads={leads}
              onCardClick={handleCardClick}
            />
          ))}
        </div>
      </DragDropContext>

      {/* 🔥 MODAL */}
      {selectedLead && (
        <LeadModal
          lead={selectedLead}
          onClose={() => setSelectedLead(null)}
          onConvert={() => handleConvert(selectedLead)}
        />
      )}
    </>
  );
}