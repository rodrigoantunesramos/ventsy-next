'use client'

// Central de Ajuda do cliente — /client/ajuda. FAQ estático + CTA de suporte.
import Link from 'next/link'

const FAQ = [
  { q: 'Como solicito uma reserva?', a: 'Encontre um espaço em "Explorar espaços", abra a página dele e envie sua solicitação. Ela aparece em "Minhas Reservas" e o anfitrião aprova.' },
  { q: 'Como acompanho meu evento?', a: 'Em "Meus Eventos" você acompanha tudo: financeiro, contrato, convidados (RSVP), mensagens e avaliação — quando o organizador libera o acesso.' },
  { q: 'Como pago pelo meu evento?', a: 'No seu evento, aba Financeiro, você paga cada parcela via PIX assim que o organizador as disponibiliza.' },
  { q: 'Como falo com o organizador?', a: 'Use "Conversas" ou a aba Mensagens do seu evento — você fala direto com o anfitrião, em tempo real.' },
  { q: 'Como assino o contrato?', a: 'Quando o organizador enviar, o contrato aparece na aba Contrato do seu evento, com o botão "Ver e assinar".' },
  { q: 'Como avalio depois do evento?', a: 'Na aba Avaliação do seu evento você avalia o evento (de forma reservada ao organizador) e o espaço (avaliação pública, com estrelas).' },
]

export default function AjudaPage() {
  return (
    <div className="mx-auto max-w-[760px] px-6 py-7">
      <div className="mb-6">
        <h1 className="m-0 text-[1.5rem] font-extrabold text-gray-900">❓ Central de Ajuda</h1>
        <p className="mt-1.5 text-[.88rem] text-gray-400">Tire suas dúvidas sobre reservas, pagamentos e eventos.</p>
      </div>

      <div className="space-y-3">
        {FAQ.map((f) => (
          <details key={f.q} className="group rounded-2xl border border-[#f0f0f0] bg-white px-5 py-4 shadow-[0_2px_12px_rgba(0,0,0,.05)]">
            <summary className="flex cursor-pointer list-none items-center justify-between font-semibold text-[.92rem] text-gray-900">
              {f.q}
              <span className="text-gray-300 transition-transform group-open:rotate-180">⌄</span>
            </summary>
            <p className="mt-2 text-[.86rem] leading-[1.55] text-gray-600">{f.a}</p>
          </details>
        ))}
      </div>

      <div className="mt-6 rounded-2xl border border-[#f0f0f0] bg-white p-5 text-center shadow-[0_2px_12px_rgba(0,0,0,.05)]">
        <div className="text-[.95rem] font-bold text-gray-900">Ainda precisa de ajuda?</div>
        <p className="mx-auto mt-1 max-w-sm text-[.84rem] text-gray-500">Fale com a nossa equipe — respondemos o quanto antes.</p>
        <Link href="/fale-conosco" className="mt-4 inline-block rounded-xl bg-[#ff385c] px-6 py-2.5 text-[.9rem] font-bold text-white no-underline transition-colors hover:bg-[#e0304f]">
          Falar com o suporte
        </Link>
      </div>
    </div>
  )
}
