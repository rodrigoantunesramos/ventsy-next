'use client'

import Link from 'next/link'
import Image from 'next/image'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import { useEffect, useRef } from 'react'
import { useT } from '@/components/i18n/I18nProvider'
import type { Dictionary } from '@/lib/i18n/dictionaries/pt'

type CF = Dictionary['comoFunciona']

function FaqItem({ q, r }: { q: string; r: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const isOpen = useRef(false)

  const toggle = () => {
    isOpen.current = !isOpen.current
    const item = ref.current
    if (!item) return
    if (isOpen.current) item.classList.add('aberto')
    else item.classList.remove('aberto')
  }

  return (
    <div className="cf-faq-item" ref={ref}>
      <button className="cf-faq-pergunta" onClick={toggle}>
        {q}
        <span className="cf-faq-seta">+</span>
      </button>
      <div className="cf-faq-resposta">{r}</div>
    </div>
  )
}

export default function ComoFuncionaPage() {
  const { dict, lhref } = useT()
  const t: CF = dict.comoFunciona

  const passosDono = [
    { icon: 'assignment',        ...t.dono.passos.cadastro },
    { icon: 'manage_search',     ...t.dono.passos.revisao },
    { icon: 'task_alt',          ...t.dono.passos.aprovado },
    { icon: 'mark_email_unread', ...t.dono.passos.contatos },
  ]

  const passosBusca = [
    { icon: 'search',             ...t.busca.passos.filtros },
    { icon: 'chat_bubble_outline',...t.busca.passos.contato },
    { icon: 'money_off',          ...t.busca.passos.semTaxas },
    { icon: 'verified',           ...t.busca.passos.verificados },
    { icon: 'calendar_today',     ...t.busca.passos.calendario },
    { icon: 'star_outline',       ...t.busca.passos.avaliacoes },
  ]

  const faqs = [
    t.faq.itens.aprovacao,
    t.faq.itens.editar,
    t.faq.itens.pagamento,
    t.faq.itens.posTrial,
    t.faq.itens.multiplas,
    t.faq.itens.selo,
  ]

  const badgesCobranca = [
    { e: '🆓', ...t.cobranca.badges.basico },
    { e: '🚫', ...t.cobranca.badges.semComissao },
    { e: '🎁', ...t.cobranca.badges.trial },
  ]

  // Scroll reveal
  useEffect(() => {
    const els = document.querySelectorAll('.cf-reveal')
    const obs = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('cf-visivel'); obs.unobserve(e.target) } })
    }, { threshold: 0.1 })
    els.forEach(el => obs.observe(el))
    return () => obs.disconnect()
  }, [])

  return (
    <>
      <Header />

      {/* ── HERO ── */}
      <div className="cf-hero">
        <div className="cf-hero-inner">
          <span className="cf-hero-tag">{t.hero.tag}</span>
          <h1>{t.hero.tituloA}<br />{t.hero.tituloE} <em>{t.hero.tituloEm}</em></h1>
          <p>{t.hero.subtitulo}</p>
        </div>
      </div>

      {/* ── DOIS PÚBLICOS ── */}
      <div className="cf-publicos-wrapper">

        {/* Bloco 1 — Donos de espaço */}
        <div className="cf-publico-bloco cf-reveal">
          <div className="cf-publico-foto">
            <Image
              src="https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=800&q=80"
              alt={t.imgAlt.espaco}
              fill
              sizes="(min-width: 900px) 45vw, 100vw"
            />
            <div className="cf-foto-badge">{t.dono.badge}</div>
          </div>
          <div className="cf-publico-opcoes">
            <p className="cf-publico-label">{t.dono.label}</p>
            <h2 className="cf-publico-titulo">{t.dono.titulo}</h2>
            <p className="cf-publico-subtitulo">{t.dono.subtitulo}</p>
            {passosDono.map(p => (
              <div className="cf-opcao-item" key={p.icon}>
                <div className="cf-opcao-icone">
                  <span className="material-icons">{p.icon}</span>
                </div>
                <div className="cf-opcao-texto">
                  <h4>{p.titulo}</h4>
                  <p>{p.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bloco 2 — Quem busca (invertido) */}
        <div className="cf-publico-bloco cf-invertido cf-reveal">
          <div className="cf-publico-foto">
            <Image
              src="https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800&q=80"
              alt={t.imgAlt.evento}
              fill
              sizes="(min-width: 900px) 45vw, 100vw"
            />
            <div className="cf-foto-badge">{t.busca.badge}</div>
          </div>
          <div className="cf-publico-opcoes">
            <p className="cf-publico-label">{t.busca.label}</p>
            <h2 className="cf-publico-titulo">{t.busca.tituloA}<br />{t.busca.tituloB}</h2>
            <p className="cf-publico-subtitulo">{t.busca.subtitulo}</p>
            {passosBusca.map(p => (
              <div className="cf-opcao-item" key={p.icon}>
                <div className="cf-opcao-icone">
                  <span className="material-icons">{p.icon}</span>
                </div>
                <div className="cf-opcao-texto">
                  <h4>{p.titulo}</h4>
                  <p>{p.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* ── BLOCOS INFORMATIVOS ── */}
      <div className="cf-info-blocos cf-reveal">
        <div className="cf-info-card cf-escuro">
          <div className="cf-info-icone">🛡️</div>
          <div>
            <h3>{t.info.revisao.titulo}</h3>
            <p dangerouslySetInnerHTML={{ __html: t.info.revisao.desc }} />
          </div>
        </div>
        <div className="cf-info-card cf-dourado">
          <div className="cf-info-icone">🎁</div>
          <div>
            <h3>{t.info.trial.titulo}</h3>
            <p dangerouslySetInnerHTML={{ __html: t.info.trial.desc }} />
          </div>
        </div>
      </div>

      {/* ── COBRANÇA ── */}
      <section id="cobranca" className="cf-cobranca-section">
        <div className="cf-cobranca-inner">
          <div className="cf-section-titulo cf-reveal">
            <p className="cf-label">{t.cobranca.label}</p>
            <h2>{t.cobranca.titulo}</h2>
            <p>{t.cobranca.subtitulo}</p>
          </div>

          <div className="cf-badges-cobranca cf-reveal">
            {badgesCobranca.map(b => (
              <div className="cf-badge-item" key={b.titulo}>
                <div className="cf-badge-emoji">{b.e}</div>
                <strong>{b.titulo}</strong>
                <p>{b.desc}</p>
              </div>
            ))}
          </div>

          <div className="cf-cobranca-grid cf-reveal">
            <div className="cf-cobranca-card cf-mensal">
              <h4>{t.cobranca.mensal.titulo}</h4>
              <p dangerouslySetInnerHTML={{ __html: t.cobranca.mensal.desc }} />
            </div>
            <div className="cf-cobranca-card cf-anual">
              <h4>{t.cobranca.anual.titulo}</h4>
              <p dangerouslySetInnerHTML={{ __html: t.cobranca.anual.desc }} />
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <div className="cf-faq-section">
        <div className="cf-section-titulo cf-reveal">
          <p className="cf-label">{t.faq.label}</p>
          <h2>{t.faq.titulo}</h2>
        </div>
        {faqs.map((f, i) => (
          <FaqItem key={i} q={f.q} r={f.r} />
        ))}
      </div>

      {/* ── CTA FINAL ── */}
      <div className="cf-cta-final">
        <h2>{t.ctaFinal.tituloA}<br />{t.ctaFinal.tituloB} <em>{t.ctaFinal.tituloEm}</em>?</h2>
        <p>{t.ctaFinal.subtitulo}</p>
        <Link href={lhref('/cadastro')} className="cf-btn-cta">{t.ctaFinal.botao}</Link>
      </div>

      <Footer />
    </>
  )
}
