'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import { supabase } from '@/lib/supabase'
import { useT } from '@/components/i18n/I18nProvider'

// Destino pós-login: respeita ?redirect (apenas caminhos internos), senão /painel.
function destinoPosLogin(): string {
  if (typeof window === 'undefined') return '/painel'
  const r = new URLSearchParams(window.location.search).get('redirect')
  return r && r.startsWith('/') && !r.startsWith('//') ? r : '/painel'
}

export default function LoginPage() {
  const router = useRouter()
  const { dict, lhref } = useT()
  const [email, setEmail]           = useState('')
  const [senha, setSenha]           = useState('')
  const [mostraSenha, setMostraSenha] = useState(false)
  const [erro, setErro]             = useState('')
  const [loading, setLoading]       = useState(false)

  // Modal recuperar senha
  const [modalAberto, setModalAberto] = useState(false)
  const [emailRecuperar, setEmailRecuperar] = useState('')
  const [recuperacaoEnviada, setRecuperacaoEnviada] = useState(false)
  const [loadingRecuperar, setLoadingRecuperar] = useState(false)

  // Redireciona se já logado
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace(destinoPosLogin())
    })
  }, [router])

  // Fecha o modal de recuperação com Esc
  useEffect(() => {
    if (!modalAberto) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') fecharModal() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [modalAberto])

  async function fazerLogin() {
    if (!email || !senha) { setErro(dict.auth.login.erroCamposObrigatorios); return }
    setLoading(true)
    setErro('')

    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: senha })

    if (error) {
      let msg = dict.auth.login.erroGenerico
      if (error.message.includes('Invalid login'))        msg = dict.auth.login.erroCredenciais
      if (error.message.includes('Email not confirmed'))  msg = dict.auth.login.erroEmailNaoConfirmado
      setErro(msg)
      setLoading(false)
      void auditLogin(undefined, email.trim()) // trilha: tentativa malsucedida
    } else {
      void auditLogin(data.session?.access_token) // trilha: login bem-sucedido
      router.replace(destinoPosLogin())
    }
  }

  async function recuperarSenha() {
    if (!emailRecuperar.trim()) return
    setLoadingRecuperar(true)
    await supabase.auth.resetPasswordForEmail(emailRecuperar.trim(), {
      redirectTo: `${window.location.origin}${lhref('/redefinir-senha')}`,
    })
    setLoadingRecuperar(false)
    setRecuperacaoEnviada(true)
  }

  function fecharModal() {
    setModalAberto(false)
    setEmailRecuperar('')
    setRecuperacaoEnviada(false)
  }

  // Registra o login na trilha de auditoria (best-effort, não bloqueia o fluxo).
  // Sucesso → com Bearer (identidade do servidor). Falha → sem token, só o
  // e-mail tentado (a rota resolve a conta e ignora e-mails inexistentes).
  async function auditLogin(token?: string, emailTentado?: string) {
    try {
      await fetch('/api/auditoria', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(token ? { action: 'registrar', acao: 'login' } : { action: 'registrar', acao: 'login_falha', email: emailTentado }),
        keepalive: true,
      })
    } catch { /* auditoria nunca atrapalha o login */ }
  }

  return (
    <>
      <Header />

      <main className="ln-main">
        <div className="ln-wrap">

          {/* Topo */}
          <div className="ln-topo">
            <span className="ln-tag">{dict.auth.login.tag}</span>
            <h1>{dict.auth.login.bemVindo} <em>VENTSY</em></h1>
            <p>{dict.auth.login.subtitulo}</p>
          </div>

          {/* Card */}
          <div className="ln-card">

            {/* Alerta de erro */}
            {erro && (
              <div className="ln-alerta" role="alert">
                <span className="material-icons" aria-hidden="true">error_outline</span>
                <span>{erro}</span>
              </div>
            )}

            {/* E-mail */}
            <div className="ln-form-group">
              <label htmlFor="login-email">{dict.auth.login.emailLabel}</label>
              <div className="ln-input-wrap">
                <span className="material-icons ln-icon-left" aria-hidden="true">email</span>
                <input
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  value={email}
                  placeholder={dict.auth.login.emailPlaceholder}
                  onChange={e => setEmail(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && fazerLogin()}
                />
              </div>
            </div>

            {/* Senha */}
            <div className="ln-form-group">
              <label htmlFor="login-senha">{dict.auth.login.senhaLabel}</label>
              <div className="ln-input-wrap">
                <span className="material-icons ln-icon-left" aria-hidden="true">lock_outline</span>
                <input
                  id="login-senha"
                  type={mostraSenha ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={senha}
                  placeholder={dict.auth.login.senhaPlaceholder}
                  onChange={e => setSenha(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && fazerLogin()}
                />
                <button
                  type="button"
                  className="ln-toggle-senha"
                  onClick={() => setMostraSenha(!mostraSenha)}
                  aria-label={mostraSenha ? dict.auth.login.ocultarSenha : dict.auth.login.mostrarSenha}
                  aria-pressed={mostraSenha}
                >
                  <span className="material-icons" aria-hidden="true">
                    {mostraSenha ? 'visibility' : 'visibility_off'}
                  </span>
                </button>
              </div>
              <div className="ln-esqueceu">
                <button className="ln-link-btn" onClick={() => setModalAberto(true)}>
                  {dict.auth.login.esqueceuSenha}
                </button>
              </div>
            </div>

            {/* Botão entrar */}
            <button
              className="ln-btn-entrar"
              onClick={fazerLogin}
              disabled={loading}
            >
              <span className="material-icons" aria-hidden="true" style={loading ? { animation: 'spin 1s linear infinite' } : {}}>
                {loading ? 'sync' : 'login'}
              </span>
              {loading ? dict.auth.login.entrando : dict.auth.login.entrar}
            </button>
          </div>

          <p className="ln-link-cadastro">
            {dict.auth.login.semConta} <Link href={lhref('/cadastro')}>{dict.auth.login.criarConta}</Link>
          </p>
        </div>
      </main>

      {/* ── MODAL RECUPERAR SENHA ── */}
      {modalAberto && (
        <div
          className="ln-modal-overlay"
          onClick={e => { if (e.target === e.currentTarget) fecharModal() }}
        >
          <div className="ln-modal-box" role="dialog" aria-modal="true" aria-label={dict.auth.recuperar.dialogAriaLabel}>
            {recuperacaoEnviada ? (
              <div className="ln-modal-sucesso">
                <span className="material-icons text-[2.5rem] text-[var(--verde)] mb-[10px] block" aria-hidden="true">
                  mark_email_read
                </span>
                <h3>{dict.auth.recuperar.sucessoTitulo}</h3>
                <p>{dict.auth.recuperar.sucessoDescricao}</p>
                <button className="ln-btn-modal-cancelar mt-4 w-full" onClick={fecharModal}>
                  {dict.auth.recuperar.fechar}
                </button>
              </div>
            ) : (
              <>
                <h3>{dict.auth.recuperar.titulo}</h3>
                <p>{dict.auth.recuperar.descricao}</p>
                <input
                  id="recuperar-email"
                  type="email"
                  autoComplete="email"
                  aria-label={dict.auth.recuperar.emailAriaLabel}
                  value={emailRecuperar}
                  placeholder={dict.auth.recuperar.emailPlaceholder}
                  onChange={e => setEmailRecuperar(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && recuperarSenha()}
                  className="ln-modal-input"
                  autoFocus
                />
                <div className="ln-modal-acoes">
                  <button className="ln-btn-modal-cancelar" onClick={fecharModal}>{dict.auth.recuperar.cancelar}</button>
                  <button
                    className="ln-btn-modal-enviar"
                    onClick={recuperarSenha}
                    disabled={loadingRecuperar}
                  >
                    {loadingRecuperar ? dict.auth.recuperar.enviando : dict.auth.recuperar.enviarLink}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <Footer />
    </>
  )
}
