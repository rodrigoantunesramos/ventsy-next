// Diccionario en español — namespace `anunciar`. Tipado por `T` (de pt/anunciar)
// para garantizar la paridad de claves.
//
// NOTA: las claves de `comodidadesLabels` son los valores canónicos en PT que se
// guardan en la base de datos. Solo se traducen los valores (etiquetas).
import type { T } from '../pt/anunciar'

const anunciar: T = {
  hero: {
    tag: 'Anuncia gratis',
    titulo: 'Anuncia tu espacio',
    subtitulo: 'Completa la información de tu espacio. Aparecerá en la búsqueda en cuanto se publique.',
  },
  avisoDeslogadoInicio: 'Estás navegando sin haber iniciado sesión.',
  avisoDeslogadoEntre: 'Inicia sesión',
  avisoDeslogadoOu: 'o',
  avisoDeslogadoCriar: 'crea tu cuenta',
  avisoDeslogadoFim: 'para publicar el anuncio.',
  secaoSobre: {
    titulo: 'Sobre el espacio',
    nomeLabel: 'Nombre del espacio *',
    nomePlaceholder: 'Ej: Finca Recanto Verde',
    categoriaLabel: 'Categoría *',
    categoriaPlaceholder: 'Selecciona la categoría',
    descricaoLabel: 'Descripción',
    descricaoPlaceholder: 'Cuenta qué hace especial a tu espacio...',
  },
  secaoLocalizacao: {
    titulo: 'Ubicación',
    estadoLabel: 'Estado *',
    estadoPlaceholder: 'Estado',
    cidadeLabel: 'Ciudad *',
    cidadePlaceholder: 'Ciudad',
    bairroLabel: 'Barrio',
    bairroPlaceholder: 'Barrio',
    enderecoLabel: 'Dirección',
    enderecoPlaceholder: 'Calle, número',
    ajuda: 'Usamos la ciudad y el estado para ubicar tu espacio en el mapa de la búsqueda.',
  },
  secaoCapacidade: {
    titulo: 'Capacidad y precio',
    capacidadeLabel: 'Capacidad (personas)',
    capacidadePlaceholder: 'Ej: 150',
    valorHoraLabel: 'Precio por hora (R$)',
    valorHoraPlaceholder: 'Ej: 500',
    valorDiariaLabel: 'Precio por día (R$)',
    valorDiariaPlaceholder: 'Ej: 3000',
    ajuda: 'Indica al menos uno de los valores.',
  },
  secaoComodidades: {
    titulo: 'Comodidades',
  },
  comodidadesLabels: {
    'Wi-Fi': 'Wi-Fi',
    'Estacionamento': 'Estacionamiento',
    'Churrasqueira': 'Parrilla',
    'Piscina': 'Piscina',
    'Ar-condicionado': 'Aire acondicionado',
    'Som ambiente': 'Música ambiental',
    'Cozinha equipada': 'Cocina equipada',
    'Acessibilidade': 'Accesibilidad',
    'Segurança': 'Seguridad',
    'Área verde': 'Área verde',
    'Banheiros': 'Baños',
    'Gerador': 'Generador',
  },
  secaoContato: {
    titulo: 'Contacto y medios',
    whatsappLabel: 'WhatsApp',
    whatsappPlaceholder: '(21) 99999-9999',
    fotoLabel: 'Foto de portada',
    fotoPreviewAlt: 'Vista previa de la foto de portada',
    fotoAjuda: 'JPG, PNG o WebP, hasta 8 MB. Podrás añadir más fotos después, en el panel.',
  },
  publicar: 'Publicar espacio',
  publicando: 'Publicando...',
  erros: {
    imagemTipo: 'Selecciona un archivo de imagen (JPG, PNG o WebP).',
    imagemTamanho: 'La imagen debe pesar como máximo 8 MB.',
    nomeCurto: 'Indica el nombre del espacio (mín. 3 caracteres).',
    categoria: 'Elige la categoría del espacio.',
    estado: 'Selecciona el estado.',
    cidade: 'Indica la ciudad.',
    preco: 'Indica al menos un precio (por hora o por día).',
    naoLogado: 'Debes haber iniciado sesión para publicar. Inicia sesión o crea tu cuenta.',
    publicarPrefixo: 'No se pudo publicar:',
    publicarGenerico: 'Ocurrió un error al publicar. Inténtalo de nuevo.',
  },
}

export default anunciar
