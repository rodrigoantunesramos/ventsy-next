'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import { supabase } from '@/lib/supabase'

export default function LoginPage() {
  const router = useRouter()
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
      if (data.session) router.replace('/dashboard')
    })
  }, [router])

  async function fazerLogin() {
    if (!email || !senha) { setErro('Preencha e-mail e senha para continuar.'); return }
    setLoading(true)
    setErro('')

    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: senha })

    if (error) {
      let msg = 'Erro ao fazer login. Tente novamente.'
      if (error.message.includes('Invalid login'))        msg = 'E-mail ou senha incorretos.'
      if (error.message.includes('Email not confirmed'))  msg = 'Confirme seu e-mail antes de fazer login. Verifique sua caixa de entrada.'
      setErro(msg)
      setLoading(false)
    } else {
      router.replace('/dashboard')
    }
  }

  async function recuperarSenha() {
    if (!emailRecuperar.trim()) return
    setLoadingRecuperar(true)
    await supabase.auth.resetPasswordForEmail(emailRecuperar.trim(), {
      redirectTo: `${window.location.origin}/redefinir-senha`,
    })
    setLoadingRecuperar(false)
    setRecuperacaoEnviada(true)
  }

  function fecharModal() {
    setModalAberto(false)
    setEmailRecuperar('')
    setRecuperacaoEnviada(false)
  }

  return (
    <>
      <Header />

      <main className="ln-main">
        <div className="ln-wrap">

          {/* Topo */}
          <div className="ln-topo">
            <span className="ln-tag">Acesso</span>
            <h1>Bem-vindo de volta à <em>VENTSY</em></h1>
            <p>Entre com seu e-mail e senha para acessar sua conta.</p>
          </div>

          {/* Card */}
          <div className="ln-card">

            {/* Alerta de erro */}
            {erro && (
              <div className="ln-alerta">
                <span className="material-icons">error_outline</span>
                <span>{erro}</span>
              </div>
            )}

            {/* E-mail */}
            <div className="ln-form-group">
              <label>E-mail</label>
              <div className="ln-input-wrap">
                <span className="material-icons ln-icon-left">email</span>
                <input
                  type="email"
                  value={email}
                  placeholder="seu@email.com"
                  onChange={e => setEmail(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && fazerLogin()}
                />
              </div>
            </div>

            {/* Senha */}
            <div className="ln-form-group">
              <label>Senha</label>
              <div className="ln-input-wrap">
                <span className="material-icons ln-icon-left">lock_outline</span>
                <input
                  type={mostraSenha ? 'text' : 'password'}
                  value={senha}
                  placeholder="Sua senha"
                  onChange={e => setSenha(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && fazerLogin()}
                />
                <button
                  type="button"
                  className="ln-toggle-senha"
                  onClick={() => setMostraSenha(!mostraSenha)}
                  tabIndex={-1}
                >
                  <span className="material-icons">
                    {mostraSenha ? 'visibility' : 'visibility_off'}
                  </span>
                </button>
              </div>
              <div className="ln-esqueceu">
                <button className="ln-link-btn" onClick={() => setModalAberto(true)}>
                  Esqueceu a senha?
                </button>
              </div>
            </div>

            {/* Botão entrar */}
            <button
              className="ln-btn-entrar"
              onClick={fazerLogin}
              disabled={loading}
            >
              <span className="material-icons" style={loading ? { animation: 'spin 1s linear infinite' } : {}}>
                {loading ? 'sync' : 'login'}
              </span>
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </div>

          <p className="ln-link-cadastro">
            Não tem conta? <Link href="/cadastro">Criar conta grátis</Link>
          </p>
        </div>
      </main>

      {/* ── MODAL RECUPERAR SENHA ── */}
      {modalAberto && (
        <div
          className="ln-modal-overlay"
          onClick={e => { if (e.target === e.currentTarget) fecharModal() }}
        >
          <div className="ln-modal-box">
            {recuperacaoEnviada ? (
              <div className="ln-modal-sucesso">
                <span className="material-icons text-[2.5rem] text-[var(--verde)] mb-[10px] block">
                  mark_email_read
                </span>
                <h3>E-mail enviado!</h3>
                <p>Verifique sua caixa de entrada e siga as instruções para redefinir sua senha.</p>
                <button className="ln-btn-modal-cancelar mt-4 w-full" onClick={fecharModal}>
                  Fechar
                </button>
              </div>
            ) : (
              <>
                <h3>Recuperar senha</h3>
                <p>Informe seu e-mail cadastrado e enviaremos um link para redefinir sua senha.</p>
                <input
                  type="email"
                  value={emailRecuperar}
                  placeholder="seu@email.com"
                  onChange={e => setEmailRecuperar(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && recuperarSenha()}
                  className="ln-modal-input"
                />
                <div className="ln-modal-acoes">
                  <button className="ln-btn-modal-cancelar" onClick={fecharModal}>Cancelar</button>
                  <button
                    className="ln-btn-modal-enviar"
                    onClick={recuperarSenha}
                    disabled={loadingRecuperar}
                  >
                    {loadingRecuperar ? 'Enviando...' : 'Enviar link'}
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
