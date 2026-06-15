import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/site'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/', // inclui /pt /en /es (páginas públicas localizadas)
      disallow: [
        '/painel/', // área logada do proprietário
        '/admin/', // painel administrativo
        '/client/', // área do cliente/contratante
        '/api/', // rotas de API
        '/auth/', // callbacks de autenticação por token
        '/contrato/', // documentos por token (privados)
        '/proposta/',
        '/ingressos/',
        '/feedback/',
        '/pesquisa/',
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  }
}
