// Namespace `planos` — PT-BR (fonte da verdade). en/es são tipados por `T`.
const planos = {
  meta: {
    title: 'Planos e preços',
    description:
      'Escolha o plano ideal para anunciar seu espaço de eventos na VENTSY: Básico grátis, Pro e Ultra. Mais visibilidade, fotos e recursos premium.',
    ogTitle: 'Planos e preços · VENTSY',
    ogDescription:
      'Básico grátis, Pro e Ultra: escolha o plano ideal para anunciar seu espaço de eventos.',
  },
  alertas: {
    pagamentoAprovadoRedir: '✅ Pagamento aprovado! Seu plano foi ativado. Redirecionando...',
    pagamentoErro: '❌ Houve um problema com o pagamento. Tente novamente.',
    pagamentoPendente: '⏳ Pagamento pendente. Você receberá um e-mail de confirmação.',
    pagamentoAprovado: '✅ Pagamento aprovado! Seu plano foi ativado.',
  },
  hero: {
    tituloA: 'Escolha o plano',
    tituloB: 'certo para você',
    subtitulo:
      'Anuncie seu espaço para milhares de pessoas que buscam o local perfeito para seus eventos.',
    mensal: 'Mensal',
    anual: 'Anual',
    badgeDesconto: '−20%',
  },
  precoGratis: 'Grátis',
  cifrao: 'R$',
  porMes: '/mês',
  equivaleMensal: 'Equivale a {valor}/mês no mensal',
  basico: {
    nome: 'Básico',
    titulo: 'Para começar',
    desc: 'Para quem está começando a divulgar seu espaço.',
    cta: 'Começar grátis',
    features: {
      f1: 'Cadastro de 1 propriedade',
      f2: 'Até 5 fotos na galeria',
      f3: 'Botão de WhatsApp direto',
      f4: 'Relatório de desempenho',
      f5: 'Selo de verificação',
    },
  },
  pro: {
    badgePopular: 'Mais popular',
    nome: 'Pro',
    titulo: 'Profissional',
    desc: 'Ideal para chácaras e salões profissionais.',
    ctaAssinar: '⭐ Assinar Pro',
    ctaAguarde: '⏳ Aguarde...',
    features: {
      f1: 'Tudo do plano Básico',
      f2: 'Fotos ilimitadas',
      f3: 'Botão de WhatsApp direto',
      f4: 'Relatórios detalhados',
      f5: 'Calendário de disponibilidade',
      f6: 'Suporte prioritário',
    },
  },
  ultra: {
    nome: 'Ultra',
    titulo: 'Máximo alcance',
    desc: 'O máximo de leads para o seu negócio.',
    ctaAssinar: '🚀 Assinar Ultra',
    ctaAguarde: '⏳ Aguarde...',
    features: {
      f1: 'Tudo do plano Pro',
      f2: 'Upload de vídeos',
      f3: 'Aparecer no topo das buscas',
      f4: 'Selo de Verificação Premium',
      f5: 'Destaque na Home do site',
      f6: 'Gerador de Contratos PDF',
    },
  },
  nota: {
    duvidas: 'Dúvidas sobre os planos?',
    verCobranca: 'Veja como funciona a cobrança',
    ou: 'ou',
    faleConosco: 'fale com a gente',
  },
  cta: {
    trialTitulo: '1 mês grátis no Ultra',
    semCartao: 'sem cartão de crédito',
    trialDesc:
      'Cadastre sua propriedade agora e experimente todos os recursos premium sem pagar nada. Após o período, você continua no plano Básico gratuitamente.',
    botao: 'Cadastre sua propriedade',
    nota: 'Seu anúncio ficará em revisão até ser aprovado pela equipe VENTSY antes de ir ao público.',
  },
  checkout: {
    titulo: 'Assinar plano {plano}',
    subtitulo: 'Pix ou cartão, com segurança pelo Mercado Pago.',
    fechar: 'Fechar',
    total: 'Total ({periodo})',
    pixInstrucao: 'Escaneie o QR Code para pagar via Pix:',
    pixAlt: 'QR Code Pix',
    pixAtivacao: 'Seu plano é ativado automaticamente após o pagamento.',
    carregando: 'Carregando checkout...',
    msgChaveAusente: 'Checkout indisponível (chave do Mercado Pago ausente).',
    msgErroCarregar: 'Erro ao carregar o checkout. Tente novamente.',
    msgErroIniciar: 'Erro ao iniciar o checkout.',
    msgPendente: 'Pagamento {status}. Confirmaremos assim que cair.',
    statusPendente: 'pendente',
    msgFalhaConcluir: 'Não foi possível concluir o pagamento.',
  },
}
export type T = typeof planos
export default planos
