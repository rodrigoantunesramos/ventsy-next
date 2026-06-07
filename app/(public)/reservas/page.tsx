import { redirect } from 'next/navigation'

// Aposentada: as reservas foram consolidadas no painel. Preserva o ?mp= do callback
// do Mercado Pago para manter o toast de "conectado/erro".
export default function ReservasRedirect({
  searchParams,
}: {
  searchParams: { mp?: string }
}) {
  const mp = typeof searchParams?.mp === 'string' ? searchParams.mp : undefined
  redirect(mp ? `/painel/reservas?mp=${encodeURIComponent(mp)}` : '/painel/reservas')
}
