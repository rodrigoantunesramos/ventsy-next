// Identidade do site para SEO (metadata, sitemap, robots, JSON-LD).
// Usa a env de produção (NEXT_PUBLIC_SITE_URL) com fallback no domínio apex.
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://ventsy.com.br').replace(/\/+$/, '')
export const SITE_NAME = 'VENTSY'
export const SITE_DESCRIPTION =
  'Encontre e reserve o espaço perfeito para o seu evento no Brasil: casas de festa, sítios, salões, rooftops, chácaras e muito mais.'

export const abs = (path = ''): string => `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`
