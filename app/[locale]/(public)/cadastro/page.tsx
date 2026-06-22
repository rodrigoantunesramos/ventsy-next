'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase, authHeaders } from '@/lib/supabase'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import { Suspense } from 'react'
import { useT } from '@/components/i18n/I18nProvider'

// ── Helpers de máscara ──
function mascaraCPF(v: string) {
  v = v.replace(/\D/g, '').substring(0, 11)
  if (v.length > 9) return v.replace(/(\d{3})(\d{3})(\d{3})(\d{0,2})/, '$1.$2.$3-$4')
  if (v.length > 6) return v.replace(/(\d{3})(\d{3})(\d{0,3})/, '$1.$2.$3')
  if (v.length > 3) return v.replace(/(\d{3})(\d{0,3})/, '$1.$2')
  return v
}

function mascaraCNPJ(v: string) {
  v = v.replace(/\D/g, '').substring(0, 14)
  if (v.length > 12) return v.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{0,2})/, '$1.$2.$3/$4-$5')
  if (v.length > 8)  return v.replace(/(\d{2})(\d{3})(\d{3})(\d{0,4})/, '$1.$2.$3/$4')
  if (v.length > 5)  return v.replace(/(\d{2})(\d{3})(\d{0,3})/, '$1.$2.$3')
  if (v.length > 2)  return v.replace(/(\d{2})(\d{0,3})/, '$1.$2')
  return v
}

function avaliarForca(senha: string): { forca: number; cor: string } {
  let f = 0
  if (senha.length >= 8)          f++
  if (/[A-Z]/.test(senha))        f++
  if (/[0-9]/.test(senha))        f++
  if (/[^A-Za-z0-9]/.test(senha)) f++
  const cores  = ['', '#ff385c', '#ff8c00', '#f0c040', '#22c55e']
  return { forca: f, cor: cores[f] || '' }
}

// Checagem de disponibilidade via rota com rate-limit (antes era RPC anônima direta).
// true = já cadastrado · false = disponível · null = não deu p/ verificar (erro/limite).
async function checarDisponibilidade(tipo: 'documento' | 'email' | 'usuario', valor: string): Promise<boolean | null> {
  try {
    const r = await fetch('/api/cadastro/verificar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipo, valor }),
    })
    if (!r.ok) return null
    const j = await r.json()
    return j?.existe === true
  } catch {
    return null
  }
}

// ── Tipo para status de campo ──
type FieldStatus = { ok: boolean | null; hint: string }

function CadastroContent() {
  const router = useRouter()
  const params = useSearchParams()
  const { dict, lhref } = useT()
  const t = dict.cadastro
  // Rótulos de força da senha indexados por nível (0 = vazio).
  const forcaLabels = ['', t.forca.muitoFraca, t.forca.fraca, t.forca.boa, t.forca.forte]

  // ── Tipo de doc ──
  const [tipoDoc, setTipoDoc] = useState<'cpf' | 'cnpj'>('cpf')

  // ── Campos ──
  const [documento, setDocumento]   = useState('')
  const [nome, setNome]             = useState('')
  const [nascimento, setNascimento] = useState('')
  const [email, setEmail]           = useState('')
  const [usuario, setUsuario]       = useState('')
  const [senha, setSenha]           = useState('')
  const [senha2, setSenha2]         = useState('')
  const [refCodigo, setRefCodigo]   = useState('')
  const [termos, setTermos]         = useState(false)

  // ── Visibilidade senhas ──
  const [mostraSenha, setMostraSenha]   = useState(false)
  const [mostraSenha2, setMostraSenha2] = useState(false)

  // ── Indicação ──
  const [refAutoPreenchido, setRefAutoPreenchido] = useState(false)
  const [refStatus, setRefStatus] = useState<'idle' | 'ok' | 'aviso' | 'erro'>('idle')
  const [refHint, setRefHint]     = useState(t.indicacao.hintOpcional)

  // ── Status dos campos ──
  const [stDoc,     setStDoc]     = useState<FieldStatus>({ ok: null, hint: '' })
  const [stNome,    setStNome]    = useState<FieldStatus>({ ok: null, hint: '' })
  const [stNasc,    setStNasc]    = useState<FieldStatus>({ ok: null, hint: t.hints.maiorDe18 })
  const [stEmail,   setStEmail]   = useState<FieldStatus>({ ok: null, hint: t.hints.emailLogin })
  const [stUsuario, setStUsuario] = useState<FieldStatus>({ ok: null, hint: t.hints.usuarioRegras })
  const [stSenha2,  setStSenha2]  = useState<FieldStatus>({ ok: null, hint: '' })

  // ── Força senha ──
  const [forca, setForca] = useState({ forca: 0, cor: '' })

  // ── UI global ──
  const [alerta, setAlerta]     = useState<{ tipo: 'erro' | 'sucesso'; msg: string } | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [sucesso, setSucesso]   = useState(false)

  // Data máx nascimento (18 anos)
  const maxNasc = (() => {
    const d = new Date(); d.setFullYear(d.getFullYear() - 18)
    return d.toISOString().split('T')[0]
  })()

  // ── Captura ?ref= da URL ──
  useEffect(() => {
    const ref = params.get('ref') || sessionStorage.getItem('ventsy_ref') || ''
    if (ref) {
      if (params.get('ref')) sessionStorage.setItem('ventsy_ref', ref)
      setRefCodigo(ref)
      setRefAutoPreenchido(true)
      setRefStatus('ok')
      setRefHint(t.indicacao.hintAutoPreenchido)
    }
  }, [params])

  // ── Troca tipo de doc ──
  function trocarTipoDoc(tipo: 'cpf' | 'cnpj') {
    setTipoDoc(tipo)
    setDocumento('')
    setStDoc({ ok: null, hint: '' })
  }

  // ── Máscaras ──
  function handleDocumento(val: string) {
    setDocumento(tipoDoc === 'cpf' ? mascaraCPF(val) : mascaraCNPJ(val))
  }

  // ── Validações onBlur ──
  function validarDoc() {
    const limpo = documento.replace(/\D/g, '')
    const ok = tipoDoc === 'cpf' ? limpo.length === 11 : limpo.length === 14
    setStDoc({ ok, hint: ok ? '' : `${tipoDoc.toUpperCase()} ${t.validacao.docInvalido}` })
    if (ok) verificarDocBanco(limpo)
    return ok
  }

  async function verificarDocBanco(limpo: string) {
    setStDoc({ ok: null, hint: `${t.validacao.docVerificando} ${tipoDoc.toUpperCase()}...` })
    const existe = await checarDisponibilidade('documento', limpo)
    if (existe === null) { setStDoc({ ok: null, hint: '' }); return }
    if (existe) setStDoc({ ok: false, hint: `${t.validacao.docJaCadastradoA} ${tipoDoc.toUpperCase()} ${t.validacao.docJaCadastradoB}` })
    else        setStDoc({ ok: true,  hint: `${tipoDoc.toUpperCase()} ${t.validacao.docDisponivelB}` })
  }

  function validarNome() {
    const ok = nome.trim().length >= 3 && nome.trim().includes(' ')
    setStNome({ ok, hint: ok ? '' : t.validacao.nomeSobrenome })
    return ok
  }

  function validarIdade() {
    if (!nascimento) { setStNasc({ ok: null, hint: t.hints.maiorDe18 }); return false }
    const nasc = new Date(nascimento + 'T00:00:00')
    const ano  = nasc.getFullYear()
    const hoje = new Date()
    if (isNaN(nasc.getTime()) || ano < 1900 || ano > hoje.getFullYear()) {
      setStNasc({ ok: false, hint: t.validacao.dataInvalida }); return false
    }
    let idade = hoje.getFullYear() - nasc.getFullYear()
    const m = hoje.getMonth() - nasc.getMonth()
    if (m < 0 || (m === 0 && hoje.getDate() < nasc.getDate())) idade--
    const ok = idade >= 18
    setStNasc({ ok, hint: ok ? t.validacao.idadeConfirmada : t.validacao.precisa18 })
    return ok
  }

  function validarEmailFormato() {
    const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
    if (!ok) setStEmail({ ok: false, hint: t.validacao.emailInvalido })
    return ok
  }

  function validarEmail() {
    const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
    setStEmail({ ok, hint: ok ? '' : t.validacao.emailInvalido })
    if (ok) verificarEmailBanco(email.trim())
    return ok
  }

  async function verificarEmailBanco(em: string) {
    setStEmail({ ok: null, hint: t.validacao.emailVerificando })
    const existe = await checarDisponibilidade('email', em)
    if (existe === null) { setStEmail({ ok: null, hint: '' }); return }
    if (existe) setStEmail({ ok: false, hint: t.validacao.emailJaCadastrado })
    else        setStEmail({ ok: true,  hint: t.validacao.emailDisponivel })
  }

  function formatarUsuario(val: string) {
    return val.toLowerCase().replace(/[^a-z0-9_]/g, '')
  }

  function validarUsuarioFormato() {
    const ok = /^[a-z0-9_]{3,20}$/.test(usuario)
    if (!ok) setStUsuario({ ok: false, hint: usuario ? t.validacao.usuarioRegras : t.validacao.usuarioInformar })
    return ok
  }

  function validarUsuario() {
    if (!usuario) { setStUsuario({ ok: null, hint: t.hints.usuarioRegras }); return false }
    const ok = /^[a-z0-9_]{3,20}$/.test(usuario)
    setStUsuario({ ok, hint: ok ? '' : t.validacao.usuarioRegras })
    if (ok) verificarUsuarioBanco(usuario)
    return ok
  }

  async function verificarUsuarioBanco(u: string) {
    setStUsuario({ ok: null, hint: t.validacao.usuarioVerificando })
    const existe = await checarDisponibilidade('usuario', u)
    if (existe === null) { setStUsuario({ ok: null, hint: '' }); return }
    if (existe) setStUsuario({ ok: false, hint: t.validacao.usuarioEmUso })
    else        setStUsuario({ ok: true,  hint: t.validacao.usuarioDisponivel })
  }

  function validarSenha2() {
    if (!senha2) { setStSenha2({ ok: null, hint: '' }); return false }
    const ok = senha === senha2
    setStSenha2({ ok, hint: ok ? t.validacao.senhasConferem : t.validacao.senhasNaoCoincidem })
    return ok
  }

  function handleRefInput(val: string) {
    setRefCodigo(val)
    setRefAutoPreenchido(false)
    if (!val) { setRefStatus('idle'); setRefHint(t.indicacao.hintOpcional); return }
    setRefStatus('aviso')
    setRefHint(t.indicacao.hintDigite)
  }

  async function verificarRefNoBanco(handle: string): Promise<boolean> {
    if (!handle) return true
    const { data, error } = await supabase.rpc('verificar_codigo_indicacao', { p_codigo: handle.trim() })
    if (error) return false
    return data === true
  }

  async function salvarLeadIncompleto() {
    if (!email) return
    try {
      await supabase.rpc('salvar_cadastro_incompleto', {
        p_email:     email.trim(),
        p_nome:      nome.trim() || undefined,
        p_documento: documento.replace(/\D/g, '') || undefined,
        p_tipo_doc:  documento ? tipoDoc : undefined,
        p_ref:       refCodigo.trim() || undefined,
      })
    } catch (e) { console.warn('Lead incompleto não salvo:', e) }
  }

  // ── Submit ──
  async function submeter() {
    if (enviando) return
    setEnviando(true)
    setAlerta(null)

    // Validações locais
    const docOk   = validarDoc()
    const nomeOk  = validarNome()
    const idadeOk = validarIdade()
    const emailOk = validarEmailFormato()
    const userOk  = validarUsuarioFormato()
    const s2Ok    = validarSenha2()
    const senhaOk = senha.length >= 8

    let ok = docOk && nomeOk && idadeOk && emailOk && userOk && s2Ok && senhaOk

    if (!termos) {
      setAlerta({ tipo: 'erro', msg: t.alerta.aceitarTermos })
      ok = false
    } else if (!ok) {
      setAlerta({ tipo: 'erro', msg: t.alerta.corrijaCampos })
    }

    if (!ok) { setEnviando(false); return }

    // Valida código de indicação
    if (refCodigo.trim()) {
      const refValido = await verificarRefNoBanco(refCodigo.trim())
      if (!refValido) {
        setRefStatus('erro')
        setRefHint(t.indicacao.hintNaoEncontrado)
        setAlerta({ tipo: 'erro', msg: t.alerta.refInvalido })
        setEnviando(false)
        return
      }
    }

    try {
      await salvarLeadIncompleto()

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email.trim(),
        password: senha,
        options: { data: { nome: nome.trim(), usuario } }
      })

      if (authError) throw new Error(t.alerta.erroCriarConta)

      let userId = authData.user?.id

      if (authData.user?.identities?.length === 0) {
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password: senha })
        if (signInError || !signInData?.user?.id) throw new Error(t.alerta.emailJaPossuiConta)
        userId = signInData.user.id
        const { data: perfilExiste } = await supabase.from('usuarios').select('id').eq('id', userId).single()
        if (perfilExiste) throw new Error(t.alerta.emailJaPossuiConta)
      }

      if (!userId) throw new Error(t.alerta.erroObterId)

      const { error: dbError } = await supabase.from('usuarios').insert({
        id: userId,
        nome: nome.trim(),
        documento: documento.replace(/\D/g, ''),
        tipo_doc: tipoDoc,
        nascimento,
        usuario
      })

      if (dbError) {
        try { await supabase.rpc('limpar_zumbi_auth', { p_user_id: userId }) } catch (_) {}
        if (dbError.code === '23505') {
          if (dbError.message.includes('documento')) throw new Error(t.alerta.docJaCadastrado)
          if (dbError.message.includes('usuario'))   throw new Error(t.alerta.usuarioEmUso)
        }
        throw new Error(t.alerta.erroSalvarDados)
      }

      if (refCodigo.trim() && userId) {
        // Indicação host→host (legado) + indicação cliente→cliente (créditos/cupom).
        try { await supabase.rpc('registrar_indicacao', { p_indicado_id: userId, p_ref_handle: refCodigo.trim() }) } catch (_) {}
        try { await supabase.rpc('registrar_indicacao_cliente', { p_codigo: refCodigo.trim(), p_indicado: userId }) } catch (_) {}
      }

      try { await supabase.rpc('marcar_cadastro_convertido', { p_email: email.trim() }) } catch (_) {}

      // LGPD — registra a prova do aceite dos Termos/Privacidade (server-side: versão/IP/UA).
      try {
        await fetch('/api/conta/consentimento', {
          method: 'POST',
          headers: { ...(await authHeaders()), 'Content-Type': 'application/json' },
          body: JSON.stringify({ nome: nome.trim() }),
        })
      } catch (_) {}

      setSucesso(true)

    } catch (err: unknown) {
      setAlerta({ tipo: 'erro', msg: (err instanceof Error ? err.message : null) || t.alerta.erroGenerico })
    } finally {
      setEnviando(false)
    }
  }

  // ── Ícone de status do campo ──
  function StatusIcon({ st }: { st: FieldStatus }) {
    if (st.ok === null) return null
    return (
      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-base leading-none pointer-events-none [font-family:'Material_Icons']"
        style={{ color: st.ok ? 'var(--verde)' : 'var(--vermelho)' }}>
        {st.ok ? 'check_circle' : 'error_outline'}
      </span>
    )
  }

  function HintText({ st }: { st: FieldStatus }) {
    if (!st.hint) return null
    return (
      <p className={`campo-hint${st.ok === false ? ' erro' : ''} flex items-center gap-1 text-xs mt-[5px]`}>
        {st.ok === true  && <span className="material-icons text-[.85rem] text-[var(--verde)]">check_circle</span>}
        {st.ok === false && <span className="material-icons text-[.85rem]">error_outline</span>}
        {st.hint}
      </p>
    )
  }

  return (
    <>
      <Header />

      <main className="flex-1 flex items-center justify-center px-[5%] pt-[120px] pb-16">
        <div className="cadastro-wrap">

          {/* ── TOPO ── */}
          <div className="cadastro-topo">
            <span className="cadastro-tag">{t.tag}</span>
            <h1>{t.tituloAntes} <em>VENTSY</em></h1>
            <p>{t.subtituloA}<br />{t.subtituloB}</p>
          </div>

          <div className="cadastro-card">

            {/* ── SUCESSO ── */}
            {sucesso ? (
              <div className="sucesso-screen block text-center py-5">
                <div className="sucesso-icone-grande">
                  <span className="material-icons text-[2.2rem] text-[var(--verde)]">check</span>
                </div>
                <h2>{t.sucessoTitulo}</h2>
                <p>{t.sucessoTextoA}<br />{t.sucessoTextoB}<br />{t.sucessoTextoC}</p>
                <Link href="/painel" className="btn-ir-plataforma">
                  <span className="material-icons">login</span>
                  {t.sucessoBotao}
                </Link>
              </div>
            ) : (
              <div id="form-cadastro">

                {/* Alerta */}
                {alerta && (
                  <div className={`cadastro-alerta cadastro-alerta-${alerta.tipo}`} role="alert">
                    <span className="material-icons" aria-hidden="true">{alerta.tipo === 'erro' ? 'error_outline' : 'check_circle'}</span>
                    <span>{alerta.msg}</span>
                  </div>
                )}

                {/* Tipo de documento */}
                <div className="tipo-doc" role="group" aria-label={t.tipoDocLabel}>
                  <button type="button" aria-pressed={tipoDoc === 'cpf'} className={`tipo-btn${tipoDoc === 'cpf' ? ' ativo' : ''}`} onClick={() => trocarTipoDoc('cpf')}>
                    <span className="material-icons" aria-hidden="true">person</span> {t.cpfPessoaFisica}
                  </button>
                  <button type="button" aria-pressed={tipoDoc === 'cnpj'} className={`tipo-btn${tipoDoc === 'cnpj' ? ' ativo' : ''}`} onClick={() => trocarTipoDoc('cnpj')}>
                    <span className="material-icons" aria-hidden="true">business</span> {t.cnpjEmpresa}
                  </button>
                </div>

                {/* Documento */}
                <div className="form-group">
                  <label htmlFor="cad-doc">{tipoDoc === 'cpf' ? t.cpf : t.cnpj}</label>
                  <div className="input-wrap">
                    <span className="material-icons icon-left" aria-hidden="true">badge</span>
                    <input
                      id="cad-doc"
                      type="text"
                      inputMode="numeric"
                      value={documento}
                      placeholder={tipoDoc === 'cpf' ? '000.000.000-00' : '00.000.000/0000-00'}
                      maxLength={tipoDoc === 'cpf' ? 14 : 18}
                      onChange={e => handleDocumento(e.target.value)}
                      onBlur={validarDoc}
                    />
                    <StatusIcon st={stDoc} />
                  </div>
                  <HintText st={stDoc} />
                </div>

                <div className="divider"><span>{t.divisorDadosPessoais}</span></div>

                {/* Nome */}
                <div className="form-group">
                  <label htmlFor="cad-nome">{t.nomeLabel}</label>
                  <div className="input-wrap">
                    <span className="material-icons icon-left" aria-hidden="true">person_outline</span>
                    <input id="cad-nome" type="text" autoComplete="name" value={nome} placeholder={t.nomePlaceholder}
                      onChange={e => setNome(e.target.value)} onBlur={validarNome} />
                    <StatusIcon st={stNome} />
                  </div>
                  <HintText st={stNome} />
                </div>

                {/* Nascimento */}
                <div className="form-group">
                  <label htmlFor="cad-nasc">{t.nascimentoLabel}</label>
                  <div className="input-wrap">
                    <span className="material-icons icon-left" aria-hidden="true">cake</span>
                    <input id="cad-nasc" type="date" autoComplete="bday" value={nascimento} max={maxNasc}
                      onChange={e => { setNascimento(e.target.value); validarIdade() }}
                      onBlur={validarIdade} />
                    <StatusIcon st={stNasc} />
                  </div>
                  <HintText st={stNasc} />
                </div>

                <div className="divider"><span>{t.divisorAcesso}</span></div>

                {/* E-mail */}
                <div className="form-group">
                  <label htmlFor="cad-email">{t.emailLabel}</label>
                  <div className="input-wrap">
                    <span className="material-icons icon-left" aria-hidden="true">email</span>
                    <input id="cad-email" type="email" autoComplete="email" inputMode="email" value={email} placeholder={t.emailPlaceholder}
                      onChange={e => setEmail(e.target.value)} onBlur={validarEmail} />
                    <StatusIcon st={stEmail} />
                  </div>
                  <HintText st={stEmail} />
                </div>

                {/* Usuário */}
                <div className="form-group">
                  <label htmlFor="cad-usuario">{t.usuarioLabel}</label>
                  <div className="input-wrap">
                    <span className="material-icons icon-left" aria-hidden="true">alternate_email</span>
                    <input id="cad-usuario" type="text" autoComplete="username" value={usuario} placeholder={t.usuarioPlaceholder}
                      onChange={e => setUsuario(formatarUsuario(e.target.value))}
                      onBlur={validarUsuario} />
                    <StatusIcon st={stUsuario} />
                  </div>
                  <HintText st={stUsuario} />
                </div>

                {/* Senha */}
                <div className="form-group">
                  <label htmlFor="cad-senha">{t.senhaLabel}</label>
                  <div className="input-wrap">
                    <span className="material-icons icon-left" aria-hidden="true">lock_outline</span>
                    <input id="cad-senha" type={mostraSenha ? 'text' : 'password'} autoComplete="new-password" value={senha}
                      className="com-toggle" placeholder={t.senhaPlaceholder}
                      onChange={e => { setSenha(e.target.value); setForca(avaliarForca(e.target.value)) }} />
                    <button type="button" className="toggle-senha" onClick={() => setMostraSenha(!mostraSenha)}
                      aria-label={mostraSenha ? t.ocultarSenha : t.mostrarSenha} aria-pressed={mostraSenha}>
                      <span className="material-icons" aria-hidden="true">{mostraSenha ? 'visibility' : 'visibility_off'}</span>
                    </button>
                  </div>
                  {/* Barras de força */}
                  <div className="senha-forca">
                    {[1,2,3,4].map(i => (
                      <div key={i} className="forca-barra"
                        style={{ background: i <= forca.forca ? forca.cor : 'var(--cinza-borda)' }} />
                    ))}
                  </div>
                  {forca.forca > 0 && <p className="forca-label" style={{ color: forca.cor }}>{forcaLabels[forca.forca]}</p>}
                </div>

                {/* Confirmar senha */}
                <div className="form-group">
                  <label htmlFor="cad-senha2">{t.senha2Label}</label>
                  <div className="input-wrap">
                    <span className="material-icons icon-left" aria-hidden="true">lock_outline</span>
                    <input id="cad-senha2" type={mostraSenha2 ? 'text' : 'password'} autoComplete="new-password" value={senha2}
                      className="com-toggle" placeholder={t.senha2Placeholder}
                      onChange={e => setSenha2(e.target.value)} onBlur={validarSenha2} />
                    <button type="button" className="toggle-senha" onClick={() => setMostraSenha2(!mostraSenha2)}
                      aria-label={mostraSenha2 ? t.ocultarSenha : t.mostrarSenha} aria-pressed={mostraSenha2}>
                      <span className="material-icons" aria-hidden="true">{mostraSenha2 ? 'visibility' : 'visibility_off'}</span>
                    </button>
                  </div>
                  <HintText st={stSenha2} />
                </div>

                {/* ── BLOCO INDICAÇÃO ── */}
                <div className="indicacao-bloco" id="bloco-indicacao">
                  <div className="indicacao-cabecalho">
                    <div className="indicacao-emoji">🤝</div>
                    <div className="indicacao-cabecalho-texto">
                      <strong>{t.indicacao.tituloPergunta}</strong>
                      <span>{t.indicacao.subtitulo}</span>
                    </div>
                  </div>
                  <div className="indicacao-corpo">
                    <p>{t.indicacao.instrucaoA} <strong>{t.indicacao.instrucaoNegritoA}</strong>{t.indicacao.instrucaoB}{' '}
                      <strong>{t.indicacao.instrucaoNegritoB}</strong> {t.indicacao.instrucaoC}
                    </p>
                    <div className="indicacao-input-wrap">
                      <span className="material-icons icon-left text-[#ff385c]">card_giftcard</span>
                      <input
                        id="ref-codigo"
                        type="text"
                        aria-label={t.indicacao.aria}
                        value={refCodigo}
                        placeholder={t.indicacao.placeholder}
                        maxLength={8}
                        autoComplete="off"
                        className={refAutoPreenchido ? 'preenchido-auto' : refStatus === 'erro' ? 'erro' : ''}
                        onChange={e => handleRefInput(e.target.value)}
                      />
                      {refStatus !== 'idle' && (
                        <span className={`material-icons ref-status-icone ${refStatus}`}>
                          {refStatus === 'ok' ? 'check_circle' : refStatus === 'aviso' ? 'edit' : 'error_outline'}
                        </span>
                      )}
                    </div>
                    <p className={`ref-hint${refStatus !== 'idle' ? ' ' + refStatus : ''}`}>
                      <span className="material-icons">
                        {refStatus === 'ok' ? 'check_circle' : refStatus === 'erro' ? 'error_outline' : refStatus === 'aviso' ? 'warning_amber' : 'info'}
                      </span>
                      {refHint}
                    </p>
                  </div>
                </div>

                {/* Termos */}
                <div className="termos-linha">
                  <input type="checkbox" id="termos" aria-label={t.termosAria} checked={termos} onChange={e => setTermos(e.target.checked)} />
                  <p>{t.termosTextoA}{' '}
                    <Link href={lhref('/termos')}>{t.termosLinkTermos}</Link> {t.termosTextoE}{' '}
                    <Link href={lhref('/privacidade')}>{t.termosLinkPrivacidade}</Link> {t.termosTextoFim}
                  </p>
                </div>

                {/* Botão */}
                <button className="btn-cadastrar" disabled={enviando} onClick={submeter}>
                  <span className="material-icons">
                    {enviando ? 'sync' : 'arrow_forward'}
                  </span>
                  {enviando ? t.btnCriando : t.btnCriar}
                </button>

              </div>
            )}
          </div>

          <p className="link-login">{t.jaTemConta} <Link href={lhref('/login')}>{t.entrar}</Link></p>
        </div>
      </main>

      <Footer />
    </>
  )
}

export default function CadastroPage() {
  return (
    <Suspense fallback={null}>
      <CadastroContent />
    </Suspense>
  )
}
