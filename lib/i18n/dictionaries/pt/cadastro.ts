// Namespace `cadastro` — página de criação de conta (signup). FONTE DA VERDADE:
// en/cadastro.ts e es/cadastro.ts são tipados por `T` para garantir paridade.

const cadastro = {
  // ── Topo ──
  tag: 'Novo cadastro',
  tituloAntes: 'Crie sua conta na',
  subtituloA: 'Preencha as informações abaixo para começar.',
  subtituloB: 'Os demais detalhes serão completados dentro da plataforma.',

  // ── Sucesso ──
  sucessoTitulo: 'Conta criada!',
  sucessoTextoA: 'Seu cadastro foi realizado com sucesso.',
  sucessoTextoB: 'Acesse a plataforma para completar seu perfil',
  sucessoTextoC: 'e começar a usar a VENTSY.',
  sucessoBotao: 'Entrar na plataforma',

  // ── Tipo de documento ──
  tipoDocLabel: 'Tipo de documento',
  cpfPessoaFisica: 'CPF (Pessoa Física)',
  cnpjEmpresa: 'CNPJ (Empresa)',
  cpf: 'CPF',
  cnpj: 'CNPJ',

  // ── Divisores ──
  divisorDadosPessoais: 'Dados pessoais',
  divisorAcesso: 'Acesso à plataforma',

  // ── Nome ──
  nomeLabel: 'Nome completo',
  nomePlaceholder: 'Seu nome completo',

  // ── Nascimento ──
  nascimentoLabel: 'Data de nascimento',

  // ── E-mail ──
  emailLabel: 'E-mail',
  emailPlaceholder: 'seu@email.com',

  // ── Usuário ──
  usuarioLabel: 'Nome de usuário',
  usuarioPlaceholder: 'seu_usuario',

  // ── Senha ──
  senhaLabel: 'Senha',
  senhaPlaceholder: 'Mínimo 8 caracteres',
  senha2Label: 'Confirmar senha',
  senha2Placeholder: 'Repita a senha',
  mostrarSenha: 'Mostrar senha',
  ocultarSenha: 'Ocultar senha',

  // ── Força da senha ──
  forca: {
    muitoFraca: 'Muito fraca',
    fraca: 'Fraca',
    boa: 'Boa',
    forte: 'Forte',
  },

  // ── Indicação ──
  indicacao: {
    aria: 'Código de indicação',
    tituloPergunta: 'Você veio por indicação?',
    subtitulo: 'A gente ama a transparência e o boca a boca. Bem-vindo à equipe VENTSY!',
    instrucaoA: 'Cole abaixo o código de quem te indicou. Se você veio pelo link, ele',
    instrucaoNegritoA: 'preenche sozinho',
    instrucaoB: '. Se estiver em branco, consegue digitar exatamente como a pessoa te passou?',
    instrucaoNegritoB: 'Não troque maiúsculo por minúsculo',
    instrucaoC: '— cole igualzinho. A VENTSY agradece! 💙',
    placeholder: 'Ex: A3KX92BZ',
    hintOpcional: 'Opcional — deixe em branco se não foi indicado por ninguém.',
    hintAutoPreenchido: 'Código preenchido automaticamente pelo link de convite!',
    hintDigite: 'Digite exatamente como te passaram — maiúsculas e minúsculas importam!',
    hintNaoEncontrado: 'Usuário não encontrado. Tem certeza que o código está certo? Deixe em branco ou confira com quem te indicou.',
  },

  // ── Termos ──
  termosAria: 'Li e concordo com os Termos de Uso e a Política de Privacidade',
  termosTextoA: 'Li e concordo com os',
  termosLinkTermos: 'Termos de Uso',
  termosTextoE: 'e a',
  termosLinkPrivacidade: 'Política de Privacidade',
  termosTextoFim: 'da VENTSY.',

  // ── Botão enviar ──
  btnCriar: 'Criar minha conta',
  btnCriando: 'Criando conta...',

  // ── Rodapé ──
  jaTemConta: 'Já tem uma conta?',
  entrar: 'Entrar',

  // ── Validações / hints ──
  hints: {
    maiorDe18: 'Apenas maiores de 18 anos podem se cadastrar.',
    emailLogin: 'Usado para fazer login na plataforma.',
    usuarioRegras: 'Letras minúsculas, números e _ (sem espaços).',
  },
  validacao: {
    docInvalido: 'inválido ou incompleto.', // prefixado por CPF/CNPJ
    docVerificando: 'Verificando', // sufixado por CPF/CNPJ...
    docJaCadastradoA: 'Este', // <DOC> já está cadastrado. Tente fazer login.
    docJaCadastradoB: 'já está cadastrado. Tente fazer login.',
    docDisponivelB: 'disponível.', // prefixado por CPF/CNPJ
    nomeSobrenome: 'Informe nome e sobrenome.',
    dataInvalida: 'Data inválida.',
    idadeConfirmada: 'Idade confirmada.',
    precisa18: 'Você precisa ter 18 anos ou mais.',
    emailInvalido: 'Informe um e-mail válido.',
    emailVerificando: 'Verificando e-mail...',
    emailJaCadastrado: 'Este e-mail já está cadastrado. Tente fazer login.',
    emailDisponivel: 'E-mail disponível.',
    usuarioInformar: 'Informe um nome de usuário.',
    usuarioRegras: 'Entre 3 e 20 caracteres. Apenas letras, números e _.',
    usuarioVerificando: 'Verificando disponibilidade...',
    usuarioEmUso: 'Este nome de usuário já está em uso. Escolha outro.',
    usuarioDisponivel: 'Nome de usuário disponível!',
    senhasConferem: 'Senhas conferem.',
    senhasNaoCoincidem: 'As senhas não coincidem.',
  },

  // ── Alertas ──
  alerta: {
    aceitarTermos: 'Você precisa aceitar os Termos de Uso para continuar.',
    corrijaCampos: 'Corrija os campos em destaque antes de continuar.',
    refInvalido: 'Código de indicação inválido.',
    erroCriarConta: 'Erro ao criar conta. Tente novamente.',
    emailJaPossuiConta: 'Este e-mail já possui uma conta. Tente fazer login.',
    erroObterId: 'Erro ao obter ID do usuário. Tente novamente.',
    docJaCadastrado: 'Este CPF/CNPJ já está cadastrado.',
    usuarioEmUso: 'Este nome de usuário já está em uso. Escolha outro.',
    erroSalvarDados: 'Erro ao salvar seus dados. Tente novamente.',
    erroGenerico: 'Ocorreu um erro. Tente novamente.',
  },
}

export type T = typeof cadastro
export default cadastro
