// Diccionario en español — namespace `vagas`. Tipado por `T` (de pt/vagas) para
// garantizar la paridad de claves.
import type { T } from '../pt/vagas'

const vagas: T = {
  // ── Metadatos (generateMetadata) ──
  meta: {
    naoEncontrada: 'Vacante no encontrada',
    // Interpolación: `Vacante de ${titulo} en ${SITE_NAME}.` — los fragmentos
    // de abajo envuelven el título de la vacante (proveniente del DB).
    descFallbackA: 'Vacante de',
    descFallbackB: 'Postúlate en línea.',
  },

  // ── Secciones del detalle de la vacante ──
  secaoDescricao: 'Descripción',
  secaoRequisitos: 'Requisitos',
  secaoBeneficios: 'Beneficios',

  // ── Etiquetas de tipo de contrato (badges) ──
  contrato: {
    clt: 'Tiempo completo',
    horista: 'Por horas',
    mei: 'Contratista',
    estagio: 'Prácticas',
    freelancer: 'Freelancer',
  },

  // ── Bloque de candidatura ──
  candidateSe: 'Postularse',

  // ── Formulario de candidatura ──
  nomeLabel: 'Nombre completo *',
  emailLabel: 'Correo electrónico',
  telefoneLabel: 'Teléfono',
  curriculoLabel: 'Enlace del currículum',
  mensagemLabel: 'Mensaje',
  mensagemPlaceholder: 'Cuéntanos por qué eres un buen match para la vacante.',
  btnEnviar: 'Enviar candidatura',
  btnEnviando: 'Enviando…',

  // ── Mensajes / validación ──
  erroNome: 'Indica tu nombre.',
  erroEnvioGenerico: 'No se pudo enviar. Inténtalo de nuevo.',
  erroRede: 'Error de red. Inténtalo de nuevo.',

  // ── Éxito ──
  sucessoTitulo: '¡Candidatura enviada!',
  sucessoTexto: 'Gracias por tu interés. Nos pondremos en contacto si hay un match.',

  // ── Página de vacante no encontrada ──
  naoEncontrada: {
    titulo: 'Vacante no encontrada',
    texto: 'Esta vacante puede haberse cerrado o el enlace es incorrecto.',
    voltar: 'Volver al sitio',
  },
}

export default vagas
