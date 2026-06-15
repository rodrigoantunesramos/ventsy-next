// Namespace `busca` — página /busca (listagem de espaços + filtros + mapa).
// FONTE DA VERDADE: en/busca.ts e es/busca.ts são tipados por `T` para garantir
// paridade de chaves.
//
// NOTA: os VALORES de categorias/tipos de evento (chaves de dado em @/lib/data e
// FilterModal) NÃO são traduzidos aqui — apenas texto de UI visível.

const busca = {
  meta: {
    // Templates de title/description — {local}/{tipo} são interpolados no servidor.
    tituloCidade: 'Espaços para eventos em {local}',
    tituloEstado: 'Espaços para eventos em {estado}',
    tituloTipo: 'Espaços para {tipo}',
    tituloPadrao: 'Buscar espaços para eventos',
    descComLocal:
      'Encontre e compare espaços para eventos em {local}: casas de festa, sítios, salões, rooftops e mais. Filtre por capacidade, preço e tipo de evento na {site}.',
    descSemLocal:
      'Encontre e compare espaços para eventos no Brasil{tipo}. Filtre por cidade, capacidade e tipo de evento na {site}.',
    descSemLocalTipo: ' para {tipo}',
  },
  // Título da listagem (H1) — variações por filtro de localização/tipo.
  tituloCidade: 'Espaços em {cidade}',
  tituloCidadeEstado: 'Espaços em {cidade}, {estado}',
  tituloEstado: 'Espaços em {estado}',
  tituloTodos: 'Todos os espaços',
  filtrosBtn: 'Filtros',
  limparFiltros: 'Limpar filtros',
  // Contador de resultados — {n} é a contagem.
  resultadoUm: '{n} espaço encontrado',
  resultadoVarios: '{n} espaços encontrados',
  carregando: 'Carregando...',
  vazioTitulo: '😕 Nenhum espaço encontrado',
  vazioTexto: 'Tente ajustar os filtros ou buscar em outra região.',
  vazioBotao: 'Ver todos os espaços',
  // Botão "carregar mais" — {n} é quantos restam.
  carregarMais: 'Carregar mais ({n} restantes)',
  // Rótulo do marcador no mapa quando não há preço.
  mapaVer: 'Ver',
  filtros: {
    titulo: 'Filtros',
    fechar: 'Fechar',
    localizacao: 'Localização',
    todosEstados: 'Todos os estados',
    todasCidades: 'Todas as cidades',
    selecioneEstado: 'Selecione um estado primeiro',
    carregandoCidades: 'Carregando...',
    faixaPreco: 'Faixa de preço — por hora',
    minimo: 'Mínimo',
    maximo: 'Máximo',
    capacidade: 'Capacidade mínima',
    qualquerTamanho: 'Qualquer tamanho',
    capacidadeMin: 'Mínimo {n} convidados',
    servicos: 'Serviços oferecidos',
    servClimatizado: '❄️ Climatizado',
    servEstacionamento: '🅿️ Estacionamento gratuito',
    servSeguranca: '🛡️ Segurança',
    servEspacoAberto: '🌳 Espaço aberto',
    tipoPropriedade: 'Tipo de Propriedade',
    tipoEvento: 'Tipo de Evento',
    destaques: 'Destaques',
    apenasPremium: '✦ Apenas propriedades premium',
    som: 'Som',
    somAlto: 'Permite som alto',
    somTarde: 'Permite som até tarde',
    acessibilidade: 'Acessibilidade',
    necessitaAcessibilidade: 'Necessita de acessibilidade?',
    removerTodos: 'Remover todos',
    mostrarResultados: 'Mostrar resultados',
  },
}

export type T = typeof busca
export default busca
