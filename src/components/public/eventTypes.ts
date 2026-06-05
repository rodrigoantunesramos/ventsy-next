// Tipagem (recomendado)
export type EventType = {
  id: string;
  name: string;
  category: string;
};

// Lista flat (ideal para banco e filtros)
export const EVENT_TYPES: EventType[] = [
  // Sociais & Celebrações
  { id: "casamento", name: "Casamento", category: "sociais" },
  { id: "noivado", name: "Noivado", category: "sociais" },
  { id: "aniversario", name: "Aniversário", category: "sociais" },
  { id: "festa-infantil", name: "Festa Infantil", category: "sociais" },
  { id: "cha-de-bebe", name: "Chá de Bebê", category: "sociais" },
  { id: "cha-revelacao", name: "Chá Revelação", category: "sociais" },
  { id: "debutante", name: "Debutante", category: "sociais" },

  // Corporativo
  { id: "reuniao", name: "Reunião", category: "corporativos" },
  { id: "treinamento", name: "Treinamento", category: "corporativos" },
  { id: "conferencia", name: "Conferência", category: "corporativos" },
  { id: "seminario", name: "Seminário", category: "corporativos" },
  { id: "workshop", name: "Workshop", category: "corporativos" },
  { id: "palestra", name: "Palestra", category: "corporativos" },
  { id: "congresso", name: "Congresso", category: "corporativos" },
  { id: "hackathon", name: "Hackathon", category: "corporativos" },
  { id: "lancamento", name: "Lançamento", category: "corporativos" },
  { id: "popup-store", name: "Pop-up Store", category: "corporativos" },
  { id: "happy-hour", name: "Happy Hour", category: "corporativos" },
  { id: "confraternizacao", name: "Confraternização", category: "corporativos" },
  { id: "field-day", name: "Field Day", category: "corporativos" },

  // Acadêmico
  { id: "formatura", name: "Formatura", category: "academicos" },
  { id: "colacao-de-grau", name: "Colação de Grau", category: "academicos" },
  { id: "apresentacoes", name: "Apresentações", category: "academicos" },

  // Religioso
  { id: "batizado", name: "Batizado", category: "religiosos" },
  { id: "encontro-religioso", name: "Encontro Religioso", category: "religiosos" },
  { id: "vigilia", name: "Vigília", category: "religiosos" },
  { id: "retiro", name: "Retiro", category: "religiosos" },

  // Entretenimento
  { id: "show", name: "Show", category: "entretenimento" },
  { id: "festival", name: "Festival", category: "entretenimento" },
  { id: "teatro", name: "Teatro", category: "entretenimento" },
  { id: "exposicao", name: "Exposição", category: "entretenimento" },
  { id: "vernissage", name: "Vernissage", category: "entretenimento" },

  // Esportivo & Outdoor
  { id: "torneios", name: "Torneios", category: "esportivo" },
  { id: "dia-de-campo", name: "Dia de Campo", category: "esportivo" },
  { id: "acampamento", name: "Acampamento", category: "esportivo" },
  { id: "motocross", name: "Motocross", category: "esportivo" },
  { id: "radical", name: "Radical", category: "esportivo" },
  { id: "futebol", name: "Futebol", category: "esportivo" },
  { id: "pesca", name: "Pesca", category: "esportivo" },
];

export function groupEventsByCategory(events: EventType[]) {
  return events.reduce<Record<string, EventType[]>>((acc, event) => {
    if (!acc[event.category]) {
      acc[event.category] = [];
    }
    acc[event.category].push(event);
    return acc;
  }, {});
}

export const CATEGORY_LABELS: Record<string, string> = {
  sociais: "Sociais & Celebrações",
  corporativos: "Corporativo",
  academicos: "Acadêmico",
  religiosos: "Religioso",
  entretenimento: "Entretenimento",
  esportivo: "Esportivo & Outdoor",
};