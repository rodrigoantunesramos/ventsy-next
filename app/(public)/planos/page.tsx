'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useSearchParams, useRouter } from 'next/navigation'
import { Suspense } from 'react'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import { supabase } from '@/lib/supabase'

/* ── preços padrão ── */
const PRECOS_DEFAULT = {
  pro:   { mensal: 79,  anual: 63  },
  ultra: { mensal: 149, anual: 119 },
}

/* ── features padrão ── */
const FEATURES = {
  basico: [
    { ok: true,  txt: 'Cadastro de 1 propriedade' },
    { ok: true,  txt: 'Até 5 fotos na galeria' },
    { ok: false, txt: 'Botão de WhatsApp direto' },
    { ok: false, txt: 'Relatório de desempenho' },
    { ok: false, txt: 'Selo de verificação' },
  ],
  pro: [
    { ok: true, txt: 'Tudo do plano Básico' },
    { ok: true, txt: 'Fotos ilimitadas' },
    { ok: true, txt: 'Botão de WhatsApp direto' },
    { ok: true, txt: 'Relatórios detalhados' },
    { ok: true, txt: 'Calendário de disponibilidade' },
    { ok: true, txt: 'Suporte prioritário' },
  ],
  ultra: [
    { ok: true, txt: 'Tudo do plano Pro' },
    { ok: true, txt: 'Upload de vídeos' },
    { ok: true, txt: 'Aparecer no topo das buscas' },
    { ok: true, txt: 'Selo de Verificação Premium' },
    { ok: true, txt: 'Destaque na Home do site' },
    { ok: true, txt: 'Gerador de Contratos PDF' },
  ],
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
    <div style={{
      position: 'fixed', top: 90, left: '50%', transform: 'translateX(-50%)',
      background: '#fff', border: `2px solid ${borderMap[cor] || cor}`,
      borderRadius: 12, padding: '16px 28px', fontWeight: 600,
      color: colorMap[cor] || cor, zIndex: 9999,
      boxShadow: '0 8px 32px rgba(0,0,0,.15)', maxWidth: '90%', textAlign: 'center',
    }}>
      {msg}
    </div>
  )
}

function PlanosContent() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const [isAnual, setIsAnual]   = useState(false)
  const [precos, setPrecos]     = useState(PRECOS_DEFAULT)
  const [features, setFeatures] = useState(FEATURES)
  const [loadingPlano, setLoadingPlano] = useState<string | null>(null)
  const [alerta, setAlerta]     = useState<{ msg: string; cor: string } | null>(null)

  // Verifica retorno de pagamento
  useEffect(() => {
    const status = searchParams.get('pagamento')
    if (status === 'sucesso') {
      setAlerta({ msg: '✅ Pagamento aprovado! Seu plano foi ativado. Redirecionando...', cor: 'green' })
      setTimeout(() => router.push('/dashboard'), 3000)
    } else if (status === 'erro') {
      setAlerta({ msg: '❌ Houve um problema com o pagamento. Tente novamente.', cor: 'red' })
    } else if (status === 'pendente') {
      setAlerta({ msg: '⏳ Pagamento pendente. Você receberá um e-mail de confirmação.', cor: 'orange' })
    }
  }, [searchParams, router])

  // Carrega config dinâmica do Supabase
  useEffect(() => {
    const load = async () => {
      try {
        const { data, error } = await supabase.from('planos_config').select('*')
        if (error || !data) return

        const cfg: Record<string, any> = {}
        data.forEach((row: any) => { cfg[row.id] = row })

        const novosPrecos = { ...PRECOS_DEFAULT }
        if (cfg.pro)   { novosPrecos.pro   = { mensal: cfg.pro.preco,   anual: Math.round(cfg.pro.preco * 0.8)   } }
        if (cfg.ultra) { novosPrecos.ultra = { mensal: cfg.ultra.preco, anual: Math.round(cfg.ultra.preco * 0.8) } }
        setPrecos(novosPrecos)

        const novasFeatures = { ...FEATURES }
        ;(['basico', 'pro', 'ultra'] as const).forEach(nome => {
          if (cfg[nome]?.items?.length) {
            novasFeatures[nome] = cfg[nome].items.map((txt: string) => ({ ok: true, txt }))
          }
        })
        setFeatures(novasFeatures)
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

    setLoadingPlano(plano)
    try {
      const periodo = isAnual ? 'anual' : 'mensal'
      const res = await fetch(`https://hxvlfalgrduitevbhqvq.supabase.co/functions/v1/create-payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          plano, periodo,
          usuario_id: session.user.id,
          email: session.user.email,
          nome: session.user.user_metadata?.nome || session.user.email,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error?.message || JSON.stringify(data.error))
      const url = data.sandbox_url || data.checkout_url
      window.location.href = url
    } catch (err: any) {
      setAlerta({ msg: 'Erro ao gerar pagamento: ' + err.message, cor: 'red' })
      setLoadingPlano(null)
    }
  }

  const pPro   = isAnual ? precos.pro.anual   : precos.pro.mensal
  const pUltra = isAnual ? precos.ultra.anual : precos.ultra.mensal

  return (
    <>
      <Header isLoggedIn={undefined} menuOpen={undefined} setMenuOpen={undefined} menuRef={undefined} />

      {alerta && (
        <AlertaFlutuante msg={alerta.msg} cor={alerta.cor} onClose={() => setAlerta(null)} />
      )}

      {/* ── HERO ── */}
      <section className="pl-hero">
        <h1>Escolha o plano <span>certo para você</span></h1>
        <p>Anuncie seu espaço para milhares de pessoas que buscam o local perfeito para seus eventos.</p>

        {/* Toggle mensal / anual */}
        <div className="pl-toggle-periodo">
          <span className={!isAnual ? 'pl-periodo-ativo' : ''}>Mensal</span>
          <div className={`pl-toggle-switch${isAnual ? ' pl-toggle-anual' : ''}`} onClick={() => setIsAnual(!isAnual)} />
          <span className={isAnual ? 'pl-periodo-ativo' : ''}>Anual</span>
          {isAnual && <span className="pl-badge-desconto">−20%</span>}
        </div>
      </section>

      {/* ── GRID ── */}
      <div className="pl-grid">

        {/* BÁSICO */}
        <div className="pl-card">
          <p className="pl-nome">Básico</p>
          <h2 className="pl-titulo">Para começar</h2>
          <p className="pl-desc">Para quem está começando a divulgar seu espaço.</p>
          <div className="pl-preco pl-preco-gratis">
            <span className="pl-valor">Grátis</span>
          </div>
          <div className="pl-divider" />
          <ul className="pl-features">
            {features.basico.map((f, i) => (
              <li key={i} className={f.ok ? 'pl-sim' : 'pl-nao'}>
                <span className="pl-feat-icon">{f.ok ? '✔' : '✗'}</span> {f.txt}
              </li>
            ))}
          </ul>
          <Link href="/cadastro" className="pl-btn pl-btn-outline" style={{ display:'block', textAlign:'center', textDecoration:'none', marginTop:20 }}>
            Começar grátis
          </Link>
        </div>

        {/* PRO — DESTAQUE */}
        <div className="pl-card pl-destaque">
          <span className="pl-badge-popular">Mais popular</span>
          <p className="pl-nome">Pro</p>
          <h2 className="pl-titulo">Profissional</h2>
          <p className="pl-desc">Ideal para chácaras e salões profissionais.</p>
          <div className="pl-preco">
            <span className="pl-cifrao">R$</span>
            <span className="pl-valor">{pPro}</span>
            <span className="pl-periodo">/mês</span>
          </div>
          {isAnual && <p className="pl-economia">Equivale a R$ {precos.pro.mensal}/mês no mensal</p>}
          <div className="pl-divider" />
          <ul className="pl-features">
            {features.pro.map((f, i) => (
              <li key={i} className={f.ok ? 'pl-sim' : 'pl-nao'}>
                <span className="pl-feat-icon">{f.ok ? '✔' : '✗'}</span> {f.txt}
              </li>
            ))}
          </ul>
          <button
            className="pl-btn pl-btn-dark"
            style={{ width:'100%', marginTop:20, cursor:'pointer' }}
            onClick={() => assinarPlano('pro')}
            disabled={loadingPlano === 'pro'}
          >
            {loadingPlano === 'pro' ? '⏳ Aguarde...' : '⭐ Assinar Pro'}
          </button>
        </div>

        {/* ULTRA */}
        <div className="pl-card">
          <p className="pl-nome">Ultra</p>
          <h2 className="pl-titulo">Máximo alcance</h2>
          <p className="pl-desc">O máximo de leads para o seu negócio.</p>
          <div className="pl-preco">
            <span className="pl-cifrao">R$</span>
            <span className="pl-valor">{pUltra}</span>
            <span className="pl-periodo">/mês</span>
          </div>
          {isAnual && <p className="pl-economia">Equivale a R$ {precos.ultra.mensal}/mês no mensal</p>}
          <div className="pl-divider" />
          <ul className="pl-features">
            {features.ultra.map((f, i) => (
              <li key={i} className={f.ok ? 'pl-sim' : 'pl-nao'}>
                <span className="pl-feat-icon">{f.ok ? '✔' : '✗'}</span> {f.txt}
              </li>
            ))}
          </ul>
          <button
            className="pl-btn pl-btn-outline"
            style={{ width:'100%', marginTop:20, cursor:'pointer' }}
            onClick={() => assinarPlano('ultra')}
            disabled={loadingPlano === 'ultra'}
          >
            {loadingPlano === 'ultra' ? '⏳ Aguarde...' : '🚀 Assinar Ultra'}
          </button>
        </div>

      </div>

      {/* ── NOTA ── */}
      <p className="pl-nota">
        Dúvidas sobre os planos? <Link href="/como-funciona#cobranca">Veja como funciona a cobrança</Link> ou{' '}
        <Link href="/fale-conosco">fale com a gente</Link>.
      </p>

      {/* ── CTA TRIAL ── */}
      <div className="pl-cta-section">
        <div className="pl-trial-banner">
          <span className="pl-trial-icon">🎁</span>
          <div>
            <strong>1 mês grátis no Ultra</strong>
            <p>Cadastre sua propriedade agora e experimente todos os recursos premium sem pagar nada. Após o período, você continua no plano Básico gratuitamente.</p>
          </div>
        </div>
        <Link href="/cadastro" className="pl-btn-cta">Cadastre sua propriedade</Link>
        <p className="pl-cta-nota">Seu anúncio ficará em revisão até ser aprovado pela equipe VENTSY antes de ir ao público.</p>
      </div>

      <Footer />
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
