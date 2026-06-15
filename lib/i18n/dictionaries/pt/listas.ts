// Namespace `listas` — PT-BR (fonte da verdade). en/es são tipados por `T`.
// Vitrine PÚBLICA das Listas Oficiais (curadoria da comunidade). Só texto visível:
// nomes/descrições das listas vêm do banco e NÃO são traduzidos aqui.
const listas = {
  meta: {
    indexTitle: 'Listas Oficiais — guias da comunidade | VENTSY',
    indexDescription:
      'Descubra listas curadas dos melhores espaços e fornecedores para eventos, recomendados pela comunidade VENTSY.',
    indexOgTitle: 'Listas Oficiais — guias da comunidade | VENTSY',
    indexOgDescription:
      'Os melhores espaços e fornecedores para eventos, em listas curadas pela comunidade.',
    // {titulo} interpolado com o nome da lista (vindo do banco).
    detailTitle: '{titulo} — Listas Oficiais | VENTSY',
    detailFallbackDescription:
      'Uma seleção de {n} recomendações para o seu evento, pela comunidade VENTSY.',
    notFound: 'Lista não encontrada — VENTSY',
  },
  index: {
    heroTag: 'Comunidade VENTSY',
    heroTitulo: 'Listas Oficiais',
    heroSub:
      'Guias curados pela comunidade: os melhores espaços e fornecedores para cada tipo de evento, em um só lugar.',
    buscaPlaceholder: 'Buscar listas (ex.: casamento em SP)…',
    buscarBtn: 'Buscar',
    vazioTitulo: 'Ainda não há listas publicadas',
    vazioTexto:
      'As primeiras listas curadas pela comunidade aparecem aqui em breve. Tem um espaço ou conhece bons fornecedores? Crie a sua no painel.',
    vazioCta: 'Criar uma lista',
    destaques: 'Em destaque',
    todas: 'Todas',
    todasAsListas: 'Todas as listas',
    // {n} resultados + contexto opcional ({cat}, {cidade}) já interpolados na página.
    encontradaSingular: '{n} lista encontrada',
    encontradaPlural: '{n} listas encontradas',
    emCategoria: ' em {cat}',
    semFiltro: 'Nenhuma lista para esse filtro.',
    verTodas: 'Ver todas as listas',
    maisPopulares: 'Mais populares',
    porCidade: 'Por cidade',
    crieTitulo: 'Crie a sua lista',
    crieTexto: 'Reúna seus lugares e fornecedores favoritos e compartilhe com a comunidade.',
    crieCta: 'Ir ao painel',
  },
  card: {
    itens: 'itens',
    curtidas: 'curtidas',
    por: 'por',
  },
  detail: {
    breadcrumb: 'Listas Oficiais',
    inicio: 'Início',
    porAutor: 'por',
    itemSingular: 'item',
    itemPlural: 'itens',
    semItens: 'Esta lista ainda não tem itens.',
    relacionadas: 'Listas relacionadas',
    naVentsy: 'na VENTSY',
    verAnuncio: 'Ver anúncio',
    notaAria: 'Nota {v} de 5',
    fallbackItem: 'Item',
  },
  interacoes: {
    curtir: 'Curtir',
    salvar: 'Salvar',
    salva: 'Salva',
    seguirAutor: 'Seguir autor',
    seguindo: 'Seguindo',
    compartilhar: 'Compartilhar',
    curtida: 'Curtida!',
    listaSalva: 'Lista salva no seu perfil.',
    seguindoAutor: 'Você está seguindo este autor.',
    erro: 'Não foi possível registrar. Tente de novo.',
    linkCopiado: 'Link copiado!',
  },
}
export type T = typeof listas
export default listas
