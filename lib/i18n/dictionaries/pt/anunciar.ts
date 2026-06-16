// Namespace `anunciar` — página /anunciar (landing para proprietários +
// formulário de cadastro de espaço). FONTE DA VERDADE: en/anunciar.ts e
// es/anunciar.ts são tipados por `T` para garantir paridade de chaves.
//
// NOTA: `comodidadesLabels` traduz apenas a EXIBIÇÃO dos chips. O VALOR
// canônico (chave) é mantido em PT e persiste no banco (coluna `comodidades`),
// para não corromper dados entre idiomas.

const anunciar = {
  // ── Metadados (<head>) ──
  meta: {
    title: 'Anuncie seu espaço',
    description:
      'Anuncie seu espaço de eventos na VENTSY e alcance milhares de pessoas procurando o local ideal. Cadastro rápido e gratuito.',
    ogTitle: 'Anuncie seu espaço · VENTSY',
    ogDescription: 'Cadastre seu espaço de eventos e receba solicitações de quem procura o local ideal. Grátis para começar.',
  },

  hero: {
    tag: 'Anuncie grátis',
    titulo: 'Anuncie seu espaço',
    subtitulo: 'Preencha as informações do seu espaço. Ele aparecerá na busca assim que publicado.',
  },
  avisoDeslogadoInicio: 'Você está navegando deslogado.',
  avisoDeslogadoEntre: 'Entre',
  avisoDeslogadoOu: 'ou',
  avisoDeslogadoCriar: 'crie sua conta',
  avisoDeslogadoFim: 'para publicar o anúncio.',
  secaoSobre: {
    titulo: 'Sobre o espaço',
    nomeLabel: 'Nome do espaço *',
    nomePlaceholder: 'Ex: Chácara Recanto Verde',
    categoriaLabel: 'Categoria *',
    categoriaPlaceholder: 'Selecione a categoria',
    descricaoLabel: 'Descrição',
    descricaoPlaceholder: 'Conte o que torna o seu espaço especial...',
  },
  secaoLocalizacao: {
    titulo: 'Localização',
    estadoLabel: 'Estado *',
    estadoPlaceholder: 'UF',
    cidadeLabel: 'Cidade *',
    cidadePlaceholder: 'Cidade',
    bairroLabel: 'Bairro',
    bairroPlaceholder: 'Bairro',
    enderecoLabel: 'Endereço',
    enderecoPlaceholder: 'Rua, número',
    ajuda: 'Usamos cidade e estado para posicionar seu espaço no mapa da busca.',
  },
  secaoCapacidade: {
    titulo: 'Capacidade e preço',
    capacidadeLabel: 'Capacidade (pessoas)',
    capacidadePlaceholder: 'Ex: 150',
    valorHoraLabel: 'Valor por hora (R$)',
    valorHoraPlaceholder: 'Ex: 500',
    valorDiariaLabel: 'Valor da diária (R$)',
    valorDiariaPlaceholder: 'Ex: 3000',
    ajuda: 'Informe ao menos um dos valores.',
  },
  secaoComodidades: {
    titulo: 'Comodidades',
  },
  comodidadesLabels: {
    'Wi-Fi': 'Wi-Fi',
    'Estacionamento': 'Estacionamento',
    'Churrasqueira': 'Churrasqueira',
    'Piscina': 'Piscina',
    'Ar-condicionado': 'Ar-condicionado',
    'Som ambiente': 'Som ambiente',
    'Cozinha equipada': 'Cozinha equipada',
    'Acessibilidade': 'Acessibilidade',
    'Segurança': 'Segurança',
    'Área verde': 'Área verde',
    'Banheiros': 'Banheiros',
    'Gerador': 'Gerador',
  },
  secaoContato: {
    titulo: 'Contato e mídia',
    whatsappLabel: 'WhatsApp',
    whatsappPlaceholder: '(21) 99999-9999',
    fotoLabel: 'Foto de capa',
    fotoPreviewAlt: 'Pré-visualização da foto de capa',
    fotoAjuda: 'JPG, PNG ou WebP, até 8 MB. Você poderá adicionar mais fotos depois, no painel.',
  },
  publicar: 'Publicar espaço',
  publicando: 'Publicando...',
  erros: {
    imagemTipo: 'Selecione um arquivo de imagem (JPG, PNG ou WebP).',
    imagemTamanho: 'A imagem deve ter no máximo 8 MB.',
    nomeCurto: 'Informe o nome do espaço (mín. 3 caracteres).',
    categoria: 'Escolha a categoria do espaço.',
    estado: 'Selecione o estado.',
    cidade: 'Informe a cidade.',
    preco: 'Informe ao menos um preço (por hora ou diária).',
    naoLogado: 'Você precisa estar logado para publicar. Entre ou crie sua conta.',
    publicarPrefixo: 'Não foi possível publicar:',
    publicarGenerico: 'Ocorreu um erro ao publicar. Tente novamente.',
  },
}

export type T = typeof anunciar
export default anunciar
