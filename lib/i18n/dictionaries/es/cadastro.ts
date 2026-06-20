// Diccionario en español — namespace `cadastro`. Tipado por `T` (de pt/cadastro)
// para garantizar la paridad de claves.
import type { T } from '../pt/cadastro'

const cadastro: T = {
  // ── Metadatos (<head>) ──
  meta: {
    title: 'Crear cuenta',
    description:
      'Crea tu cuenta gratuita en VENTSY para anunciar tu espacio de eventos o gestionar tus reservas. Tarda menos de un minuto.',
    ogTitle: 'Crear cuenta · VENTSY',
    ogDescription: 'Crea tu cuenta gratuita para anunciar tu espacio o reservar el lugar de tu evento.',
  },

  // ── Encabezado ──
  tag: 'Nueva cuenta',
  tituloAntes: 'Crea tu cuenta en',
  subtituloA: 'Completa la información a continuación para empezar.',
  subtituloB: 'Los demás detalles se completarán dentro de la plataforma.',

  // ── Éxito ──
  sucessoTitulo: '¡Cuenta creada!',
  sucessoTextoA: 'Tu cuenta se creó con éxito.',
  sucessoTextoB: 'Accede a la plataforma para completar tu perfil',
  sucessoTextoC: 'y empezar a usar VENTSY.',
  sucessoBotao: 'Entrar en la plataforma',

  // ── Tipo de documento ──
  tipoDocLabel: 'Tipo de documento',
  cpfPessoaFisica: 'CPF (Persona física)',
  cnpjEmpresa: 'CNPJ (Empresa)',
  cpf: 'CPF',
  cnpj: 'CNPJ',

  // ── Divisores ──
  divisorDadosPessoais: 'Datos personales',
  divisorAcesso: 'Acceso a la plataforma',

  // ── Nombre ──
  nomeLabel: 'Nombre completo',
  nomePlaceholder: 'Tu nombre completo',

  // ── Fecha de nacimiento ──
  nascimentoLabel: 'Fecha de nacimiento',

  // ── Correo electrónico ──
  emailLabel: 'Correo electrónico',
  emailPlaceholder: 'tu@correo.com',

  // ── Usuario ──
  usuarioLabel: 'Nombre de usuario',
  usuarioPlaceholder: 'tu_usuario',

  // ── Contraseña ──
  senhaLabel: 'Contraseña',
  senhaPlaceholder: 'Mínimo 8 caracteres',
  senha2Label: 'Confirmar contraseña',
  senha2Placeholder: 'Repite la contraseña',
  mostrarSenha: 'Mostrar contraseña',
  ocultarSenha: 'Ocultar contraseña',

  // ── Fuerza de la contraseña ──
  forca: {
    muitoFraca: 'Muy débil',
    fraca: 'Débil',
    boa: 'Buena',
    forte: 'Fuerte',
  },

  // ── Referido ──
  indicacao: {
    aria: 'Código de referido',
    tituloPergunta: '¿Te recomendó alguien?',
    subtitulo: 'Nos encanta la transparencia y el boca a boca. ¡Bienvenido al equipo VENTSY!',
    instrucaoA: 'Pega abajo el código de quien te recomendó. Si llegaste por el enlace, se',
    instrucaoNegritoA: 'completa solo',
    instrucaoB: '. Si está en blanco, ¿puedes escribirlo exactamente como te lo pasaron?',
    instrucaoNegritoB: 'No cambies mayúsculas por minúsculas',
    instrucaoC: '— pégalo tal cual. ¡VENTSY te lo agradece! 💙',
    placeholder: 'Ej.: A3KX92BZ',
    hintOpcional: 'Opcional — déjalo en blanco si nadie te recomendó.',
    hintAutoPreenchido: '¡Código completado automáticamente por el enlace de invitación!',
    hintDigite: 'Escríbelo exactamente como te lo pasaron — ¡las mayúsculas y minúsculas importan!',
    hintNaoEncontrado: 'Usuario no encontrado. ¿Seguro que el código es correcto? Déjalo en blanco o consúltalo con quien te recomendó.',
  },

  // ── Términos ──
  termosAria: 'He leído y acepto los Términos de Uso y la Política de Privacidad',
  termosTextoA: 'He leído y acepto los',
  termosLinkTermos: 'Términos de Uso',
  termosTextoE: 'y la',
  termosLinkPrivacidade: 'Política de Privacidad',
  termosTextoFim: 'de VENTSY.',

  // ── Botón de envío ──
  btnCriar: 'Crear mi cuenta',
  btnCriando: 'Creando cuenta...',

  // ── Pie ──
  jaTemConta: '¿Ya tienes una cuenta?',
  entrar: 'Iniciar sesión',

  // ── Validaciones / pistas ──
  hints: {
    maiorDe18: 'Solo pueden registrarse personas mayores de 18 años.',
    emailLogin: 'Se usa para iniciar sesión en la plataforma.',
    usuarioRegras: 'Letras minúsculas, números y _ (sin espacios).',
  },
  validacao: {
    docInvalido: 'no válido o incompleto.',
    docVerificando: 'Verificando',
    docJaCadastradoA: 'Este',
    docJaCadastradoB: 'ya está registrado. Intenta iniciar sesión.',
    docDisponivelB: 'disponible.',
    nomeSobrenome: 'Indica tu nombre y apellido.',
    dataInvalida: 'Fecha no válida.',
    idadeConfirmada: 'Edad confirmada.',
    precisa18: 'Debes tener 18 años o más.',
    emailInvalido: 'Indica un correo electrónico válido.',
    emailVerificando: 'Verificando correo electrónico...',
    emailJaCadastrado: 'Este correo electrónico ya está registrado. Intenta iniciar sesión.',
    emailDisponivel: 'Correo electrónico disponible.',
    usuarioInformar: 'Indica un nombre de usuario.',
    usuarioRegras: 'Entre 3 y 20 caracteres. Solo letras, números y _.',
    usuarioVerificando: 'Verificando disponibilidad...',
    usuarioEmUso: 'Este nombre de usuario ya está en uso. Elige otro.',
    usuarioDisponivel: '¡Nombre de usuario disponible!',
    senhasConferem: 'Las contraseñas coinciden.',
    senhasNaoCoincidem: 'Las contraseñas no coinciden.',
  },

  // ── Alertas ──
  alerta: {
    aceitarTermos: 'Debes aceptar los Términos de Uso para continuar.',
    corrijaCampos: 'Corrige los campos destacados antes de continuar.',
    refInvalido: 'Código de referido no válido.',
    erroCriarConta: 'Error al crear la cuenta. Inténtalo de nuevo.',
    emailJaPossuiConta: 'Este correo electrónico ya tiene una cuenta. Intenta iniciar sesión.',
    erroObterId: 'Error al obtener el ID del usuario. Inténtalo de nuevo.',
    docJaCadastrado: 'Este CPF/CNPJ ya está registrado.',
    usuarioEmUso: 'Este nombre de usuario ya está en uso. Elige otro.',
    erroSalvarDados: 'Error al guardar tus datos. Inténtalo de nuevo.',
    erroGenerico: 'Ocurrió un error. Inténtalo de nuevo.',
  },
}

export default cadastro
