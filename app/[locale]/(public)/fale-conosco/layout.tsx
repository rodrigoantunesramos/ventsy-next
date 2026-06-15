import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Fale conosco',
  description:
    'Dúvidas, sugestões ou suporte? Fale com a equipe VENTSY por WhatsApp, e-mail ou pelo formulário de contato. Respondemos em até 48h úteis.',
  alternates: { canonical: '/fale-conosco' },
  openGraph: {
    title: 'Fale conosco · VENTSY',
    description: 'Fale com a equipe VENTSY por WhatsApp, e-mail ou formulário de contato.',
    url: '/fale-conosco',
  },
}

export default function FaleConoscoLayout({ children }: { children: React.ReactNode }) {
  return children
}
