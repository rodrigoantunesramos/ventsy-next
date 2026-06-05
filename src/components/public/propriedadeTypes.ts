export type propriedadeType = {
  nome: string;
  emoji: string;
  category: string;
};

export const PROPRIEDADE_TYPES: propriedadeType[] = [
  // 🌿 Natureza
  { nome: 'Sítios', emoji: '🌳', category: 'Natureza' },
  { nome: 'Chácaras', emoji: '🌿', category: 'Natureza' },
  { nome: 'Fazendas', emoji: '🐄', category: 'Natureza' },
  { nome: 'Haras', emoji: '🐎', category: 'Natureza' },
  { nome: 'Acampamentos', emoji: '⛺', category: 'Natureza' },

  // 🏙️ Urbano
  { nome: 'Rooftops', emoji: '🌆', category: 'Urbano' },
  { nome: 'Coworkings', emoji: '💼', category: 'Urbano' },
  { nome: 'Galeria de Arte', emoji: '🖼️', category: 'Urbano' },
  { nome: 'Museus', emoji: '🏛️', category: 'Urbano' },

  // 🎉 Eventos
  { nome: 'Casas de Festas', emoji: '🏠', category: 'Eventos' },
  { nome: 'Salão de Festas', emoji: '🎊', category: 'Eventos' },
  { nome: 'Espaço Gourmet', emoji: '👨‍🍳', category: 'Eventos' },
  { nome: 'Auditórios', emoji: '🎤', category: 'Eventos' },
  { nome: 'Centros de Convenções e Galpões', emoji: '🏭', category: 'Eventos' },

  // 🍸 Lifestyle
  { nome: 'Bares e Restaurantes', emoji: '🍽️', category: 'Lifestyle' },
  { nome: 'Beach Clubs', emoji: '🏖️', category: 'Lifestyle' },
  { nome: 'Clubes', emoji: '🏊', category: 'Lifestyle' },

  // 🏨 Hospedagem
  { nome: 'Hotéis, Pousadas e Resorts', emoji: '🏨', category: 'Hospedagem' },
  { nome: 'Lofts', emoji: '🏢', category: 'Hospedagem' },
  { nome: 'Casa', emoji: '🏡', category: 'Hospedagem' },
  { nome: 'Mansões', emoji: '🏛️', category: 'Hospedagem' },

  // 🚤 Náutico
  { nome: 'Iates', emoji: '⛵', category: 'Náutico' },
  { nome: 'Lanchas', emoji: '🚤', category: 'Náutico' },
  { nome: 'Escuna', emoji: '⛴️', category: 'Náutico' },

  // 🎭 Cultura
  { nome: 'Teatros', emoji: '🎭', category: 'Cultura' },
  { nome: 'Arena', emoji: '🏟️', category: 'Cultura' },
  { nome: 'Estádios', emoji: '⚽', category: 'Cultura' },

  // 🍷 Premium
  { nome: 'Vinicolas', emoji: '🍷', category: 'Premium' },
];