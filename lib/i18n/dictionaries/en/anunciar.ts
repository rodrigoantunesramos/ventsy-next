// English dictionary — `anunciar` namespace. Typed by `T` (from pt/anunciar) to
// guarantee key parity.
//
// NOTE: `comodidadesLabels` keys are the canonical PT values stored in the DB.
// Only the values (labels) are translated for display.
import type { T } from '../pt/anunciar'

const anunciar: T = {
  // ── Metadata (<head>) ──
  meta: {
    title: 'List your space',
    description:
      'List your event space on VENTSY and reach thousands of people looking for the ideal venue. Quick and free signup.',
    ogTitle: 'List your space · VENTSY',
    ogDescription: 'List your event space and receive requests from people looking for the ideal venue. Free to get started.',
  },

  hero: {
    tag: 'List for free',
    titulo: 'List your space',
    subtitulo: 'Fill in your space details. It will appear in search as soon as it is published.',
  },
  avisoDeslogadoInicio: 'You are browsing logged out.',
  avisoDeslogadoEntre: 'Sign in',
  avisoDeslogadoOu: 'or',
  avisoDeslogadoCriar: 'create your account',
  avisoDeslogadoFim: 'to publish your listing.',
  secaoSobre: {
    titulo: 'About the space',
    nomeLabel: 'Space name *',
    nomePlaceholder: 'e.g. Recanto Verde Estate',
    categoriaLabel: 'Category *',
    categoriaPlaceholder: 'Select the category',
    descricaoLabel: 'Description',
    descricaoPlaceholder: 'Tell us what makes your space special...',
  },
  secaoLocalizacao: {
    titulo: 'Location',
    estadoLabel: 'State *',
    estadoPlaceholder: 'State',
    cidadeLabel: 'City *',
    cidadePlaceholder: 'City',
    bairroLabel: 'Neighborhood',
    bairroPlaceholder: 'Neighborhood',
    enderecoLabel: 'Address',
    enderecoPlaceholder: 'Street, number',
    ajuda: 'We use city and state to place your space on the search map.',
  },
  secaoCapacidade: {
    titulo: 'Capacity and price',
    capacidadeLabel: 'Capacity (people)',
    capacidadePlaceholder: 'e.g. 150',
    valorHoraLabel: 'Price per hour (R$)',
    valorHoraPlaceholder: 'e.g. 500',
    valorDiariaLabel: 'Daily rate (R$)',
    valorDiariaPlaceholder: 'e.g. 3000',
    ajuda: 'Enter at least one of the values.',
  },
  secaoComodidades: {
    titulo: 'Amenities',
  },
  comodidadesLabels: {
    'Wi-Fi': 'Wi-Fi',
    'Estacionamento': 'Parking',
    'Churrasqueira': 'Barbecue',
    'Piscina': 'Pool',
    'Ar-condicionado': 'Air conditioning',
    'Som ambiente': 'Background music',
    'Cozinha equipada': 'Equipped kitchen',
    'Acessibilidade': 'Accessibility',
    'Segurança': 'Security',
    'Área verde': 'Green area',
    'Banheiros': 'Restrooms',
    'Gerador': 'Generator',
  },
  secaoContato: {
    titulo: 'Contact and media',
    whatsappLabel: 'WhatsApp',
    whatsappPlaceholder: '(21) 99999-9999',
    fotoLabel: 'Cover photo',
    fotoPreviewAlt: 'Cover photo preview',
    fotoAjuda: 'JPG, PNG or WebP, up to 8 MB. You can add more photos later in the dashboard.',
  },
  publicar: 'Publish space',
  publicando: 'Publishing...',
  erros: {
    imagemTipo: 'Select an image file (JPG, PNG or WebP).',
    imagemTamanho: 'The image must be 8 MB or smaller.',
    nomeCurto: 'Enter the space name (min. 3 characters).',
    categoria: 'Choose the space category.',
    estado: 'Select the state.',
    cidade: 'Enter the city.',
    preco: 'Enter at least one price (per hour or daily).',
    naoLogado: 'You need to be logged in to publish. Sign in or create your account.',
    publicarPrefixo: 'Could not publish:',
    publicarGenerico: 'An error occurred while publishing. Please try again.',
  },
}

export default anunciar
