// English dictionary — `vagas` namespace. Typed by `T` (from pt/vagas) to
// guarantee key parity.
import type { T } from '../pt/vagas'

const vagas: T = {
  // ── Metadata (generateMetadata) ──
  meta: {
    naoEncontrada: 'Job not found',
    // Interpolation: `${titulo} position at ${SITE_NAME}.` — the parts below
    // wrap the job title (coming from the DB).
    descFallbackA: 'Position',
    descFallbackB: 'Apply online.',
  },

  // ── Job detail sections ──
  secaoDescricao: 'Description',
  secaoRequisitos: 'Requirements',
  secaoBeneficios: 'Benefits',

  // ── Employment type labels (badges) ──
  contrato: {
    clt: 'Full-time',
    horista: 'Hourly',
    mei: 'Contractor',
    estagio: 'Internship',
    freelancer: 'Freelancer',
  },

  // ── Application block ──
  candidateSe: 'Apply',

  // ── Application form ──
  nomeLabel: 'Full name *',
  emailLabel: 'Email',
  telefoneLabel: 'Phone',
  curriculoLabel: 'Resume link',
  mensagemLabel: 'Message',
  mensagemPlaceholder: 'Tell us why you are a good match for this position.',
  btnEnviar: 'Submit application',
  btnEnviando: 'Submitting…',

  // ── Messages / validation ──
  erroNome: 'Please enter your name.',
  erroEnvioGenerico: 'Could not submit. Please try again.',
  erroRede: 'Network error. Please try again.',

  // ── Success ──
  sucessoTitulo: 'Application submitted!',
  sucessoTexto: 'Thanks for your interest. We will get in touch if there is a match.',

  // ── Job not found page ──
  naoEncontrada: {
    titulo: 'Job not found',
    texto: 'This position may have been closed or the link is incorrect.',
    voltar: 'Back to site',
  },
}

export default vagas
