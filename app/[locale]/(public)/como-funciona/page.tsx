'use client'

import Link from 'next/link'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import { useEffect, useRef } from 'react'
import type { Metadata } from 'next'

const PASSOS_DONO = [
  { icon: 'assignment',        titulo: '1. Cadastre sua propriedade',   desc: 'Preencha as informações, suba fotos e descreva os diferenciais do seu espaço. Leva menos de 10 minutos.' },
  { icon: 'manage_search',     titulo: '2. A VENTSY revisa',            desc: 'Nossa equipe analisa o cadastro para garantir qualidade. Você recebe uma pré-visualização de como seu anúncio ficará — só você consegue ver.' },
  { icon: 'task_alt',          titulo: '3. Aprovado e no ar',           desc: 'Após aprovação, sua propriedade vai ao público. Você já está no Ultra gratuitamente pelo primeiro mês.' },
  { icon: 'mark_email_unread', titulo: '4. Receba contatos',            desc: 'Interessados entram em contato diretamente com você. Nenhuma comissão sobre o valor do aluguel — o dinheiro é inteiramente seu.' },
]

const PASSOS_BUSCA = [
  { icon: 'search',            titulo: 'Busca por filtros',             desc: 'Filtre por localização, tipo de evento, número de convidados, serviços e muito mais. Encontre exatamente o que você precisa.' },
  { icon: 'chat_bubble_outline',titulo: 'Contato direto com o dono',   desc: 'Nenhum intermediário. Você fala diretamente com o proprietário pelo WhatsApp ou pelo formulário de contato do anúncio.' },
  { icon: 'money_off',         titulo: 'Zero taxas para você',          desc: 'A VENTSY não cobra nenhum valor do cliente final — nem taxa de serviço, nem comissão. O preço que você vê é o preço que você paga.' },
  { icon: 'verified',          titulo: 'Espaços verificados',           desc: 'Todos os anúncios passam por revisão da equipe VENTSY antes de ir ao ar. Você encontra apenas espaços reais e bem avaliados.' },
  { icon: 'calendar_today',    titulo: 'Calendário de disponibilidade', desc: 'Nos planos Pro e Ultra, o proprietário mantém um calendário atualizado para que você saiba se o espaço está disponível na sua data.' },
  { icon: 'star_outline',      titulo: 'Avaliações reais',              desc: 'Leia avaliações de quem já usou o espaço para tomar a melhor decisão com confiança.' },
]

const FAQS = [
  { q: 'Quanto tempo demora a aprovação do cadastro?',      r: 'Em geral, revisamos os cadastros em até 48 horas úteis. Anúncios com fotos de qualidade e descrições completas costumam ser aprovados mais rapidamente. Você será notificado por e-mail assim que seu espaço for aprovado.' },
  { q: 'Posso alterar meu anúncio depois de aprovado?',     r: 'Sim. Você pode editar fotos, descrições e informações a qualquer momento. Alterações significativas (como mudança de endereço ou categoria) podem passar por uma nova revisão rápida.' },
  { q: 'A VENTSY intermedia o pagamento do aluguel?',       r: 'Não. A VENTSY é uma plataforma de divulgação. O pagamento pelo aluguel do espaço é combinado diretamente entre o cliente e o proprietário, da forma que preferirem — Pix, transferência, dinheiro ou contrato próprio.' },
  { q: 'O que acontece depois do mês grátis no Ultra?',     r: 'Você migra automaticamente para o plano Básico (gratuito). Nenhuma cobrança é feita sem que você escolha um plano pago. Você pode fazer upgrade para Pro ou Ultra a qualquer momento pela sua conta.' },
  { q: 'Posso cadastrar mais de uma propriedade?',          r: 'No plano Básico, você pode cadastrar 1 propriedade. Nos planos Pro e Ultra, não há limite de propriedades. Cada propriedade adicional pode ser gerenciada de forma independente no painel.' },
  { q: 'Como funciona o selo de verificação Premium?',      r: 'O selo é concedido a anunciantes no plano Ultra que passaram pela revisão completa da equipe VENTSY. Ele indica ao cliente final que o espaço foi verificado, as fotos são reais e as informações são confiáveis — aumentando a credibilidade do anúncio.' },
]

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
          <span className="cf-hero-tag">Como Funciona</span>
          <h1>Simples, transparente<br />e <em>sem surpresas</em></h1>
          <p>A VENTSY conecta quem tem o espaço perfeito com quem está buscando o lugar ideal para o seu evento — sem taxas escondidas, sem comissões.</p>
        </div>
      </div>

      {/* ── DOIS PÚBLICOS ── */}
      <div className="cf-publicos-wrapper">

        {/* Bloco 1 — Donos de espaço */}
        <div className="cf-publico-bloco cf-reveal">
          <div className="cf-publico-foto">
            <img
              src="https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=800&q=80"
              alt="Espaço para eventos"
            />
            <div className="cf-foto-badge">🏡 Para donos de espaço</div>
          </div>
          <div className="cf-publico-opcoes">
            <p className="cf-publico-label">Para donos de espaço</p>
            <h2 className="cf-publico-titulo">Do cadastro ao seu primeiro cliente</h2>
            <p className="cf-publico-subtitulo">Quatro passos para colocar sua propriedade em destaque para milhares de pessoas.</p>
            {PASSOS_DONO.map(p => (
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
            <img
              src="https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800&q=80"
              alt="Evento sendo realizado"
            />
            <div className="cf-foto-badge">🎉 Para quem busca um espaço</div>
          </div>
          <div className="cf-publico-opcoes">
            <p className="cf-publico-label">Para quem busca um espaço</p>
            <h2 className="cf-publico-titulo">Encontre o lugar ideal,<br />sem complicação</h2>
            <p className="cf-publico-subtitulo">A VENTSY é completamente gratuita para quem quer alugar um espaço.</p>
            {PASSOS_BUSCA.map(p => (
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
            <h3>Por que revisamos cada cadastro?</h3>
            <p>Queremos garantir que apenas espaços reais e bem descritos apareçam na plataforma. Isso protege quem busca um local e <strong>valoriza quem anuncia de verdade</strong>. Anúncios com fotos de qualidade são aprovados mais rapidamente.</p>
          </div>
        </div>
        <div className="cf-info-card cf-dourado">
          <div className="cf-info-icone">🎁</div>
          <div>
            <h3>1 mês grátis no plano Ultra</h3>
            <p>Todo novo anunciante começa automaticamente no <strong>plano Ultra por 30 dias sem pagar nada</strong>. Após o período, você migra para o Básico (gratuito para sempre) ou escolhe um plano pago.</p>
          </div>
        </div>
      </div>

      {/* ── COBRANÇA ── */}
      <section id="cobranca" className="cf-cobranca-section">
        <div className="cf-cobranca-inner">
          <div className="cf-section-titulo cf-reveal">
            <p className="cf-label">Planos e cobrança</p>
            <h2>Transparência em cada centavo</h2>
            <p>Sem letras miúdas. Aqui estão todas as regras sobre cobrança e cancelamento.</p>
          </div>

          <div className="cf-badges-cobranca cf-reveal">
            {[
              { e: '🆓', t: 'Plano Básico',     d: 'Gratuito para sempre. 1 propriedade, até 5 fotos. Ideal para começar.' },
              { e: '🚫', t: 'Zero comissão',     d: 'A VENTSY não toca no dinheiro do aluguel. Nenhuma porcentagem sobre negócios fechados.' },
              { e: '🎁', t: '1º mês grátis',    d: 'Todo novo cadastro inicia no Ultra sem pagar. A cobrança só começa após o trial.' },
            ].map(b => (
              <div className="cf-badge-item" key={b.t}>
                <div className="cf-badge-emoji">{b.e}</div>
                <strong>{b.t}</strong>
                <p>{b.d}</p>
              </div>
            ))}
          </div>

          <div className="cf-cobranca-grid cf-reveal">
            <div className="cf-cobranca-card cf-mensal">
              <h4>🔵 Plano Mensal</h4>
              <p>Renovado automaticamente todo mês. <strong>Cancele a qualquer momento</strong>, sem multas e sem burocracia. O acesso continua ativo até o fim do período já pago.</p>
            </div>
            <div className="cf-cobranca-card cf-anual">
              <h4>🟠 Plano Anual</h4>
              <p>Desconto de ~20% em relação ao mensal. Em caso de cancelamento antecipado, aplica-se uma <strong>multa de 20% sobre o valor total do plano</strong> contratado. O valor restante é estornado.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <div className="cf-faq-section">
        <div className="cf-section-titulo cf-reveal">
          <p className="cf-label">Dúvidas frequentes</p>
          <h2>Perguntas e respostas</h2>
        </div>
        {FAQS.map((f, i) => (
          <FaqItem key={i} q={f.q} r={f.r} />
        ))}
      </div>

      {/* ── CTA FINAL ── */}
      <div className="cf-cta-final">
        <h2>Pronto para anunciar<br />seu <em>espaço</em>?</h2>
        <p>Cadastre agora e experimente o Ultra grátis por 30 dias.</p>
        <Link href="/cadastro" className="cf-btn-cta">Cadastrar minha propriedade</Link>
      </div>

      <Footer />
    </>
  )
}
