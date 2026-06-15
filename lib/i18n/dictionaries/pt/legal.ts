// Namespace `legal` — PT-BR (fonte da verdade). en/es são tipados por `T`.
// Sub-objetos `termos` (Termos de Uso) e `privacidade` (Política de Privacidade).
// Arrays de cláusulas/itens DEVEM ter o mesmo comprimento nos 3 idiomas.
const legal = {
  termos: {
    meta: {
      title: 'Termos de Uso',
      description: 'Regras e condições para utilização da plataforma VENTSY.',
    },
    heroTag: 'Documentos legais',
    heroTitulo: 'Termos de Uso',
    heroSub: 'Regras e condições para utilização da plataforma VENTSY.',
    atualizadoLabel: 'Última atualização:',
    atualizadoData: 'Janeiro de 2026',
    alerta:
      'Ao criar uma conta ou utilizar a plataforma VENTSY, você declara ter lido, compreendido e concordado com todos os termos abaixo. Caso não concorde, não utilize o serviço.',
    indiceTitulo: 'Índice',
    // Títulos das 13 seções (ordem do índice e do corpo).
    indice: [
      'Definições',
      'Aceitação dos termos',
      'Cadastro e conta',
      'Uso da plataforma',
      'Regras para proprietários',
      'Regras para locatários',
      'Pagamentos e tarifas',
      'Cancelamentos e reembolsos',
      'Avaliações e conteúdo',
      'Responsabilidades e limitações',
      'Propriedade intelectual',
      'Suspensão e encerramento',
      'Disposições gerais',
    ],
    s1: {
      titulo: 'Definições',
      intro: 'Para os fins destes Termos de Uso, considera-se:',
      // Cada item: rótulo em negrito + texto.
      itensTitulo: [
        'VENTSY:',
        'Usuário:',
        'Proprietário:',
        'Locatário:',
        'Espaço:',
        'Reserva:',
      ],
      itensTexto: [
        'plataforma digital marketplace de locação de espaços para eventos.',
        'qualquer pessoa física ou jurídica que acessa ou utiliza a plataforma.',
        'usuário que cadastra e disponibiliza um espaço para locação.',
        'usuário que busca e reserva espaços através da plataforma.',
        'imóvel ou local disponibilizado pelo Proprietário para eventos.',
        'confirmação de uso de um Espaço em data e condições acordadas.',
      ],
    },
    s2: {
      titulo: 'Aceitação dos termos',
      // p1 tem link inline para a Política de Privacidade no meio do parágrafo.
      p1a: 'Ao acessar, criar uma conta ou utilizar qualquer funcionalidade da VENTSY, o Usuário concorda com estes Termos de Uso e com a ',
      p1Link: 'Política de Privacidade',
      p1b: '.',
      p2: 'Estes termos podem ser atualizados periodicamente. O uso continuado da plataforma após notificação de alterações implica aceitação das novas condições.',
    },
    s3: {
      titulo: 'Cadastro e conta',
      intro:
        'Para utilizar as funcionalidades completas da plataforma, é necessário criar uma conta. Ao se cadastrar, o Usuário declara que:',
      itens: [
        'É maior de 18 anos ou possui autorização legal de um responsável.',
        'Forneceu informações verdadeiras, precisas e atualizadas.',
        'É responsável por manter a confidencialidade de sua senha.',
        'Notificará imediatamente a VENTSY sobre qualquer uso não autorizado de sua conta.',
      ],
      destaque:
        'A VENTSY reserva-se o direito de recusar ou cancelar cadastros que violem estes termos ou que apresentem informações falsas.',
    },
    s4: {
      titulo: 'Uso da plataforma',
      intro:
        'O Usuário compromete-se a utilizar a plataforma de forma lícita e ética. É expressamente proibido:',
      itens: [
        'Publicar conteúdo falso, enganoso, difamatório ou ilegal.',
        'Realizar transações financeiras fora da plataforma com o objetivo de burlar as tarifas.',
        'Utilizar a plataforma para fins de spam, fraude ou phishing.',
        'Tentar acessar áreas restritas ou sistemas da VENTSY sem autorização.',
        'Reproduzir, copiar ou distribuir conteúdo da plataforma sem permissão expressa.',
        'Interferir no funcionamento técnico da plataforma ou de seus servidores.',
      ],
    },
    s5: {
      titulo: 'Regras para proprietários',
      intro: 'Ao cadastrar um espaço na VENTSY, o Proprietário declara e garante que:',
      itens: [
        'Possui autorização legal para disponibilizar o espaço para locação.',
        'As informações, fotos e descrições do espaço são verídicas e atualizadas.',
        'O espaço está em condições adequadas de uso, higiene e segurança.',
        'Possui todas as licenças e alvarás necessários para realização de eventos no local.',
        'Cumprirá as reservas confirmadas nos termos anunciados.',
        'Comunicará com antecedência mínima de 48h qualquer impossibilidade de cumprimento.',
      ],
      fim: 'A VENTSY não se responsabiliza por irregularidades legais dos espaços cadastrados, sendo a responsabilidade exclusiva do Proprietário.',
    },
    s6: {
      titulo: 'Regras para locatários',
      intro: 'Ao realizar uma reserva, o Locatário compromete-se a:',
      itens: [
        'Utilizar o espaço exclusivamente para o evento declarado no momento da reserva.',
        'Respeitar a capacidade máxima de pessoas informada pelo Proprietário.',
        'Devolver o espaço nas mesmas condições em que o recebeu.',
        'Cumprir os horários acordados de entrada e saída.',
        'Responsabilizar-se por danos causados ao espaço durante o evento.',
        'Respeitar as normas de conduta, vizinhança e legislação local.',
      ],
    },
    s7: {
      titulo: 'Pagamentos e tarifas',
      // p1 tem "taxa de serviço" em negrito no meio.
      p1a: 'Os pagamentos realizados através da plataforma são processados por parceiros certificados. A VENTSY cobra uma ',
      p1Strong: 'taxa de serviço',
      p1b: ' sobre cada transação concluída, cujo valor é informado antes da confirmação da reserva.',
      itens: [
        'Os preços exibidos são de responsabilidade dos Proprietários e podem ser alterados a qualquer momento para novas reservas.',
        'Reservas já confirmadas têm o valor garantido conforme acordado.',
        'Taxas bancárias ou de câmbio eventualmente aplicadas são de responsabilidade do Usuário.',
      ],
      fim: 'Planos pagos de anúncio (Básico, Pro, Ultra) são cobrados mensalmente e renovados automaticamente salvo cancelamento pelo Proprietário com antecedência de 48h do vencimento.',
    },
    s8: {
      titulo: 'Cancelamentos e reembolsos',
      intro:
        'A política de cancelamento de cada espaço é definida pelo Proprietário e exibida na página do anúncio. Em regra geral:',
      // Cada item: rótulo em negrito + texto.
      itensTitulo: [
        'Cancelamento pelo Locatário com mais de 30 dias de antecedência:',
        'Cancelamento entre 15 e 30 dias:',
        'Cancelamento com menos de 15 dias:',
        'Cancelamento pelo Proprietário:',
      ],
      itensTexto: [
        'reembolso integral.',
        'reembolso de 50% do valor pago.',
        'sem reembolso, salvo política específica do espaço.',
        'reembolso integral ao Locatário.',
      ],
      destaque:
        'A taxa de serviço da VENTSY não é reembolsável em casos de cancelamento pelo Locatário.',
    },
    s9: {
      titulo: 'Avaliações e conteúdo',
      intro:
        'A VENTSY permite que Locatários publiquem avaliações sobre os espaços após a realização do evento. Ao publicar uma avaliação, o Usuário:',
      itens: [
        'Garante que o conteúdo é verdadeiro e baseado em experiência real.',
        'Concede à VENTSY licença não exclusiva para exibir o conteúdo na plataforma.',
        'Não publica conteúdo ofensivo, discriminatório ou que viole direitos de terceiros.',
      ],
      p2: 'A VENTSY reserva-se o direito de remover avaliações que violem estas diretrizes, sem necessidade de aviso prévio.',
      // p3 tem "verificadas" em negrito no meio.
      p3a: 'Apenas avaliações ',
      p3Strong: 'verificadas',
      p3b: ' (vinculadas a reservas reais concluídas) são exibidas publicamente nas páginas dos espaços.',
    },
    s10: {
      titulo: 'Responsabilidades e limitações',
      // p1 tem trecho em negrito no meio.
      p1a: 'A VENTSY atua como intermediária entre Proprietários e Locatários, ',
      p1Strong: 'não sendo parte nos contratos de locação',
      p1b: '. Portanto:',
      itens: [
        'A VENTSY não se responsabiliza pela qualidade, segurança ou legalidade dos espaços anunciados.',
        'A VENTSY não se responsabiliza por danos materiais, pessoais ou financeiros ocorridos durante os eventos.',
        'A VENTSY não garante a disponibilidade ininterrupta da plataforma e não se responsabiliza por falhas técnicas temporárias.',
      ],
      fim: 'Em nenhum caso a responsabilidade total da VENTSY excederá o valor da taxa de serviço cobrada na transação relacionada à reclamação.',
    },
    s11: {
      titulo: 'Propriedade intelectual',
      p1: 'Todo o conteúdo da plataforma VENTSY — incluindo logotipos, textos, design, código-fonte e funcionalidades — é protegido por direitos de propriedade intelectual e pertence à VENTSY ou a seus licenciadores.',
      p2: 'É proibida a reprodução, modificação ou distribuição de qualquer elemento da plataforma sem autorização prévia e expressa por escrito.',
      p3: 'Ao publicar fotos ou conteúdo na plataforma, o Usuário garante possuir os direitos sobre esse conteúdo e concede à VENTSY licença para usá-lo na plataforma.',
    },
    s12: {
      titulo: 'Suspensão e encerramento',
      intro:
        'A VENTSY pode suspender ou encerrar uma conta, a qualquer momento e sem aviso prévio, nos seguintes casos:',
      itens: [
        'Violação de qualquer disposição destes Termos de Uso.',
        'Comportamento fraudulento ou lesivo a outros usuários.',
        'Uso da plataforma para fins ilegais.',
        'Fornecimento de informações falsas no cadastro ou nos anúncios.',
      ],
      fim: 'O encerramento da conta não elimina obrigações já assumidas pelo Usuário em reservas confirmadas anteriormente.',
    },
    s13: {
      titulo: 'Disposições gerais',
      p1: 'Estes Termos de Uso são regidos pelas leis da República Federativa do Brasil. Fica eleito o foro da comarca do Rio de Janeiro — RJ para dirimir eventuais controvérsias, com renúncia a qualquer outro, por mais privilegiado que seja.',
      p2: 'A eventual invalidade de alguma cláusula não afeta a validade das demais disposições deste instrumento.',
      // p3 termina com e-mail (link) — texto antes do link.
      p3a: 'Para dúvidas ou solicitações relacionadas a estes termos, entre em contato: ',
    },
    contatoTitulo: 'Dúvidas sobre os termos?',
    contatoSub: 'Nossa equipe jurídica está disponível para esclarecimentos.',
    contatoBtn: 'Fale conosco →',
  },
  privacidade: {
    meta: {
      title: 'Política de Privacidade',
      description:
        'Como coletamos, usamos e protegemos suas informações na plataforma VENTSY.',
    },
    heroTag: 'Documentos legais',
    heroTitulo: 'Política de Privacidade',
    heroSub: 'Como coletamos, usamos e protegemos suas informações.',
    atualizadoLabel: 'Última atualização:',
    atualizadoData: 'Janeiro de 2026',
    indiceTitulo: 'Índice',
    // Títulos das 11 seções.
    indice: [
      'Quem somos',
      'Quais dados coletamos',
      'Como usamos seus dados',
      'Compartilhamento de dados',
      'Cookies e rastreamento',
      'Segurança das informações',
      'Seus direitos (LGPD)',
      'Retenção de dados',
      'Menores de idade',
      'Alterações nesta política',
      'Contato',
    ],
    s1: {
      titulo: 'Quem somos',
      // p1 começa com "VENTSY" em negrito.
      p1Strong: 'VENTSY',
      p1a: 'A ',
      p1b: ' é uma plataforma digital que conecta pessoas que buscam espaços para eventos com proprietários de locais disponíveis para locação. Operamos como marketplace e nos comprometemos com a transparência no tratamento de dados pessoais.',
      // p2 tem trecho em negrito no fim.
      p2a: 'Esta Política de Privacidade se aplica a todos os usuários da plataforma VENTSY, incluindo visitantes, locatários e proprietários cadastrados, nos termos da ',
      p2Strong: 'Lei Geral de Proteção de Dados (Lei nº 13.709/2018 — LGPD)',
      p2b: '.',
    },
    s2: {
      titulo: 'Quais dados coletamos',
      intro: 'Coletamos apenas os dados necessários para o funcionamento da plataforma:',
      itensTitulo: [
        'Dados de cadastro:',
        'Dados de uso:',
        'Dados de pagamento:',
        'Dados de propriedades:',
        'Comunicações:',
      ],
      itensTexto: [
        'nome completo, CPF ou CNPJ, data de nascimento, endereço de e-mail e número de telefone.',
        'endereço IP, tipo de navegador, páginas visitadas, buscas realizadas e interações com a plataforma.',
        'informações de transação processadas por gateways parceiros. Não armazenamos dados completos de cartão de crédito.',
        'endereço, fotos, descrições e valores cadastrados por proprietários.',
        'mensagens trocadas entre usuários dentro da plataforma.',
      ],
    },
    s3: {
      titulo: 'Como usamos seus dados',
      intro: 'Utilizamos suas informações para:',
      itens: [
        'Criar e gerenciar sua conta na plataforma.',
        'Processar reservas e facilitar o contato entre locatários e proprietários.',
        'Enviar confirmações, notificações de reserva e comunicados relevantes.',
        'Melhorar continuamente a experiência de busca e recomendação de espaços.',
        'Cumprir obrigações legais e prevenir fraudes.',
        'Enviar comunicações de marketing, apenas com seu consentimento.',
      ],
      destaque:
        'Nunca vendemos seus dados pessoais a terceiros. Seus dados são usados exclusivamente para os fins descritos nesta política.',
    },
    s4: {
      titulo: 'Compartilhamento de dados',
      intro: 'Seus dados podem ser compartilhados nas seguintes situações:',
      itensTitulo: [
        'Entre usuários da plataforma:',
        'Parceiros de pagamento:',
        'Parceiros de infraestrutura:',
        'Autoridades legais:',
      ],
      itensTexto: [
        'nome e informações de contato são compartilhados entre locatário e proprietário ao confirmar uma reserva.',
        'processadores de pagamento (como Stripe ou MercadoPago) recebem os dados necessários para processar transações.',
        'serviços de nuvem, hospedagem e banco de dados que operam sob acordos de confidencialidade.',
        'quando exigido por lei, ordem judicial ou autoridade competente.',
      ],
    },
    s5: {
      titulo: 'Cookies e rastreamento',
      intro: 'Utilizamos cookies e tecnologias similares para:',
      itens: [
        'Manter sua sessão ativa após o login.',
        'Lembrar suas preferências de busca.',
        'Analisar o desempenho das páginas e identificar melhorias.',
        'Exibir conteúdo relevante com base em seu histórico de navegação.',
      ],
      fim: 'Você pode configurar seu navegador para recusar cookies, porém algumas funcionalidades da plataforma podem ser afetadas.',
    },
    s6: {
      titulo: 'Segurança das informações',
      intro:
        'Adotamos medidas técnicas e organizacionais para proteger seus dados contra acesso não autorizado, alteração, divulgação ou destruição, incluindo:',
      itens: [
        'Transmissão de dados via protocolo HTTPS com criptografia TLS.',
        'Armazenamento seguro de senhas com hash e salt.',
        'Controle de acesso baseado em funções (RBAC) para nossa equipe.',
        'Monitoramento contínuo de acessos e tentativas de invasão.',
      ],
      fim: 'Em caso de incidente de segurança que possa afetar seus dados, notificaremos você e a Autoridade Nacional de Proteção de Dados (ANPD) nos prazos previstos em lei.',
    },
    s7: {
      titulo: 'Seus direitos (LGPD)',
      intro: 'Nos termos da LGPD, você tem direito a:',
      itensTitulo: [
        'Acesso:',
        'Correção:',
        'Exclusão:',
        'Portabilidade:',
        'Revogação do consentimento:',
        'Oposição:',
      ],
      itensTexto: [
        'solicitar uma cópia dos seus dados pessoais que tratamos.',
        'atualizar dados incompletos, inexatos ou desatualizados.',
        'solicitar a exclusão dos seus dados, salvo quando houver obrigação legal de retenção.',
        'receber seus dados em formato estruturado para transferência a outro serviço.',
        'retirar o consentimento para tratamentos baseados nessa base legal.',
        'opor-se ao tratamento realizado com base em legítimo interesse.',
      ],
      // fim termina com e-mail (link) — texto antes e depois do link.
      fimA: 'Para exercer qualquer um desses direitos, entre em contato conosco pelo e-mail ',
      fimB: '.',
    },
    s8: {
      titulo: 'Retenção de dados',
      // p1 tem "5 anos" em negrito no meio.
      p1a: 'Mantemos seus dados pelo tempo necessário para cumprir as finalidades descritas nesta política ou conforme exigido por lei. Dados de transações financeiras são retidos por ',
      p1Strong: '5 anos',
      p1b: ', conforme exigência fiscal.',
      p2: 'Após o encerramento da sua conta, seus dados serão anonimizados ou excluídos em até 90 dias, salvo obrigações legais que exijam retenção por prazo maior.',
    },
    s9: {
      titulo: 'Menores de idade',
      // p1 tem "18 anos ou mais" em negrito no meio.
      p1a: 'A plataforma VENTSY é destinada a pessoas com ',
      p1Strong: '18 anos ou mais',
      p1b: '. Não coletamos intencionalmente dados de menores de idade. Caso identifiquemos que um menor realizou cadastro sem autorização, excluiremos os dados imediatamente.',
    },
    s10: {
      titulo: 'Alterações nesta política',
      // p1 tem "15 dias de antecedência" em negrito no meio.
      p1a: 'Podemos atualizar esta Política de Privacidade periodicamente. Quando realizarmos alterações relevantes, notificaremos você por e-mail ou por aviso destacado na plataforma com pelo menos ',
      p1Strong: '15 dias de antecedência',
      p1b: '.',
      p2: 'O uso continuado da plataforma após a entrada em vigor das alterações implica aceitação da nova política.',
    },
    s11: {
      titulo: 'Contato',
      intro:
        'Para dúvidas, solicitações ou exercício dos seus direitos, entre em contato com nosso Encarregado de Dados (DPO):',
      // Itens com rótulo em negrito; o primeiro tem o e-mail como link.
      emailLabel: 'E-mail:',
      atendimentoLabel: 'Atendimento:',
      atendimentoValor: 'Segunda a sexta, das 9h às 18h',
      prazoLabel: 'Prazo de resposta:',
      prazoValor: 'até 15 dias úteis',
    },
    contatoTitulo: 'Ficou com alguma dúvida?',
    contatoSub:
      'Nossa equipe está pronta para te ajudar com qualquer questão sobre privacidade.',
    contatoBtn: 'Fale conosco →',
  },
}

export type T = typeof legal
export default legal
