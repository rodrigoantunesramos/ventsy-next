'use client'

import { useEffect, useRef, useState } from 'react'
import Script from 'next/script'
import { authHeaders } from '@/lib/supabase'
import { brl } from '@/lib/fees'

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    MercadoPago?: any
  }
}

type Pix = { qr_code: string; qr_code_base64: string }

export default function CheckoutPlano({
  plano,
  periodo,
  valor,
  email,
  onPaid,
  onClose,
}: {
  plano: string
  periodo: string
  valor: number
  email?: string
  onPaid: () => void
  onClose: () => void
}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const brickRef = useRef<any>(null)
  const [sdkLoaded, setSdkLoaded] = useState(false)
  const [ready, setReady] = useState(false)
  const [pix, setPix] = useState<Pix | null>(null)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    if (!sdkLoaded || pix || brickRef.current) return
    const pk = process.env.NEXT_PUBLIC_MP_PUBLIC_KEY
    if (!pk || !window.MercadoPago) { setMsg('Checkout indisponível (chave do Mercado Pago ausente).'); return }

    const mp = new window.MercadoPago(pk, { locale: 'pt-BR' })
    mp.bricks()
      .create('payment', 'mp-brick-plano', {
        initialization: { amount: valor, payer: email ? { email } : undefined },
        customization: { paymentMethods: { creditCard: 'all', debitCard: 'all', bankTransfer: 'all', ticket: [], mercadoPago: [] } },
        callbacks: {
          onReady: () => setReady(true),
          onError: () => setMsg('Erro ao carregar o checkout. Tente novamente.'),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          onSubmit: async ({ formData }: any) => {
            setMsg('')
            try {
              const res = await fetch('/api/pagamentos/plano', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
                body: JSON.stringify({ plano, periodo, formData }),
              })
              const json = await res.json()
              if (json.error) { setMsg(json.error); return }
              if (json.status === 'approved') { onPaid() }
              else if (json.pix) { setPix(json.pix) }
              else { setMsg('Pagamento ' + (json.status || 'pendente') + '. Confirmaremos assim que cair.') }
            } catch {
              setMsg('Não foi possível concluir o pagamento.')
            }
          },
        },
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then((c: any) => { brickRef.current = c })
      .catch(() => setMsg('Erro ao iniciar o checkout.'))

    return () => {
      try { brickRef.current?.unmount?.() } catch { /* noop */ }
      brickRef.current = null
    }
  }, [sdkLoaded, pix, email, valor, plano, periodo, onPaid])

  return (
    <div className="fixed inset-0 bg-black/50 z-[10000] flex items-start justify-center overflow-y-auto p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full my-8 p-6 relative shadow-pop">
        <button onClick={onClose} className="absolute top-4 right-4 w-9 h-9 rounded-full border border-gray-200 hover:bg-gray-50 flex items-center justify-center text-ink-muted">✕</button>
        <h3 className="font-display text-xl font-bold text-ink mb-1">Assinar plano {plano.toUpperCase()}</h3>
        <p className="text-sm text-ink-muted mb-4">Pix ou cartão, com segurança pelo Mercado Pago.</p>

        <div className="rounded-xl bg-gray-50 border border-gray-200 p-3 text-sm mb-4 flex justify-between font-bold text-ink">
          <span>Total ({periodo})</span>
          <span>{brl(valor)}</span>
        </div>

        {pix ? (
          <div className="text-center">
            <p className="text-sm text-ink-soft mb-3">Escaneie o QR Code para pagar via Pix:</p>
            {pix.qr_code_base64 && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`data:image/png;base64,${pix.qr_code_base64}`} alt="QR Code Pix" className="w-56 h-56 mx-auto rounded-lg" />
            )}
            <textarea readOnly value={pix.qr_code} onClick={(e) => (e.target as HTMLTextAreaElement).select()} className="w-full mt-3 text-xs border border-gray-200 rounded-lg p-2 h-20 resize-none" />
            <p className="text-xs text-ink-muted mt-2">Seu plano é ativado automaticamente após o pagamento.</p>
          </div>
        ) : (
          <>
            <div id="mp-brick-plano" />
            {!ready && <p className="text-sm text-ink-muted text-center py-4">Carregando checkout...</p>}
          </>
        )}

        {msg && <p className="text-sm text-red-600 mt-3 text-center">{msg}</p>}
      </div>

      <Script src="https://sdk.mercadopago.com/js/v2" strategy="afterInteractive" onLoad={() => setSdkLoaded(true)} />
    </div>
  )
}
