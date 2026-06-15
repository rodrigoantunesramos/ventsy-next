// Namespace `planos` — Español. Tipado por `T` (de pt/planos) para la paridad de claves.
import type { T } from '../pt/planos'

const planos: T = {
  meta: {
    title: 'Planes y precios',
    description:
      'Elige el plan ideal para anunciar tu espacio de eventos en VENTSY: Básico gratis, Pro y Ultra. Más visibilidad, fotos y funciones premium.',
    ogTitle: 'Planes y precios · VENTSY',
    ogDescription:
      'Básico gratis, Pro y Ultra: elige el plan ideal para anunciar tu espacio de eventos.',
  },
  alertas: {
    pagamentoAprovadoRedir: '✅ ¡Pago aprobado! Tu plan ha sido activado. Redirigiendo...',
    pagamentoErro: '❌ Hubo un problema con el pago. Inténtalo de nuevo.',
    pagamentoPendente: '⏳ Pago pendiente. Recibirás un correo de confirmación.',
    pagamentoAprovado: '✅ ¡Pago aprobado! Tu plan ha sido activado.',
  },
  hero: {
    tituloA: 'Elige el plan',
    tituloB: 'adecuado para ti',
    subtitulo:
      'Anuncia tu espacio a miles de personas que buscan el lugar perfecto para sus eventos.',
    mensal: 'Mensual',
    anual: 'Anual',
    badgeDesconto: '−20%',
  },
  precoGratis: 'Gratis',
  cifrao: 'R$',
  porMes: '/mes',
  equivaleMensal: 'Equivale a {valor}/mes en el plan mensual',
  basico: {
    nome: 'Básico',
    titulo: 'Para empezar',
    desc: 'Para quienes están empezando a promocionar su espacio.',
    cta: 'Empezar gratis',
    features: {
      f1: 'Anuncia 1 propiedad',
      f2: 'Hasta 5 fotos en la galería',
      f3: 'Botón de WhatsApp directo',
      f4: 'Informe de rendimiento',
      f5: 'Sello de verificación',
    },
  },
  pro: {
    badgePopular: 'Más popular',
    nome: 'Pro',
    titulo: 'Profesional',
    desc: 'Ideal para fincas y salones profesionales.',
    ctaAssinar: '⭐ Suscribirse a Pro',
    ctaAguarde: '⏳ Espera...',
    features: {
      f1: 'Todo lo del plan Básico',
      f2: 'Fotos ilimitadas',
      f3: 'Botón de WhatsApp directo',
      f4: 'Informes detallados',
      f5: 'Calendario de disponibilidad',
      f6: 'Soporte prioritario',
    },
  },
  ultra: {
    nome: 'Ultra',
    titulo: 'Máximo alcance',
    desc: 'El máximo de leads para tu negocio.',
    ctaAssinar: '🚀 Suscribirse a Ultra',
    ctaAguarde: '⏳ Espera...',
    features: {
      f1: 'Todo lo del plan Pro',
      f2: 'Subida de videos',
      f3: 'Aparecer en lo más alto de las búsquedas',
      f4: 'Sello de Verificación Premium',
      f5: 'Destacado en la Home del sitio',
      f6: 'Generador de contratos PDF',
    },
  },
  nota: {
    duvidas: '¿Dudas sobre los planes?',
    verCobranca: 'Mira cómo funciona el cobro',
    ou: 'o',
    faleConosco: 'habla con nosotros',
  },
  cta: {
    trialTitulo: '1 mes gratis en Ultra',
    trialDesc:
      'Anuncia tu propiedad ahora y prueba todas las funciones premium sin pagar nada. Tras el período, continúas en el plan Básico de forma gratuita.',
    botao: 'Anuncia tu propiedad',
    nota: 'Tu anuncio quedará en revisión hasta ser aprobado por el equipo VENTSY antes de publicarse.',
  },
  checkout: {
    titulo: 'Suscribirse al plan {plano}',
    subtitulo: 'Pix o tarjeta, con seguridad a través de Mercado Pago.',
    fechar: 'Cerrar',
    total: 'Total ({periodo})',
    pixInstrucao: 'Escanea el QR Code para pagar con Pix:',
    pixAlt: 'QR Code Pix',
    pixAtivacao: 'Tu plan se activa automáticamente tras el pago.',
    carregando: 'Cargando checkout...',
    msgChaveAusente: 'Checkout no disponible (falta la clave de Mercado Pago).',
    msgErroCarregar: 'Error al cargar el checkout. Inténtalo de nuevo.',
    msgErroIniciar: 'Error al iniciar el checkout.',
    msgPendente: 'Pago {status}. Lo confirmaremos en cuanto se acredite.',
    statusPendente: 'pendiente',
    msgFalhaConcluir: 'No se pudo completar el pago.',
  },
}
export default planos
