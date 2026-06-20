// Namespace `planos` — English. Typed by `T` (from pt/planos) for key parity.
import type { T } from '../pt/planos'

const planos: T = {
  meta: {
    title: 'Plans and pricing',
    description:
      'Choose the ideal plan to list your event venue on VENTSY: free Basic, Pro and Ultra. More visibility, photos and premium features.',
    ogTitle: 'Plans and pricing · VENTSY',
    ogDescription:
      'Free Basic, Pro and Ultra: choose the ideal plan to list your event venue.',
  },
  alertas: {
    pagamentoAprovadoRedir: '✅ Payment approved! Your plan has been activated. Redirecting...',
    pagamentoErro: '❌ There was a problem with the payment. Please try again.',
    pagamentoPendente: '⏳ Payment pending. You will receive a confirmation email.',
    pagamentoAprovado: '✅ Payment approved! Your plan has been activated.',
  },
  hero: {
    tituloA: 'Choose the plan',
    tituloB: "that's right for you",
    subtitulo:
      'List your venue to thousands of people looking for the perfect place for their events.',
    mensal: 'Monthly',
    anual: 'Yearly',
    badgeDesconto: '−20%',
  },
  precoGratis: 'Free',
  cifrao: 'R$',
  porMes: '/month',
  equivaleMensal: 'Equivalent to {valor}/month on the monthly plan',
  basico: {
    nome: 'Basic',
    titulo: 'To get started',
    desc: 'For those just starting to promote their venue.',
    cta: 'Start for free',
    features: {
      f1: 'List 1 property',
      f2: 'Up to 5 photos in the gallery',
      f3: 'Direct WhatsApp button',
      f4: 'Performance report',
      f5: 'Verification badge',
    },
  },
  pro: {
    badgePopular: 'Most popular',
    nome: 'Pro',
    titulo: 'Professional',
    desc: 'Ideal for venues and professional event halls.',
    ctaAssinar: '⭐ Subscribe to Pro',
    ctaAguarde: '⏳ Please wait...',
    features: {
      f1: 'Everything in the Basic plan',
      f2: 'Unlimited photos',
      f3: 'Direct WhatsApp button',
      f4: 'Detailed reports',
      f5: 'Availability calendar',
      f6: 'Priority support',
    },
  },
  ultra: {
    nome: 'Ultra',
    titulo: 'Maximum reach',
    desc: 'The most leads for your business.',
    ctaAssinar: '🚀 Subscribe to Ultra',
    ctaAguarde: '⏳ Please wait...',
    features: {
      f1: 'Everything in the Pro plan',
      f2: 'Video upload',
      f3: 'Appear at the top of searches',
      f4: 'Premium Verification badge',
      f5: 'Featured on the site Home',
      f6: 'PDF contract generator',
    },
  },
  nota: {
    duvidas: 'Questions about the plans?',
    verCobranca: 'See how billing works',
    ou: 'or',
    faleConosco: 'talk to us',
  },
  cta: {
    trialTitulo: '1 month free on Ultra',
    trialDesc:
      'List your property now and try all the premium features at no cost. After the trial, you continue on the Basic plan for free.',
    botao: 'List your property',
    nota: 'Your listing will stay under review until approved by the VENTSY team before going public.',
  },
  checkout: {
    titulo: 'Subscribe to the {plano} plan',
    subtitulo: 'Pix or card, securely via Mercado Pago.',
    fechar: 'Close',
    total: 'Total ({periodo})',
    pixInstrucao: 'Scan the QR Code to pay via Pix:',
    pixAlt: 'Pix QR Code',
    pixAtivacao: 'Your plan is activated automatically after payment.',
    carregando: 'Loading checkout...',
    msgChaveAusente: 'Checkout unavailable (Mercado Pago key missing).',
    msgErroCarregar: 'Error loading the checkout. Please try again.',
    msgErroIniciar: 'Error starting the checkout.',
    msgPendente: 'Payment {status}. We will confirm as soon as it clears.',
    statusPendente: 'pending',
    msgFalhaConcluir: 'The payment could not be completed.',
  },
}
export default planos
