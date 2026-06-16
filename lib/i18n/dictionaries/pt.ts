// Dicionário PT-BR — FONTE DA VERDADE do i18n.
// en.ts e es.ts são tipados por `Dictionary = typeof pt`, então qualquer chave
// faltando (ou sobrando) nesses arquivos quebra o build — garantia de paridade.
// Mantido SEM `as const` de propósito: os valores devem ser `string`, não
// literais, para que as traduções possam diferir.

import auth from './pt/auth'
import planos from './pt/planos'
import cadastro from './pt/cadastro'
import anunciar from './pt/anunciar'
import comoFunciona from './pt/comoFunciona'
import busca from './pt/busca'
import propriedade from './pt/propriedade'
import legal from './pt/legal'
import listas from './pt/listas'
import vagas from './pt/vagas'
import dados from './pt/dados'

const pt = {
  common: {
    entrar: 'Entrar',
    cadastrar: 'Cadastrar',
    cadastreSe: 'Cadastre-se',
    painel: 'Painel',
    menu: 'Menu',
    abrirMenu: 'Abrir menu',
    fechar: 'Fechar',
    voltar: 'Voltar',
    carregando: 'Carregando…',
    enviar: 'Enviar',
    enviando: 'Enviando…',
    cancelar: 'Cancelar',
    salvar: 'Salvar',
    salvando: 'Salvando…',
    buscar: 'Buscar',
    continuar: 'Continuar',
    verMais: 'Ver mais',
    verTodos: 'Ver todos',
    carregarMais: 'Carregar mais',
    erroGenerico: 'Algo deu errado. Tente novamente.',
    paginaNaoEncontrada: 'Página não encontrada.',
    voltarInicio: 'Voltar ao início',
  },
  header: {
    anuncieSeuEspaco: 'Anuncie seu espaço',
    planos: 'Planos',
    comoFunciona: 'Como Funciona',
    faleConosco: 'Fale Conosco',
    idioma: 'Idioma',
  },
  footer: {
    atendimento: 'Atendimento',
    faleConosco: 'Fale Conosco',
    privacidade: 'Política de Privacidade',
    termos: 'Termos de Uso',
    comoFunciona: 'Como Funciona',
    anunciar: 'Anunciar',
    cadastrePropriedade: 'Cadastre sua propriedade',
    planosDisponiveis: 'Planos Disponíveis',
    direitos: '© 2026 VENTSY. Todos os direitos reservados.',
  },
  searchBar: {
    adicionarDatas: 'Adicionar datas',
    quando: 'Quando?',
    tipoEvento: 'Tipo de Evento',
    convidados: 'Convidados',
    diminuirConvidados: 'Diminuir número de convidados',
    aumentarConvidados: 'Aumentar número de convidados',
    buscarEspacos: 'Buscar espaços',
  },
  home: {
    carregandoEspacos: 'Carregando espaços...',
  },
  componentes: {
    onde: {
      label: 'Onde?',
      placeholder: 'Cidade, bairro, estado ou espaço...',
      buscando: 'Buscando...',
      destinosPopulares: 'Destinos populares',
      espacos: 'Espaços',
      bairros: 'Bairros',
      cidades: 'Cidades',
      estados: 'Estados',
      badgeEspaco: 'Espaço',
      badgeBairro: 'Bairro',
      badgeCidade: 'Cidade',
      badgeEstado: 'Estado',
      semResultado: 'Nenhum resultado para',
      brasil: 'Brasil',
    },
    evento: {
      todos: 'Todos os eventos',
      varios: 'Eventos',
      limpar: 'Limpar seleção',
    },
    card: {
      premium: 'Premium',
      pro: 'Pro',
      aPartirDe: 'A partir de',
      sobConsulta: 'Sob consulta',
      aConsultar: 'A consultar',
      pessoas: 'pessoas',
      porHora: '/ hora',
      semNome: 'Sem nome',
      removerFavorito: 'Remover dos favoritos',
      salvarFavorito: 'Salvar nos favoritos',
    },
    homeBanner: {
      paraProprietarios: 'Para proprietários',
      titulo: 'Anuncie seu espaço na VENTSY',
      desc: 'Alcance milhares de pessoas que buscam o espaço ideal para seu evento.',
      cta: 'Começar agora →',
    },
    categoria: {
      verTodos: 'Ver todos',
    },
  },
  faleConosco: {
    meta: {
      title: 'Fale conosco',
      description:
        'Dúvidas, sugestões ou suporte? Fale com a equipe VENTSY por WhatsApp, e-mail ou pelo formulário de contato. Respondemos em até 48h úteis.',
      ogTitle: 'Fale conosco · VENTSY',
      ogDescription: 'Fale com a equipe VENTSY por WhatsApp, e-mail ou formulário de contato.',
    },
    heroTag: 'Fale Conosco',
    heroTituloA: 'Estamos aqui para',
    heroTituloEm: 'te ajudar',
    heroSub:
      'Dúvidas, sugestões ou problemas? Nossa equipe responde com agilidade para você ter a melhor experiência na VENTSY.',
    sucessoTitulo: 'Mensagem enviada!',
    sucessoTextoA: 'Recebemos seu contato e nossa equipe responderá',
    sucessoTextoB: 'em até',
    sucessoHoras: '48 horas úteis',
    sucessoTextoC: 'pelo e-mail informado.',
    formTitulo: 'Envie sua mensagem',
    formSub: 'Preencha o formulário abaixo e responderemos em até 48 horas úteis.',
    assuntoLabel: 'Qual é o assunto?',
    chips: {
      duvidaGeral: 'Dúvida geral',
      anunciar: 'Anunciar meu espaço',
      problemaTecnico: 'Problema técnico',
      planosCobranca: 'Planos e cobrança',
      parceria: 'Parceria',
      outro: 'Outro',
    },
    nomeLabel: 'Nome',
    nomePlaceholder: 'Seu nome completo',
    telefoneLabel: 'Telefone / WhatsApp',
    emailLabel: 'E-mail',
    emailPlaceholder: 'seu@email.com',
    perfilLabel: 'Você é...',
    perfil: {
      selecione: 'Selecione seu perfil',
      donoEspaco: 'Dono de espaço',
      queroAlugar: 'Quero alugar um espaço',
      parceiroFornecedor: 'Parceiro / Fornecedor',
      imprensa: 'Imprensa',
      outro: 'Outro',
    },
    mensagemLabel: 'Mensagem',
    mensagemPlaceholder: 'Descreva sua dúvida ou mensagem com o máximo de detalhes possível...',
    erroCampos: 'Preencha os campos destacados para enviar.',
    erroEnvioGenerico: 'Não foi possível enviar. Tente novamente.',
    erroConexao: 'Falha de conexão. Verifique sua internet e tente novamente.',
    enviando: 'Enviando...',
    btnEnviar: 'Enviar mensagem',
    whatsappLabel: 'WhatsApp',
    whatsappDesc: 'Resposta rápida em horário comercial',
    emailCanalLabel: 'E-mail',
    emailCanalDesc: 'Resposta em até 48 horas úteis',
    suporteLabel: 'Suporte Técnico',
    suporteDesc: 'Problemas na plataforma ou conta',
    redesTitulo: 'Redes Sociais',
    redesSub: 'Siga a VENTSY e fique por dentro de novidades, dicas e espaços incríveis.',
    horarioTitulo: '🕐 Horário de atendimento',
    horarioSegSex: 'Segunda a Sexta',
    horarioSegSexValor: '9h às 18h',
    horarioSabado: 'Sábado',
    horarioSabadoValor: '9h às 13h',
    horarioDomingo: 'Domingo',
    horarioFechado: 'Fechado',
  },
  auth,
  planos,
  cadastro,
  anunciar,
  comoFunciona,
  busca,
  propriedade,
  legal,
  listas,
  vagas,
  dados,
}

export type Dictionary = typeof pt
export default pt
