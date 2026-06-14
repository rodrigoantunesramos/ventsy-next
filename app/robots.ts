import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/site'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/painel/',       // área logada do proprietário
        '/admin/',        // painel administrativo
        '/api/',          // rotas de API
        '/contrato/',     // documentos por token (privados)
        '/proposta/',
        '/ingressos/',
        '/feedback/',
        '/pesquisa/',
        '/redefinir-senha',
        '/meus-espacos',  // redirects para o painel
        '/ganhos',
        '/reservas',
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  }
}
