// English dictionary — `cadastro` namespace. Typed by `T` (from pt/cadastro) to
// guarantee key parity.
import type { T } from '../pt/cadastro'

const cadastro: T = {
  // ── Metadata (<head>) ──
  meta: {
    title: 'Create account',
    description:
      'Create your free VENTSY account to list your event space or manage your bookings. It takes less than a minute.',
    ogTitle: 'Create account · VENTSY',
    ogDescription: 'Create your free account to list your space or book the venue for your event.',
  },

  // ── Top ──
  tag: 'New account',
  tituloAntes: 'Create your account on',
  subtituloA: 'Fill in the information below to get started.',
  subtituloB: 'The remaining details can be completed inside the platform.',

  // ── Success ──
  sucessoTitulo: 'Account created!',
  sucessoTextoA: 'Your account was created successfully.',
  sucessoTextoB: 'Access the platform to complete your profile',
  sucessoTextoC: 'and start using VENTSY.',
  sucessoBotao: 'Enter the platform',

  // ── Document type ──
  tipoDocLabel: 'Document type',
  cpfPessoaFisica: 'CPF (Individual)',
  cnpjEmpresa: 'CNPJ (Company)',
  cpf: 'CPF',
  cnpj: 'CNPJ',

  // ── Dividers ──
  divisorDadosPessoais: 'Personal details',
  divisorAcesso: 'Platform access',

  // ── Name ──
  nomeLabel: 'Full name',
  nomePlaceholder: 'Your full name',

  // ── Date of birth ──
  nascimentoLabel: 'Date of birth',

  // ── Email ──
  emailLabel: 'Email',
  emailPlaceholder: 'you@email.com',

  // ── Username ──
  usuarioLabel: 'Username',
  usuarioPlaceholder: 'your_username',

  // ── Password ──
  senhaLabel: 'Password',
  senhaPlaceholder: 'At least 8 characters',
  senha2Label: 'Confirm password',
  senha2Placeholder: 'Repeat the password',
  mostrarSenha: 'Show password',
  ocultarSenha: 'Hide password',

  // ── Password strength ──
  forca: {
    muitoFraca: 'Very weak',
    fraca: 'Weak',
    boa: 'Good',
    forte: 'Strong',
  },

  // ── Referral ──
  indicacao: {
    aria: 'Referral code',
    tituloPergunta: 'Were you referred by someone?',
    subtitulo: 'We love transparency and word of mouth. Welcome to the VENTSY team!',
    instrucaoA: 'Paste below the code of whoever referred you. If you came through the link, it',
    instrucaoNegritoA: 'fills in by itself',
    instrucaoB: '. If it is blank, could you type it exactly as the person gave it to you?',
    instrucaoNegritoB: 'Do not swap uppercase for lowercase',
    instrucaoC: '— paste it exactly. VENTSY thanks you! 💙',
    placeholder: 'E.g.: A3KX92BZ',
    hintOpcional: 'Optional — leave blank if no one referred you.',
    hintAutoPreenchido: 'Code filled in automatically by the invite link!',
    hintDigite: 'Type it exactly as you were given it — uppercase and lowercase matter!',
    hintNaoEncontrado: 'User not found. Are you sure the code is correct? Leave it blank or check with whoever referred you.',
  },

  // ── Terms ──
  termosAria: 'I have read and agree to the Terms of Use and the Privacy Policy',
  termosTextoA: 'I have read and agree to the',
  termosLinkTermos: 'Terms of Use',
  termosTextoE: 'and the',
  termosLinkPrivacidade: 'Privacy Policy',
  termosTextoFim: 'of VENTSY.',

  // ── Submit button ──
  btnCriar: 'Create my account',
  btnCriando: 'Creating account...',

  // ── Footer ──
  jaTemConta: 'Already have an account?',
  entrar: 'Sign in',

  // ── Validations / hints ──
  hints: {
    maiorDe18: 'Only people aged 18 or older can sign up.',
    emailLogin: 'Used to sign in to the platform.',
    usuarioRegras: 'Lowercase letters, numbers and _ (no spaces).',
  },
  validacao: {
    docInvalido: 'invalid or incomplete.',
    docVerificando: 'Checking',
    docJaCadastradoA: 'This',
    docJaCadastradoB: 'is already registered. Try signing in.',
    docDisponivelB: 'available.',
    nomeSobrenome: 'Enter your first and last name.',
    dataInvalida: 'Invalid date.',
    idadeConfirmada: 'Age confirmed.',
    precisa18: 'You must be 18 or older.',
    emailInvalido: 'Enter a valid email.',
    emailVerificando: 'Checking email...',
    emailJaCadastrado: 'This email is already registered. Try signing in.',
    emailDisponivel: 'Email available.',
    usuarioInformar: 'Enter a username.',
    usuarioRegras: 'Between 3 and 20 characters. Only letters, numbers and _.',
    usuarioVerificando: 'Checking availability...',
    usuarioEmUso: 'This username is already taken. Choose another.',
    usuarioDisponivel: 'Username available!',
    senhasConferem: 'Passwords match.',
    senhasNaoCoincidem: 'The passwords do not match.',
  },

  // ── Alerts ──
  alerta: {
    aceitarTermos: 'You must accept the Terms of Use to continue.',
    corrijaCampos: 'Fix the highlighted fields before continuing.',
    refInvalido: 'Invalid referral code.',
    erroCriarConta: 'Error creating the account. Please try again.',
    emailJaPossuiConta: 'This email already has an account. Try signing in.',
    erroObterId: 'Error retrieving the user ID. Please try again.',
    docJaCadastrado: 'This CPF/CNPJ is already registered.',
    usuarioEmUso: 'This username is already taken. Choose another.',
    erroSalvarDados: 'Error saving your data. Please try again.',
    erroGenerico: 'An error occurred. Please try again.',
  },
}

export default cadastro
