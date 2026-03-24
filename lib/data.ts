export const CATS = [
  { nome: 'Casas de Festas', emoji: '🏠' },
  { nome: 'Sítios', emoji: '🌳' },
  { nome: 'Acampamentos', emoji: '⛺' },
  { nome: 'Bares e Restaurantes', emoji: '🍽️' },
  { nome: 'Beach Clubs', emoji: '🏖️' },
  { nome: 'Centros de Convenções e Galpões', emoji: '🏭' },
  { nome: 'Clubes', emoji: '🏊' },
  { nome: 'Hotéis, Pousadas e Resorts', emoji: '🏨' },
  { nome: 'Rooftops', emoji: '🌆' },
  { nome: 'Teatros', emoji: '🎭' },
  { nome: 'Chácaras', emoji: '🌿' },
  { nome: 'Fazendas', emoji: '🐄' },
  { nome: 'Casa', emoji: '🏡' },
  { nome: 'Salão de Festas', emoji: '🎊' },
  { nome: 'Mansões', emoji: '🏛️' },
  { nome: 'Espaço Gourmet', emoji: '👨‍🍳' },
  { nome: 'Lofts', emoji: '🏢' },
  { nome: 'Espaço Industrial', emoji: '🏗️' },
  { nome: 'Arena', emoji: '🏟️' },
  { nome: 'Estádios', emoji: '⚽' },
  { nome: 'Auditórios', emoji: '🎤' },
  { nome: 'Coworkings', emoji: '💼' },
  { nome: 'Galeria de Arte', emoji: '🖼️' },
  { nome: 'Museus', emoji: '🏛️' },
  { nome: 'Vinicolas', emoji: '🍷' },
  { nome: 'Iates', emoji: '⛵' },
  { nome: 'Lanchas', emoji: '🚤' },
  { nome: 'Escuna', emoji: '⛴️' },
  { nome: 'Haras', emoji: '🐎' },
]

export const ESTADOS = [
  { n: 'Acre', s: 'AC' }, { n: 'Alagoas', s: 'AL' }, { n: 'Amapá', s: 'AP' },
  { n: 'Amazonas', s: 'AM' }, { n: 'Bahia', s: 'BA' }, { n: 'Ceará', s: 'CE' },
  { n: 'Distrito Federal', s: 'DF' }, { n: 'Espírito Santo', s: 'ES' },
  { n: 'Goiás', s: 'GO' }, { n: 'Maranhão', s: 'MA' }, { n: 'Mato Grosso', s: 'MT' },
  { n: 'Mato Grosso do Sul', s: 'MS' }, { n: 'Minas Gerais', s: 'MG' },
  { n: 'Pará', s: 'PA' }, { n: 'Paraíba', s: 'PB' }, { n: 'Paraná', s: 'PR' },
  { n: 'Pernambuco', s: 'PE' }, { n: 'Piauí', s: 'PI' }, { n: 'Rio de Janeiro', s: 'RJ' },
  { n: 'Rio Grande do Norte', s: 'RN' }, { n: 'Rio Grande do Sul', s: 'RS' },
  { n: 'Rondônia', s: 'RO' }, { n: 'Roraima', s: 'RR' }, { n: 'Santa Catarina', s: 'SC' },
  { n: 'São Paulo', s: 'SP' }, { n: 'Sergipe', s: 'SE' }, { n: 'Tocantins', s: 'TO' },
]

export const EVENTOS_CATS = [
  {
    label: '🏢 Corporativo', items: [
      { v: 'Reunião', emoji: '📋', label: 'Reunião' },
      { v: 'Workshop', emoji: '🛠️', label: 'Workshop' },
      { v: 'Treinamento', emoji: '📚', label: 'Treinamento' },
      { v: 'Palestra', emoji: '🎙️', label: 'Palestra' },
      { v: 'Conferência', emoji: '🤝', label: 'Conferência' },
      { v: 'Congresso', emoji: '🏛️', label: 'Congresso' },
      { v: 'Seminário', emoji: '📖', label: 'Seminário' },
      { v: 'Hackathon', emoji: '💻', label: 'Hackathon' },
      { v: 'Happy Hour', emoji: '🥂', label: 'Happy Hour' },
      { v: 'Confraternização', emoji: '🎉', label: 'Confraternização' },
      { v: 'Lançamento de Produto', emoji: '🚀', label: 'Lançamento' },
      { v: 'Field Day', emoji: '🌤️', label: 'Field Day' },
      { v: 'Pop-up Store', emoji: '🛍️', label: 'Pop-up Store' },
    ]
  },
  {
    label: '🐴 Cavalo', items: [
      { v: 'Provas Hípicas', emoji: '🏇', label: 'Provas Hípicas' },
      { v: 'Torneios', emoji: '🏆', label: 'Torneios' },
      { v: 'Leilão', emoji: '🔨', label: 'Leilão' },
      { v: 'Dia de Campo', emoji: '🌾', label: 'Dia de Campo' },
    ]
  },
  {
    label: '🎣 Pescaria', items: [
      { v: 'Pescaria', emoji: '🎣', label: 'Pescaria' },
      { v: 'Acampamento', emoji: '⛺', label: 'Acampamento' },
      { v: 'Retiro', emoji: '🌿', label: 'Retiro' },
    ]
  },
  {
    label: '🪂 Radicais', items: [
      { v: 'Radical', emoji: '🪂', label: 'Radical' },
      { v: 'Encontro de Motos', emoji: '🏍️', label: 'Motos' },
      { v: 'Futebol', emoji: '⚽', label: 'Futebol' },
    ]
  },
  {
    label: '🥂 Sociais & Celebrações', items: [
      { v: 'Casamento', emoji: '💍', label: 'Casamento' },
      { v: 'Noivado', emoji: '💒', label: 'Noivado' },
      { v: 'Renovação de Votos', emoji: '🌹', label: 'Renovação Votos' },
      { v: 'Bodas', emoji: '👫', label: 'Bodas' },
      { v: 'Festa de Aniversário', emoji: '🎂', label: 'Aniversário' },
      { v: 'Festa Infantil', emoji: '🎈', label: 'Festa Infantil' },
      { v: 'Debutante', emoji: '👑', label: 'Debutante' },
      { v: 'Chá de Bebê', emoji: '👶', label: 'Chá de Bebê' },
      { v: 'Chá Revelação', emoji: '🎀', label: 'Chá Revelação' },
    ]
  },
  {
    label: '🎓 Acadêmico', items: [
      { v: 'Formatura', emoji: '🎓', label: 'Formatura' },
      { v: 'Colação de Grau', emoji: '📜', label: 'Colação de Grau' },
      { v: 'Amostras', emoji: '🔬', label: 'Amostras' },
      { v: 'Apresentações', emoji: '📊', label: 'Apresentações' },
    ]
  },
  {
    label: '✝️ Religioso', items: [
      { v: 'Batizado', emoji: '🕊️', label: 'Batizado' },
      { v: 'Vigilia', emoji: '🕯️', label: 'Vigília' },
      { v: 'Encontro Religioso', emoji: '🙏', label: 'Encontro Religioso' },
    ]
  },
  {
    label: '🎵 Entretenimento', items: [
      { v: 'Show', emoji: '🎵', label: 'Show' },
      { v: 'Festival', emoji: '🎪', label: 'Festival' },
      { v: 'Apresentações', emoji: '🎭', label: 'Teatro' },
    ]
  },
  {
    label: '✨ Estilo de Vida', items: [
      { v: 'Ensaio Fotográfico', emoji: '📸', label: 'Ensaio' },
      { v: 'Vernissage', emoji: '🖼️', label: 'Vernissage' },
      { v: 'Exposição', emoji: '🏛️', label: 'Exposição' },
    ]
  },
]

export const DEMO_PROPS = [
  { id: 'd1', nome: 'Chácara Macacu', cidade: 'Cachoeiras de Macacu, RJ', preco: 3000, nota_media: 4.9, _plano: 'ultra', categoria: 'Sítios', imagem_url: 'https://picsum.photos/seed/chacara1/420/320' },
  { id: 'd2', nome: 'Sítio Verde Vale', cidade: 'Guapimirim, RJ', preco: 2200, nota_media: 4.7, _plano: 'pro', categoria: 'Sítios', imagem_url: 'https://picsum.photos/seed/chacara2/420/320' },
  { id: 'd3', nome: 'Sítio Brisa', cidade: 'Petrópolis, RJ', preco: 1900, nota_media: 4.5, _plano: 'pro', categoria: 'Sítios', imagem_url: 'https://picsum.photos/seed/chacara3/420/320' },
  { id: 'd4', nome: 'Chácara das Flores', cidade: 'Teresópolis, RJ', preco: 1800, nota_media: 4.3, _plano: 'basico', categoria: 'Sítios', imagem_url: 'https://picsum.photos/seed/chacara4/420/320' },
  { id: 'd5', nome: 'Espaço Aquarela', cidade: 'Petrópolis, RJ', preco: 3200, nota_media: 4.8, _plano: 'ultra', categoria: 'Casas de Festas', imagem_url: 'https://picsum.photos/seed/salao1/420/320' },
  { id: 'd6', nome: 'Salão Primavera', cidade: 'Nova Friburgo, RJ', preco: 1500, nota_media: 4.4, _plano: 'pro', categoria: 'Casas de Festas', imagem_url: 'https://picsum.photos/seed/salao2/420/320' },
  { id: 'd7', nome: 'Espaço Garden', cidade: 'Niterói, RJ', preco: 2100, nota_media: 4.2, _plano: 'basico', categoria: 'Casas de Festas', imagem_url: 'https://picsum.photos/seed/salao3/420/320' },
  { id: 'd8', nome: 'Rooftop 360°', cidade: 'Rio de Janeiro, RJ', preco: 5000, nota_media: 5.0, _plano: 'ultra', categoria: 'Rooftops', imagem_url: 'https://picsum.photos/seed/roof1/420/320' },
  { id: 'd9', nome: 'Sky Lounge', cidade: 'São Paulo, SP', preco: 4200, nota_media: 4.9, _plano: 'pro', categoria: 'Rooftops', imagem_url: 'https://picsum.photos/seed/roof2/420/320' },
  { id: 'd10', nome: 'Terraço Carioca', cidade: 'Rio de Janeiro, RJ', preco: 3800, nota_media: 4.6, _plano: 'basico', categoria: 'Rooftops', imagem_url: 'https://picsum.photos/seed/roof3/420/320' },
]

export function pesoPlano(p: string) { return p === 'ultra' ? 0 : p === 'pro' ? 1 : 2 }

export function ordenar(lista: { _plano?: string; _nota?: string; nome?: string }[]) {
  return [...lista].sort((a, b) => {
    const dp = pesoPlano(a._plano) - pesoPlano(b._plano)
    if (dp !== 0) return dp
    const dn = parseFloat(b._nota) - parseFloat(a._nota)
    if (dn !== 0) return dn
    return (a.nome || '').localeCompare(b.nome || '', 'pt-BR')
  })
}

export function norm(s: string) {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}
