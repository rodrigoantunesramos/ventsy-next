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
  { id: 'd1', nome: 'Chácara Macacu', cidade: 'Cachoeiras de Macacu, RJ', preco: 3000, nota_media: 4.9, _plano: 'ultra', categoria: 'Sítios', imagem_url: 'https://picsum.photos/seed/chacara1/420/320', latitude: -22.46, longitude: -42.65 },
  { id: 'd2', nome: 'Sítio Verde Vale', cidade: 'Guapimirim, RJ', preco: 2200, nota_media: 4.7, _plano: 'pro', categoria: 'Sítios', imagem_url: 'https://picsum.photos/seed/chacara2/420/320', latitude: -22.535, longitude: -42.99 },
  { id: 'd3', nome: 'Sítio Brisa', cidade: 'Petrópolis, RJ', preco: 1900, nota_media: 4.5, _plano: 'pro', categoria: 'Sítios', imagem_url: 'https://picsum.photos/seed/chacara3/420/320', latitude: -22.505, longitude: -43.178 },
  { id: 'd4', nome: 'Chácara das Flores', cidade: 'Teresópolis, RJ', preco: 1800, nota_media: 4.3, _plano: 'basico', categoria: 'Sítios', imagem_url: 'https://picsum.photos/seed/chacara4/420/320', latitude: -22.412, longitude: -42.966 },
  { id: 'd5', nome: 'Espaço Aquarela', cidade: 'Petrópolis, RJ', preco: 3200, nota_media: 4.8, _plano: 'ultra', categoria: 'Casas de Festas', imagem_url: 'https://picsum.photos/seed/salao1/420/320', latitude: -22.512, longitude: -43.19 },
  { id: 'd6', nome: 'Salão Primavera', cidade: 'Nova Friburgo, RJ', preco: 1500, nota_media: 4.4, _plano: 'pro', categoria: 'Casas de Festas', imagem_url: 'https://picsum.photos/seed/salao2/420/320', latitude: -22.282, longitude: -42.531 },
  { id: 'd7', nome: 'Espaço Garden', cidade: 'Niterói, RJ', preco: 2100, nota_media: 4.2, _plano: 'basico', categoria: 'Casas de Festas', imagem_url: 'https://picsum.photos/seed/salao3/420/320', latitude: -22.883, longitude: -43.103 },
  { id: 'd8', nome: 'Rooftop 360°', cidade: 'Rio de Janeiro, RJ', preco: 5000, nota_media: 5.0, _plano: 'ultra', categoria: 'Rooftops', imagem_url: 'https://picsum.photos/seed/roof1/420/320', latitude: -22.911, longitude: -43.176 },
  { id: 'd9', nome: 'Sky Lounge', cidade: 'São Paulo, SP', preco: 4200, nota_media: 4.9, _plano: 'pro', categoria: 'Rooftops', imagem_url: 'https://picsum.photos/seed/roof2/420/320', latitude: -23.55, longitude: -46.633 },
  { id: 'd10', nome: 'Terraço Carioca', cidade: 'Rio de Janeiro, RJ', preco: 3800, nota_media: 4.6, _plano: 'basico', categoria: 'Rooftops', imagem_url: 'https://picsum.photos/seed/roof3/420/320', latitude: -22.971, longitude: -43.186 },
]

export function pesoPlano(p: string) { return p === 'ultra' ? 0 : p === 'pro' ? 1 : 2 }

export function ordenar<T extends { _plano?: string; _nota?: string; nome?: string }>(lista: T[]): T[] {
  return [...lista].sort((a, b) => {
    const dp = pesoPlano(a._plano ?? '') - pesoPlano(b._plano ?? '')
    if (dp !== 0) return dp
    const dn = parseFloat(b._nota ?? '0') - parseFloat(a._nota ?? '0')
    if (dn !== 0) return dn
    return (a.nome || '').localeCompare(b.nome || '', 'pt-BR')
  })
}

export function norm(s: string) {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

// \u2500\u2500 Comodidades (lista can\u00f4nica, estilo Airbnb) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// `slug` \u00e9 o que vai gravado no array `propriedades.comodidades` (lido pela busca
// e pela vitrine). `boolCol`, quando presente, \u00e9 a coluna boolean que a busca
// tamb\u00e9m filtra (sincronizada a partir do mesmo item). Os slugs `climatizado`,
// `estacionamento`, `seguranca` e `espaco-aberto` casam os filtros de array da busca.
export type ComodidadeBoolCol = 'climatizado' | 'estacionamento' | 'acessibilidade' | 'som_alto' | 'som_tarde'
export type Comodidade = { slug: string; label: string; emoji: string; grupo: string; boolCol?: ComodidadeBoolCol }

export const COMODIDADES: Comodidade[] = [
  { slug: 'climatizado', label: 'Climatizado / Ar-condicionado', emoji: '\u2744\ufe0f', grupo: 'Estrutura & Conforto', boolCol: 'climatizado' },
  { slug: 'wifi', label: 'Wi-Fi', emoji: '\ud83d\udcf6', grupo: 'Estrutura & Conforto' },
  { slug: 'cozinha-equipada', label: 'Cozinha equipada', emoji: '\ud83c\udf73', grupo: 'Estrutura & Conforto' },
  { slug: 'mobiliado', label: 'Mobiliado (mesas e cadeiras)', emoji: '\ud83e\ude91', grupo: 'Estrutura & Conforto' },
  { slug: 'gerador', label: 'Gerador de energia', emoji: '\ud83d\udd0c', grupo: 'Estrutura & Conforto' },
  { slug: 'banheiros-amplos', label: 'Banheiros amplos', emoji: '\ud83d\udebb', grupo: 'Estrutura & Conforto' },
  { slug: 'fraldario', label: 'Frald\u00e1rio', emoji: '\ud83c\udf7c', grupo: 'Estrutura & Conforto' },
  { slug: 'vestiario', label: 'Vesti\u00e1rio / Camarim', emoji: '\ud83d\udc57', grupo: 'Estrutura & Conforto' },

  { slug: 'espaco-aberto', label: 'Espa\u00e7o aberto / ao ar livre', emoji: '\ud83c\udf33', grupo: '\u00c1reas & Lazer' },
  { slug: 'piscina', label: 'Piscina', emoji: '\ud83c\udfca', grupo: '\u00c1reas & Lazer' },
  { slug: 'churrasqueira', label: 'Churrasqueira', emoji: '\ud83c\udf56', grupo: '\u00c1reas & Lazer' },
  { slug: 'jardim', label: 'Jardim', emoji: '\ud83c\udf37', grupo: '\u00c1reas & Lazer' },
  { slug: 'area-kids', label: '\u00c1rea kids', emoji: '\ud83e\uddd2', grupo: '\u00c1reas & Lazer' },
  { slug: 'palco', label: 'Palco', emoji: '\ud83c\udfa4', grupo: '\u00c1reas & Lazer' },
  { slug: 'pista-danca', label: 'Pista de dan\u00e7a', emoji: '\ud83d\udc83', grupo: '\u00c1reas & Lazer' },
  { slug: 'vista-panoramica', label: 'Vista panor\u00e2mica', emoji: '\ud83c\udf05', grupo: '\u00c1reas & Lazer' },

  { slug: 'estacionamento', label: 'Estacionamento', emoji: '\ud83c\udd7f\ufe0f', grupo: 'Estacionamento & Acesso', boolCol: 'estacionamento' },
  { slug: 'valet', label: 'Valet', emoji: '\ud83d\ude97', grupo: 'Estacionamento & Acesso' },
  { slug: 'acessibilidade', label: 'Acessibilidade (PCD)', emoji: '\u267f', grupo: 'Estacionamento & Acesso', boolCol: 'acessibilidade' },

  { slug: 'seguranca', label: 'Seguran\u00e7a / Portaria', emoji: '\ud83d\udee1\ufe0f', grupo: 'Seguran\u00e7a' },
  { slug: 'cftv', label: 'C\u00e2meras (CFTV)', emoji: '\ud83d\udcf9', grupo: 'Seguran\u00e7a' },
  { slug: 'brigadista', label: 'Brigadista / Sa\u00edda de emerg\u00eancia', emoji: '\ud83e\uddef', grupo: 'Seguran\u00e7a' },

  { slug: 'som-profissional', label: 'Som profissional / DJ', emoji: '\ud83c\udf9a\ufe0f', grupo: 'Som & Regras' },
  { slug: 'som-alto', label: 'Permite som alto', emoji: '\ud83d\udd0a', grupo: 'Som & Regras', boolCol: 'som_alto' },
  { slug: 'som-tarde', label: 'Som permitido at\u00e9 mais tarde', emoji: '\ud83c\udf19', grupo: 'Som & Regras', boolCol: 'som_tarde' },

  { slug: 'buffet-proprio', label: 'Buffet pr\u00f3prio', emoji: '\ud83c\udf7d\ufe0f', grupo: 'Servi\u00e7os' },
  { slug: 'permite-buffet-externo', label: 'Permite buffet externo', emoji: '\ud83e\udd1d', grupo: 'Servi\u00e7os' },
  { slug: 'permite-pet', label: 'Pet friendly', emoji: '\ud83d\udc3e', grupo: 'Servi\u00e7os' },
  { slug: 'hospedagem', label: 'Hospedagem no local', emoji: '\ud83d\udecf\ufe0f', grupo: 'Servi\u00e7os' },
]

export const COMODIDADES_GRUPOS: string[] = COMODIDADES.reduce<string[]>((acc, c) => {
  if (!acc.includes(c.grupo)) acc.push(c.grupo)
  return acc
}, [])

const COMODIDADE_BY_SLUG = new Map(COMODIDADES.map((c) => [c.slug, c]))

/** R\u00f3tulo amig\u00e1vel (emoji + nome) a partir do slug; cai no slug cru se desconhecido. */
export function comodidadeLabel(slug: string): string {
  const c = COMODIDADE_BY_SLUG.get(slug)
  return c ? `${c.emoji} ${c.label}` : slug
}
