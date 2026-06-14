/** @type {import('next').NextConfig} */

// Headers de segurança aplicados a todas as respostas. HSTS já é injetado pela
// Vercel. A CSP fica para uma etapa dedicada (exige nonce + teste em
// Report-Only para não quebrar Next/Supabase/Mercado Pago/MapTiler).
const securityHeaders = [
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(self), microphone=(), geolocation=(self), payment=(self)',
  },
]

const nextConfig = {
  images: {
    // Fotos reais ficam no bucket do Supabase Storage. picsum só alimenta o
    // catálogo de demonstração (DEMO_PROPS) em desenvolvimento.
    remotePatterns: [
      { protocol: 'https', hostname: 'hxvlfalgrduitevbhqvq.supabase.co', pathname: '/storage/v1/object/public/**' },
      { protocol: 'https', hostname: 'picsum.photos' },
      { protocol: 'https', hostname: 'fastly.picsum.photos' },
    ],
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }]
  },
}

module.exports = nextConfig
