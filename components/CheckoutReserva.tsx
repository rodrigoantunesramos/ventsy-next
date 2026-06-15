'use client'

import { useEffect, useRef, useState } from 'react'
import Script from 'next/script'
import { authHeaders } from '@/lib/supabase'
import { calcularTaxas } from '@/lib/fees'
import { useTOptional } from '@/components/i18n/I18nProvider'
import { formatMoney } from '@/lib/i18n/format'
import propriedadePt from '@/lib/i18n/dictionaries/pt/propriedade'
import propriedadeEn from '@/lib/i18n/dictionaries/en/propriedade'
import propriedadeEs from '@/lib/i18n/dictionaries/es/propriedade'
import type { Locale } from '@/lib/i18n/config'

// Namespace `propriedade` por locale (índice central ainda não registra a chave).
const propDicts: Record<Locale, typeof propriedadePt> = { pt: propriedadePt, en: propriedadeEn, es: propriedadeEs }

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    MercadoPago?: any
  }
}

type Pix = { qr_code: string; qr_code_base64: string; ticket_url?: string }

export default function CheckoutReserva({
  reservaId,
  valorBase,
  email,
  onPaid,
  onClose,
}: {
  reservaId: string
  valorBase: number
  email?: string
  onPaid: () => void
  onClose: () => void
}) {
  const { locale } = useTOptional()
  const t = propDicts[locale] ?? propriedadePt
  const fees = calcularTaxas(valorBase)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const brickRef = useRef<any>(null)
  const [sdkLoaded, setSdkLoaded] = useState(false)
  const [ready, setReady] = useState(false)
  const [pix, setPix] = useState<Pix | null>(null)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    if (!sdkLoaded || pix || brickRef.current) return
    const pk = process.env.NEXT_PUBLIC_MP_PUBLIC_KEY
    if (!pk || !window.MercadoPago) { setMsg(t.checkout.chaveAusente); return }

    const mp = new window.MercadoPago(pk, { locale: locale === 'pt' ? 'pt-BR' : locale === 'es' ? 'es-AR' : 'en-US' })
    const bricks = mp.bricks()
    bricks
      .create('payment', 'mp-brick-container', {
        initialization: { amount: fees.totalHospede, payer: email ? { email } : undefined },
        customization: {
          paymentMethods: { creditCard: 'all', debitCard: 'all', bankTransfer: 'all', ticket: [], mercadoPago: [] },
        },
        callbacks: {
          onReady: () => setReady(true),
          onError: () => setMsg(t.checkout.erroCarregar),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          onSubmit: async ({ formData }: any) => {
            setMsg('')
            try {
              const res = await fetch('/api/pagamentos/checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
                body: JSON.stringify({ reserva_id: reservaId, formData }),
              })
              const json = await res.json()
              if (json.error) { setMsg(json.error); return }
              if (json.status === 'approved') { onPaid() }
              else if (json.pix) { setPix(json.pix) }
              else { setMsg(t.checkout.pagamentoStatusA + ' ' + (json.status || t.checkout.statusPendente) + '. ' + t.checkout.pagamentoStatusB) }
            } catch {
              setMsg(t.checkout.erroConcluir)
            }
          },
        },
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then((c: any) => { brickRef.current = c })
      .catch(() => setMsg(t.checkout.erroIniciar))

    return () => {
      try { brickRef.current?.unmount?.() } catch { /* noop */ }
      brickRef.current = null
    }
  }, [sdkLoaded, pix, email, fees.totalHospede, reservaId, onPaid, locale, t])

  return (
    <div className="fixed inset-0 bg-black/50 z-[10000] flex items-start justify-center overflow-y-auto p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full my-8 p-6 relative shadow-pop">
        <button onClick={onClose} className="absolute top-4 right-4 w-9 h-9 rounded-full border border-gray-200 hover:bg-gray-50 flex items-center justify-center text-ink-muted">✕</button>
        <h3 className="font-display text-xl font-bold text-ink mb-1">{t.checkout.titulo}</h3>
        <p className="text-sm text-ink-muted mb-4">{t.checkout.subtitulo}</p>

        <div className="rounded-xl bg-gray-50 border border-gray-200 p-3 text-sm mb-4 space-y-1">
          <div className="flex justify-between"><span className="text-ink-muted">{t.checkout.aluguel}</span><span>{formatMoney(locale, fees.valorBase)}</span></div>
          {fees.taxaHospede > 0 && (
            <div className="flex justify-between"><span className="text-ink-muted">{t.checkout.taxaServico}</span><span>{formatMoney(locale, fees.taxaHospede)}</span></div>
          )}
          <div className="flex justify-between font-bold text-ink pt-1.5 mt-1 border-t border-gray-200"><span>{t.checkout.total}</span><span>{formatMoney(locale, fees.totalHospede)}</span></div>
        </div>

        {pix ? (
          <div className="text-center">
            <p className="text-sm text-ink-soft mb-3">{t.checkout.pixInstrucao}</p>
            {pix.qr_code_base64 && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`data:image/png;base64,${pix.qr_code_base64}`} alt={t.checkout.qrAlt} className="w-56 h-56 mx-auto rounded-lg" />
            )}
            <textarea
              readOnly
              value={pix.qr_code}
              onClick={(e) => (e.target as HTMLTextAreaElement).select()}
              className="w-full mt-3 text-xs border border-gray-200 rounded-lg p-2 h-20 resize-none"
            />
            <p className="text-xs text-ink-muted mt-2">{t.checkout.pixConfirmacao}</p>
          </div>
        ) : (
          <>
            <div id="mp-brick-container" />
            {!ready && <p className="text-sm text-ink-muted text-center py-4">{t.checkout.carregando}</p>}
          </>
        )}

        {msg && <p className="text-sm text-red-600 mt-3 text-center">{msg}</p>}
      </div>

      <Script src="https://sdk.mercadopago.com/js/v2" strategy="afterInteractive" onLoad={() => setSdkLoaded(true)} />
    </div>
  )
}
