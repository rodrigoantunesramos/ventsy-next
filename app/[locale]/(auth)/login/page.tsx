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

  // Falha no callback do OAuth volta com ?erro=oauth — sinaliza ao usuário.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('erro') === 'oauth') setErro(dict.auth.login.erroGenerico)
  }, [dict.auth.login.erroGenerico])

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

  async function loginGoogle() {
    setErro('')
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(destinoPosLogin())}` },
    })
    if (error) setErro(dict.auth.login.erroGenerico)
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

            {/* Login social — ativa quando o provedor Google for habilitado no Supabase Auth. */}
            <div className="flex items-center gap-3 my-4">
              <span className="h-px flex-1 bg-gray-200" />
              <span className="text-xs text-gray-400 uppercase tracking-wide">{dict.auth.login.ou}</span>
              <span className="h-px flex-1 bg-gray-200" />
            </div>
            <button
              type="button"
              onClick={loginGoogle}
              className="w-full flex items-center justify-center gap-2.5 border border-gray-300 rounded-lg py-2.5 text-sm font-semibold text-gray-700 bg-white hover:bg-gray-50 transition-colors cursor-pointer font-[inherit]"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z" />
                <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38Z" />
              </svg>
              {dict.auth.login.continuarGoogle}
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
