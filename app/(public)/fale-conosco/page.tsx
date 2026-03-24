'use client'

import { useState, useEffect, useRef } from 'react'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import type { Metadata } from 'next'

const CHIPS = ['Dúvida geral', 'Anunciar meu espaço', 'Problema técnico', 'Planos e cobrança', 'Parceria', 'Outro']

function mascaraTelefone(v: string) {
  v = v.replace(/\D/g, '').substring(0, 11)
  if (v.length > 10) return v.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')
  if (v.length > 6)  return v.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3')
  if (v.length > 2)  return v.replace(/(\d{2})(\d{0,5})/, '($1) $2')
  return v
}

// SVGs dos canais
const IconWhatsApp = () => (
  <svg viewBox="0 0 24 24" fill="none" width={26} height={26}>
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z" fill="#25D366"/>
  </svg>
)

const IconEmail = () => (
  <svg viewBox="0 0 24 24" fill="none" width={26} height={26}>
    <path d="M20 4H4C2.9 4 2 4.9 2 6v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4-8 5-8-5V6l8 5 8-5v2z" fill="#1a73e8"/>
  </svg>
)

const IconSuporte = () => (
  <svg viewBox="0 0 24 24" fill="none" width={26} height={26}>
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z" fill="#ff385c"/>
  </svg>
)

const IconInsta = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width={20} height={20}>
    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/>
  </svg>
)

const IconFB = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width={20} height={20}>
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
  </svg>
)

const IconWA = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width={20} height={20}>
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/>
  </svg>
)

const IconLI = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width={20} height={20}>
    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
  </svg>
)

export default function FaleConoscoPage() {
  const [chip, setChip]         = useState('Dúvida geral')
  const [nome, setNome]         = useState('')
  const [telefone, setTelefone] = useState('')
  const [email, setEmail]       = useState('')
  const [perfil, setPerfil]     = useState('')
  const [mensagem, setMensagem] = useState('')
  const [erros, setErros]       = useState<Record<string, boolean>>({})
  const [enviado, setEnviado]   = useState(false)

  // Scroll reveal
  useEffect(() => {
    const els = document.querySelectorAll('.fc-reveal')
    const obs = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('fc-visivel'); obs.unobserve(e.target) } })
    }, { threshold: 0.1 })
    els.forEach(el => obs.observe(el))
    return () => obs.disconnect()
  }, [])

  function enviar() {
    const novosErros: Record<string, boolean> = {}
    if (!nome.trim())     novosErros.nome = true
    if (!email.trim())    novosErros.email = true
    if (!mensagem.trim()) novosErros.mensagem = true
    setErros(novosErros)
    if (Object.keys(novosErros).length > 0) return
    setEnviado(true)
  }

  return (
    <>
      <Header />

      {/* ── HERO ── */}
      <div className="fc-hero">
        <div className="fc-hero-inner">
          <span className="fc-hero-tag">Fale Conosco</span>
          <h1>Estamos aqui para<br /><em>te ajudar</em></h1>
          <p>Dúvidas, sugestões ou problemas? Nossa equipe responde com agilidade para você ter a melhor experiência na VENTSY.</p>
        </div>
      </div>

      {/* ── CONTEÚDO ── */}
      <div className="fc-main-content">

        {/* ── FORMULÁRIO ── */}
        <div className="fc-form-card fc-reveal">
          {enviado ? (
            <div className="fc-form-sucesso">
              <span className="fc-sucesso-icone">✅</span>
              <h3>Mensagem enviada!</h3>
              <p>Recebemos seu contato e nossa equipe responderá<br />em até <strong>48 horas úteis</strong> pelo e-mail informado.</p>
            </div>
          ) : (
            <>
              <h2 className="fc-form-titulo">Envie sua mensagem</h2>
              <p className="fc-form-sub">Preencha o formulário abaixo e responderemos em até 48 horas úteis.</p>

              {/* Chips de assunto */}
              <span className="fc-label-chips">Qual é o assunto?</span>
              <div className="fc-chips-wrap">
                {CHIPS.map(c => (
                  <button
                    key={c}
                    className={`fc-chip${chip === c ? ' fc-chip-ativo' : ''}`}
                    onClick={() => setChip(c)}
                  >{c}</button>
                ))}
              </div>

              {/* Nome + Telefone */}
              <div className="fc-form-row">
                <div className="fc-form-group">
                  <label>Nome</label>
                  <input
                    type="text" value={nome} placeholder="Seu nome completo"
                    onChange={e => setNome(e.target.value)}
                    className={erros.nome ? 'fc-campo-erro' : ''}
                  />
                </div>
                <div className="fc-form-group">
                  <label>Telefone / WhatsApp</label>
                  <input
                    type="tel" value={telefone} placeholder="(11) 99999-9999"
                    onChange={e => setTelefone(mascaraTelefone(e.target.value))}
                  />
                </div>
              </div>

              {/* E-mail */}
              <div className="fc-form-group">
                <label>E-mail</label>
                <input
                  type="email" value={email} placeholder="seu@email.com"
                  onChange={e => setEmail(e.target.value)}
                  className={erros.email ? 'fc-campo-erro' : ''}
                />
              </div>

              {/* Perfil */}
              <div className="fc-form-group">
                <label>Você é...</label>
                <select value={perfil} onChange={e => setPerfil(e.target.value)}>
                  <option value="" disabled>Selecione seu perfil</option>
                  <option>Dono de espaço</option>
                  <option>Quero alugar um espaço</option>
                  <option>Parceiro / Fornecedor</option>
                  <option>Imprensa</option>
                  <option>Outro</option>
                </select>
              </div>

              {/* Mensagem */}
              <div className="fc-form-group">
                <label>Mensagem</label>
                <textarea
                  value={mensagem} placeholder="Descreva sua dúvida ou mensagem com o máximo de detalhes possível..."
                  onChange={e => setMensagem(e.target.value)}
                  className={erros.mensagem ? 'fc-campo-erro' : ''}
                />
              </div>

              <button className="fc-btn-enviar" onClick={enviar}>
                <span className="material-icons">send</span>
                Enviar mensagem
              </button>
            </>
          )}
        </div>

        {/* ── SIDEBAR ── */}
        <div className="fc-sidebar">

          {/* WhatsApp */}
          <a href="https://wa.me/5521999992120" target="_blank" rel="noopener noreferrer" className="fc-canal-card fc-reveal">
            <div className="fc-canal-icone verde"><IconWhatsApp /></div>
            <div className="fc-canal-info">
              <p className="fc-canal-label">WhatsApp</p>
              <p className="fc-canal-valor">(21) 99999-2120</p>
              <p className="fc-canal-desc">Resposta rápida em horário comercial</p>
            </div>
            <span className="material-icons fc-canal-seta">arrow_forward_ios</span>
          </a>

          {/* E-mail */}
          <a href="mailto:contato@ventsy.com.br" className="fc-canal-card fc-reveal delay-100">
            <div className="fc-canal-icone azul"><IconEmail /></div>
            <div className="fc-canal-info">
              <p className="fc-canal-label">E-mail</p>
              <p className="fc-canal-valor">contato@ventsy.com.br</p>
              <p className="fc-canal-desc">Resposta em até 48 horas úteis</p>
            </div>
            <span className="material-icons fc-canal-seta">arrow_forward_ios</span>
          </a>

          {/* Suporte */}
          <a href="mailto:suporte@ventsy.com.br" className="fc-canal-card fc-reveal delay-150">
            <div className="fc-canal-icone verm"><IconSuporte /></div>
            <div className="fc-canal-info">
              <p className="fc-canal-label">Suporte Técnico</p>
              <p className="fc-canal-valor">suporte@ventsy.com.br</p>
              <p className="fc-canal-desc">Problemas na plataforma ou conta</p>
            </div>
            <span className="material-icons fc-canal-seta">arrow_forward_ios</span>
          </a>

          {/* Redes sociais */}
          <div className="fc-redes-card fc-reveal delay-200">
            <p className="fc-redes-titulo">Redes Sociais</p>
            <p className="fc-redes-sub">Siga a VENTSY e fique por dentro de novidades, dicas e espaços incríveis.</p>
            <div className="fc-redes-grid">
              <a href="#" target="_blank" rel="noopener noreferrer" className="fc-rede-btn fc-instagram"><IconInsta />Instagram</a>
              <a href="#" target="_blank" rel="noopener noreferrer" className="fc-rede-btn fc-facebook"><IconFB />Facebook</a>
              <a href="#" target="_blank" rel="noopener noreferrer" className="fc-rede-btn fc-whatsapp"><IconWA />WhatsApp</a>
              <a href="#" target="_blank" rel="noopener noreferrer" className="fc-rede-btn fc-linkedin"><IconLI />LinkedIn</a>
            </div>
          </div>

          {/* Horário */}
          <div className="fc-horario-card fc-reveal delay-[250ms]">
            <p className="fc-horario-titulo">🕐 Horário de atendimento</p>
            <div className="fc-horario-linha">
              <span className="fc-horario-dia">Segunda a Sexta</span>
              <span className="fc-horario-tempo">9h às 18h</span>
            </div>
            <div className="fc-horario-linha">
              <span className="fc-horario-dia">Sábado</span>
              <span className="fc-horario-tempo">9h às 13h</span>
            </div>
            <div className="fc-horario-linha">
              <span className="fc-horario-dia">Domingo</span>
              <span className="fc-horario-fechado">Fechado</span>
            </div>
          </div>

        </div>
      </div>

      <Footer />
    </>
  )
}
