'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useSearchParams, useRouter } from 'next/navigation'
import { Suspense } from 'react'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import { supabase } from '@/lib/supabase'
import CheckoutPlano from '@/components/CheckoutPlano'
import { useT } from '@/components/i18n/I18nProvider'
import { formatMoney } from '@/lib/i18n/format'

/* ── preços padrão ── */
const PRECOS_DEFAULT = {
  pro:   { mensal: 79,  anual: 63  },
  ultra: { mensal: 149, anual: 119 },
}

/* ── flags padrão das features (textos vêm do dicionário) ── */
const FEATURE_FLAGS = {
  basico: [true, true, false, false, false],
  pro:    [true, true, true, true, true, true],
  ultra:  [true, true, true, true, true, true],
}

/* ── Alerta flutuante ── */
function AlertaFlutuante({ msg, cor, onClose }: { msg: string; cor: string; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 5000)
    return () => clearTimeout(t)
  }, [onClose])

  const borderMap: Record<string, string> = { green: '#22c55e', red: '#ff385c', orange: '#f59e0b' }
  const colorMap: Record<string, string>  = { green: '#166534', red: '#c0152b', orange: '#92400e' }

  return (
    <div
      className="fixed top-[90px] left-1/2 -translate-x-1/2 bg-white rounded-xl py-4 px-7 font-semibold z-[9999] shadow-[0_8px_32px_rgba(0,0,0,0.15)] max-w-[90%] text-center"
      style={{ border: `2px solid ${borderMap[cor] || cor}`, color: colorMap[cor] || cor }}
    >
      {msg}
    </div>
  )
}

function PlanosContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { dict, lhref, locale } = useT()
  const t = dict.planos

  // Features padrão construídas a partir do dicionário (texto) + flags (ok).
  const featuresDefault = {
    basico: FEATURE_FLAGS.basico.map((ok, i) => ({ ok, txt: t.basico.features[`f${i + 1}` as keyof typeof t.basico.features] })),
    pro:    FEATURE_FLAGS.pro.map((ok, i) => ({ ok, txt: t.pro.features[`f${i + 1}` as keyof typeof t.pro.features] })),
    ultra:  FEATURE_FLAGS.ultra.map((ok, i) => ({ ok, txt: t.ultra.features[`f${i + 1}` as keyof typeof t.ultra.features] })),
  }

  const [isAnual, setIsAnual]   = useState(false)
  const [precos, setPrecos]     = useState(PRECOS_DEFAULT)
  const [features, setFeatures] = useState(featuresDefault)
  const [loadingPlano, setLoadingPlano] = useState<string | null>(null)
  const [alerta, setAlerta]     = useState<{ msg: string; cor: string } | null>(null)
  const [checkout, setCheckout] = useState<{ plano: string; valor: number; periodo: string } | null>(null)
  const [userEmail, setUserEmail] = useState('')

  // Verifica retorno de pagamento
  useEffect(() => {
    const status = searchParams.get('pagamento')
    if (status === 'sucesso') {
      setAlerta({ msg: t.alertas.pagamentoAprovadoRedir, cor: 'green' })
      setTimeout(() => router.push('/painel'), 3000)
    } else if (status === 'erro') {
      setAlerta({ msg: t.alertas.pagamentoErro, cor: 'red' })
    } else if (status === 'pendente') {
      setAlerta({ msg: t.alertas.pagamentoPendente, cor: 'orange' })
    }
  }, [searchParams, router, t])

  // Carrega config dinâmica do Supabase
  useEffect(() => {
    const load = async () => {
      try {
        const { data, error } = await supabase.from('planos_config').select('*')
        if (error || !data) return

        type PlanoConfig = { id: string; preco: number; items?: string[] }
        const cfg: Record<string, PlanoConfig> = {}
        data.forEach((row: PlanoConfig) => { cfg[row.id] = row })

        const novosPrecos = { ...PRECOS_DEFAULT }
        if (cfg.pro)   { novosPrecos.pro   = { mensal: cfg.pro.preco,   anual: Math.round(cfg.pro.preco * 0.8)   } }
        if (cfg.ultra) { novosPrecos.ultra = { mensal: cfg.ultra.preco, anual: Math.round(cfg.ultra.preco * 0.8) } }
        setPrecos(novosPrecos)

        setFeatures(prev => {
          const novasFeatures = { ...prev }
          ;(['basico', 'pro', 'ultra'] as const).forEach(nome => {
            if (cfg[nome]?.items?.length) {
              novasFeatures[nome] = cfg[nome].items.map((txt: string) => ({ ok: true, txt }))
            }
          })
          return novasFeatures
        })
      } catch (_) {}
    }
    load()
  }, [])

  async function assinarPlano(plano: string) {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      router.push(`/login?redirect=/planos&plano=${plano}`)
      return
    }

    const base = plano === 'pro' ? pPro : pUltra
    const valor = isAnual ? base * 12 : base
    setUserEmail(session.user.email || '')
    setCheckout({ plano, valor, periodo: isAnual ? 'anual' : 'mensal' })
  }

  const pPro   = isAnual ? precos.pro.anual   : precos.pro.mensal
  const pUltra = isAnual ? precos.ultra.anual : precos.ultra.mensal

  return (
    <>
      <Header />

      {alerta && (
        <AlertaFlutuante msg={alerta.msg} cor={alerta.cor} onClose={() => setAlerta(null)} />
      )}

      {/* ── HERO ── */}
      <section className="pl-hero">
        <h1>{t.hero.tituloA} <span>{t.hero.tituloB}</span></h1>
        <p>{t.hero.subtitulo}</p>

        {/* Toggle mensal / anual */}
        <div className="pl-toggle-periodo">
          <span className={!isAnual ? 'pl-periodo-ativo' : ''}>{t.hero.mensal}</span>
          <div className={`pl-toggle-switch${isAnual ? ' pl-toggle-anual' : ''}`} onClick={() => setIsAnual(!isAnual)} />
          <span className={isAnual ? 'pl-periodo-ativo' : ''}>{t.hero.anual}</span>
          {isAnual && <span className="pl-badge-desconto">{t.hero.badgeDesconto}</span>}
        </div>
      </section>

      {/* ── Faixa de trial: o maior gancho (1 mês grátis no Ultra) sai do rodapé
          e aparece logo após o hero, acima da dobra. Leva ao cadastro — fluxo
          distinto dos botões "Assinar" (que vão ao checkout pago). ── */}
      <div className="mx-auto max-w-[1060px] px-[5%] pt-6">
        <Link
          href={lhref('/cadastro')}
          className="group flex flex-wrap items-center justify-center gap-x-3 gap-y-1 rounded-2xl border border-ouro-200 bg-ouro-50 px-5 py-3.5 text-center no-underline transition-colors hover:bg-ouro-100"
        >
          <span className="text-xl" aria-hidden="true">🎁</span>
          <span className="text-sm text-ink-soft">
            <strong className="font-bold text-ink">{t.cta.trialTitulo}</strong>
            <span className="text-ink-muted"> · {t.cta.semCartao}</span>
          </span>
          <span aria-hidden="true" className="font-bold text-ouro-600 transition-transform group-hover:translate-x-0.5">→</span>
        </Link>
      </div>

      {/* ── GRID ── */}
      <div className="pl-grid">

        {/* BÁSICO */}
        <div className="pl-card">
          <p className="pl-nome">{t.basico.nome}</p>
          <h2 className="pl-titulo">{t.basico.titulo}</h2>
          <p className="pl-desc">{t.basico.desc}</p>
          <div className="pl-preco pl-preco-gratis">
            <span className="pl-valor">{t.precoGratis}</span>
          </div>
          <div className="pl-divider" />
          <ul className="pl-features">
            {features.basico.map((f, i) => (
              <li key={i} className={f.ok ? 'pl-sim' : 'pl-nao'}>
                <span className="pl-feat-icon">{f.ok ? '✔' : '✗'}</span> {f.txt}
              </li>
            ))}
          </ul>
          <Link href={lhref('/cadastro')} className="pl-btn pl-btn-outline block text-center no-underline mt-5">
            {t.basico.cta}
          </Link>
        </div>

        {/* PRO — DESTAQUE */}
        <div className="pl-card pl-destaque">
          <span className="pl-badge-popular">{t.pro.badgePopular}</span>
          <p className="pl-nome">{t.pro.nome}</p>
          <h2 className="pl-titulo">{t.pro.titulo}</h2>
          <p className="pl-desc">{t.pro.desc}</p>
          <div className="pl-preco">
            <span className="pl-cifrao">{t.cifrao}</span>
            <span className="pl-valor">{pPro}</span>
            <span className="pl-periodo">{t.porMes}</span>
          </div>
          {isAnual && <p className="pl-economia">{t.equivaleMensal.replace('{valor}', formatMoney(locale, precos.pro.mensal))}</p>}
          <div className="pl-divider" />
          <ul className="pl-features">
            {features.pro.map((f, i) => (
              <li key={i} className={f.ok ? 'pl-sim' : 'pl-nao'}>
                <span className="pl-feat-icon">{f.ok ? '✔' : '✗'}</span> {f.txt}
              </li>
            ))}
          </ul>
          <button
            className="pl-btn pl-btn-dark w-full mt-5 cursor-pointer"
            onClick={() => assinarPlano('pro')}
            disabled={loadingPlano === 'pro'}
          >
            {loadingPlano === 'pro' ? t.pro.ctaAguarde : t.pro.ctaAssinar}
          </button>
        </div>

        {/* ULTRA */}
        <div className="pl-card">
          <p className="pl-nome">{t.ultra.nome}</p>
          <h2 className="pl-titulo">{t.ultra.titulo}</h2>
          <p className="pl-desc">{t.ultra.desc}</p>
          <div className="pl-preco">
            <span className="pl-cifrao">{t.cifrao}</span>
            <span className="pl-valor">{pUltra}</span>
            <span className="pl-periodo">{t.porMes}</span>
          </div>
          {isAnual && <p className="pl-economia">{t.equivaleMensal.replace('{valor}', formatMoney(locale, precos.ultra.mensal))}</p>}
          <div className="pl-divider" />
          <ul className="pl-features">
            {features.ultra.map((f, i) => (
              <li key={i} className={f.ok ? 'pl-sim' : 'pl-nao'}>
                <span className="pl-feat-icon">{f.ok ? '✔' : '✗'}</span> {f.txt}
              </li>
            ))}
          </ul>
          <button
            className="pl-btn pl-btn-outline w-full mt-5 cursor-pointer"
            onClick={() => assinarPlano('ultra')}
            disabled={loadingPlano === 'ultra'}
          >
            {loadingPlano === 'ultra' ? t.ultra.ctaAguarde : t.ultra.ctaAssinar}
          </button>
        </div>

      </div>

      {/* ── NOTA ── */}
      <p className="pl-nota">
        {t.nota.duvidas} <Link href={lhref('/como-funciona') + '#cobranca'}>{t.nota.verCobranca}</Link> {t.nota.ou}{' '}
        <Link href={lhref('/fale-conosco')}>{t.nota.faleConosco}</Link>.
      </p>

      {/* ── CTA TRIAL ── */}
      <div className="pl-cta-section">
        <div className="pl-trial-banner">
          <span className="pl-trial-icon">🎁</span>
          <div>
            <strong>{t.cta.trialTitulo}</strong>
            <p>{t.cta.trialDesc}</p>
          </div>
        </div>
        <Link href={lhref('/cadastro')} className="pl-btn-cta">{t.cta.botao}</Link>
        <p className="pl-cta-nota">{t.cta.nota}</p>
      </div>

      <Footer />

      {checkout && (
        <CheckoutPlano
          plano={checkout.plano}
          periodo={checkout.periodo}
          valor={checkout.valor}
          email={userEmail}
          onClose={() => setCheckout(null)}
          onPaid={() => { setCheckout(null); setAlerta({ msg: t.alertas.pagamentoAprovado, cor: 'green' }); setTimeout(() => router.push('/painel'), 2500) }}
        />
      )}
    </>
  )
}

export default function PlanosPage() {
  return (
    <Suspense fallback={null}>
      <PlanosContent />
    </Suspense>
  )
}
