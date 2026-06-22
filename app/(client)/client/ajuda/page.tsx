'use client'

// Central de Ajuda do cliente — /client/ajuda. FAQ estático + CTA de suporte.
import Link from 'next/link'
import { PageHeader, Card, btnPrimary } from '../_ui'

const FAQ = [
  { q: 'Como solicito uma reserva?', a: 'Encontre um espaço em "Explorar espaços", abra a página dele e envie sua solicitação. Ela aparece em "Reservas" e o anfitrião aprova.' },
  { q: 'Como acompanho meu evento?', a: 'Em "Meus eventos" você acompanha tudo: financeiro, contrato, convidados (RSVP), mensagens e avaliação — quando o organizador libera o acesso.' },
  { q: 'Como pago pelo meu evento?', a: 'No seu evento, aba Financeiro, você paga cada parcela via PIX assim que o organizador as disponibiliza. O resumo de todas as parcelas fica em "Pagamentos".' },
  { q: 'Como funcionam os créditos e cupons?', a: 'Você ganha créditos indicando amigos (em "Indique e ganhe") e pode resgatá-los como cupom de desconto na "Carteira".' },
  { q: 'Como falo com o organizador?', a: 'Use "Conversas" ou a aba Mensagens do seu evento — você fala direto com o anfitrião, em tempo real.' },
  { q: 'Como avalio depois do evento?', a: 'Na aba Avaliação do seu evento você avalia o evento (de forma reservada ao organizador) e o espaço (avaliação pública, com estrelas).' },
]

export default function AjudaPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader eyebrow="Conta" title="Central de ajuda" subtitle="Tire suas dúvidas sobre reservas, pagamentos, recompensas e eventos." />

      <div className="space-y-3">
        {FAQ.map((f) => (
          <details key={f.q} className="group rounded-2xl border border-line bg-surface px-5 py-4 shadow-card">
            <summary className="flex cursor-pointer list-none items-center justify-between text-[.92rem] font-semibold text-ink">
              {f.q}
              <span className="text-ink-muted transition-transform group-open:rotate-180">⌄</span>
            </summary>
            <p className="mt-2 text-[.86rem] leading-[1.55] text-ink-soft">{f.a}</p>
          </details>
        ))}
      </div>

      <Card className="text-center">
        <div className="text-[.95rem] font-bold text-ink">Ainda precisa de ajuda?</div>
        <p className="mx-auto mt-1 max-w-sm text-[.84rem] text-ink-muted">Fale com a nossa equipe — respondemos o quanto antes.</p>
        <Link href="/fale-conosco" className={`${btnPrimary} mt-4`}>Falar com o suporte</Link>
      </Card>
    </div>
  )
}
