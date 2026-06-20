'use client'

// Gate de página inteira para um módulo NÃO liberado no plano do dono.
// Mostra o cadeado + caminho de upgrade de plano e, se o módulo for vendável
// avulso, o caminho de compra self-service (CheckoutModulo, ativa na hora).

import { useState } from 'react'
import Link from 'next/link'
import CheckoutModulo from '@/components/CheckoutModulo'

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export default function UpgradeGate({
  moduloKey,
  label,
  grupo,
  planoMinLabel,
  vendavel,
  precoAvulso,
  email,
}: {
  moduloKey: string
  label: string
  grupo?: string
  planoMinLabel?: string | null
  vendavel?: boolean
  precoAvulso?: number
  email?: string
}) {
  const [anual, setAnual] = useState(false)
  const [checkout, setCheckout] = useState(false)
  const [pago, setPago] = useState(false)

  const podeComprar = !!vendavel && (precoAvulso ?? 0) > 0
  const mensal = precoAvulso ?? 0
  const valor = anual ? Math.round(mensal * 0.8) * 12 : mensal

  if (pago) {
    return (
      <div className="mx-auto max-w-2xl py-10 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
          <IcoCheck />
        </div>
        <h1 className="text-xl font-bold text-ink">Pagamento recebido!</h1>
        <p className="mx-auto mt-1 max-w-md text-sm text-ink-muted">
          Estamos ativando o módulo <strong>{label}</strong>. Isso leva alguns instantes — recarregue a página.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="mt-5 inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white hover:bg-brand-600"
        >
          Recarregar
        </button>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl">
      <p className="text-[0.72rem] font-bold uppercase tracking-[0.08em] text-ink-muted/70">{grupo || 'Módulo'}</p>
      <h1 className="mt-0.5 text-xl font-bold text-ink sm:text-2xl">{label}</h1>

      <div className="mt-6 overflow-hidden rounded-2xl border border-black/[0.06] bg-white shadow-card">
        <div className="flex flex-col items-center gap-4 bg-gradient-to-br from-amber-50 to-brand-50 px-6 py-10 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-brand text-white">
            <IcoLock />
          </div>
          <div>
            <h3 className="font-display text-lg font-bold text-ink">
              {planoMinLabel ? `Disponível no plano ${planoMinLabel}` : 'Recurso de plano superior'}
            </h3>
            <p className="mx-auto mt-1 max-w-md text-sm text-ink-muted">
              O módulo <strong>{label}</strong> não está incluído no seu plano atual. Faça upgrade para
              desbloquear ele {podeComprar ? 'e os demais recursos do plano — ou leve só este módulo como add-on.' : 'e tudo que vem junto.'}
            </p>
          </div>
          <Link
            href="/painel/planos"
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-brand px-5 py-2.5 text-sm font-bold text-white hover:opacity-90"
          >
            {planoMinLabel ? `Fazer upgrade para ${planoMinLabel}` : 'Conhecer os planos'}
          </Link>
        </div>

        {podeComprar && (
          <div className="border-t border-black/[0.06] p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm font-bold text-ink">Só este módulo (add-on)</div>
                <p className="mt-0.5 text-xs text-ink-muted">Ative agora sem trocar de plano. Cancele quando quiser.</p>
              </div>
              <div className="flex items-center gap-2 rounded-full border border-black/10 bg-white p-1 text-xs">
                <button onClick={() => setAnual(false)} className={`rounded-full px-2.5 py-1 font-semibold transition ${!anual ? 'bg-ink text-white' : 'text-ink-muted'}`}>Mensal</button>
                <button onClick={() => setAnual(true)} className={`rounded-full px-2.5 py-1 font-semibold transition ${anual ? 'bg-ink text-white' : 'text-ink-muted'}`}>Anual <span className="text-emerald-500">−20%</span></button>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
              <div className="flex items-end gap-1">
                <span className="text-2xl font-black text-ink">{brl(anual ? Math.round(mensal * 0.8) : mensal)}</span>
                <span className="mb-1 text-sm text-ink-muted">/mês</span>
                {anual && <span className="mb-1 ml-2 text-xs text-ink-muted">cobrança anual de {brl(valor)}</span>}
              </div>
              <button
                onClick={() => setCheckout(true)}
                className="rounded-xl border border-ink px-5 py-2.5 text-sm font-bold text-ink transition hover:bg-ink hover:text-white"
              >
                Desbloquear {label}
              </button>
            </div>
          </div>
        )}
      </div>

      {checkout && (
        <CheckoutModulo
          modulo={moduloKey}
          nome={label}
          periodo={anual ? 'anual' : 'mensal'}
          valor={valor}
          email={email}
          onClose={() => setCheckout(false)}
          onPaid={() => { setCheckout(false); setPago(true) }}
        />
      )}
    </div>
  )
}

const IcoLock = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
)
const IcoCheck = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 6 9 17l-5-5" />
  </svg>
)
