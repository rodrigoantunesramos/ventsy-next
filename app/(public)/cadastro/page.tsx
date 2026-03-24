'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import { Suspense } from 'react'
import type { Metadata } from 'next'

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

function avaliarForca(senha: string): { forca: number; label: string; cor: string } {
  let f = 0
  if (senha.length >= 8)          f++
  if (/[A-Z]/.test(senha))        f++
  if (/[0-9]/.test(senha))        f++
  if (/[^A-Za-z0-9]/.test(senha)) f++
  const cores  = ['', '#ff385c', '#ff8c00', '#f0c040', '#22c55e']
  const labels = ['', 'Muito fraca', 'Fraca', 'Boa', 'Forte']
  return { forca: f, label: labels[f] || '', cor: cores[f] || '' }
}

// ── Tipo para status de campo ──
type FieldStatus = { ok: boolean | null; hint: string }

function CadastroContent() {
  const router = useRouter()
  const params = useSearchParams()

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
  const [refHint, setRefHint]     = useState('Opcional — deixe em branco se não foi indicado por ninguém.')

  // ── Status dos campos ──
  const [stDoc,     setStDoc]     = useState<FieldStatus>({ ok: null, hint: '' })
  const [stNome,    setStNome]    = useState<FieldStatus>({ ok: null, hint: '' })
  const [stNasc,    setStNasc]    = useState<FieldStatus>({ ok: null, hint: 'Apenas maiores de 18 anos podem se cadastrar.' })
  const [stEmail,   setStEmail]   = useState<FieldStatus>({ ok: null, hint: 'Usado para fazer login na plataforma.' })
  const [stUsuario, setStUsuario] = useState<FieldStatus>({ ok: null, hint: 'Letras minúsculas, números e _ (sem espaços).' })
  const [stSenha2,  setStSenha2]  = useState<FieldStatus>({ ok: null, hint: '' })

  // ── Força senha ──
  const [forca, setForca] = useState({ forca: 0, label: '', cor: '' })

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
      setRefHint('Código preenchido automaticamente pelo link de convite!')
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
    setStDoc({ ok, hint: ok ? '' : `${tipoDoc.toUpperCase()} inválido ou incompleto.` })
    if (ok) verificarDocBanco(limpo)
    return ok
  }

  async function verificarDocBanco(limpo: string) {
    setStDoc({ ok: null, hint: `Verificando ${tipoDoc.toUpperCase()}...` })
    const { data, error } = await supabase.rpc('verificar_documento', { p_documento: limpo })
    if (error) { setStDoc({ ok: null, hint: '' }); return }
    if (data === true) setStDoc({ ok: false, hint: `Este ${tipoDoc.toUpperCase()} já está cadastrado. Tente fazer login.` })
    else               setStDoc({ ok: true,  hint: `${tipoDoc.toUpperCase()} disponível.` })
  }

  function validarNome() {
    const ok = nome.trim().length >= 3 && nome.trim().includes(' ')
    setStNome({ ok, hint: ok ? '' : 'Informe nome e sobrenome.' })
    return ok
  }

  function validarIdade() {
    if (!nascimento) { setStNasc({ ok: null, hint: 'Apenas maiores de 18 anos podem se cadastrar.' }); return false }
    const nasc = new Date(nascimento + 'T00:00:00')
    const ano  = nasc.getFullYear()
    const hoje = new Date()
    if (isNaN(nasc.getTime()) || ano < 1900 || ano > hoje.getFullYear()) {
      setStNasc({ ok: false, hint: 'Data inválida.' }); return false
    }
    let idade = hoje.getFullYear() - nasc.getFullYear()
    const m = hoje.getMonth() - nasc.getMonth()
    if (m < 0 || (m === 0 && hoje.getDate() < nasc.getDate())) idade--
    const ok = idade >= 18
    setStNasc({ ok, hint: ok ? 'Idade confirmada.' : 'Você precisa ter 18 anos ou mais.' })
    return ok
  }

  function validarEmailFormato() {
    const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
    if (!ok) setStEmail({ ok: false, hint: 'Informe um e-mail válido.' })
    return ok
  }

  function validarEmail() {
    const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
    setStEmail({ ok, hint: ok ? '' : 'Informe um e-mail válido.' })
    if (ok) verificarEmailBanco(email.trim())
    return ok
  }

  async function verificarEmailBanco(em: string) {
    setStEmail({ ok: null, hint: 'Verificando e-mail...' })
    const { data, error } = await supabase.rpc('verificar_email', { p_email: em })
    if (error) { setStEmail({ ok: null, hint: '' }); return }
    if (data === true) setStEmail({ ok: false, hint: 'Este e-mail já está cadastrado. Tente fazer login.' })
    else               setStEmail({ ok: true,  hint: 'E-mail disponível.' })
  }

  function formatarUsuario(val: string) {
    return val.toLowerCase().replace(/[^a-z0-9_]/g, '')
  }

  function validarUsuarioFormato() {
    const ok = /^[a-z0-9_]{3,20}$/.test(usuario)
    if (!ok) setStUsuario({ ok: false, hint: usuario ? 'Entre 3 e 20 caracteres. Apenas letras, números e _.' : 'Informe um nome de usuário.' })
    return ok
  }

  function validarUsuario() {
    if (!usuario) { setStUsuario({ ok: null, hint: 'Letras minúsculas, números e _ (sem espaços).' }); return false }
    const ok = /^[a-z0-9_]{3,20}$/.test(usuario)
    setStUsuario({ ok, hint: ok ? '' : 'Entre 3 e 20 caracteres. Apenas letras, números e _.' })
    if (ok) verificarUsuarioBanco(usuario)
    return ok
  }

  async function verificarUsuarioBanco(u: string) {
    setStUsuario({ ok: null, hint: 'Verificando disponibilidade...' })
    const { data, error } = await supabase.rpc('verificar_usuario', { p_usuario: u })
    if (error) { setStUsuario({ ok: null, hint: '' }); return }
    if (data === true) setStUsuario({ ok: false, hint: 'Este nome de usuário já está em uso. Escolha outro.' })
    else               setStUsuario({ ok: true,  hint: 'Nome de usuário disponível!' })
  }

  function validarSenha2() {
    if (!senha2) { setStSenha2({ ok: null, hint: '' }); return false }
    const ok = senha === senha2
    setStSenha2({ ok, hint: ok ? 'Senhas conferem.' : 'As senhas não coincidem.' })
    return ok
  }

  function handleRefInput(val: string) {
    setRefCodigo(val)
    setRefAutoPreenchido(false)
    if (!val) { setRefStatus('idle'); setRefHint('Opcional — deixe em branco se não foi indicado por ninguém.'); return }
    setRefStatus('aviso')
    setRefHint('Digite exatamente como te passaram — maiúsculas e minúsculas importam!')
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
        p_nome:      nome.trim() || null,
        p_documento: documento.replace(/\D/g, '') || null,
        p_tipo_doc:  documento ? tipoDoc : null,
        p_ref:       refCodigo.trim() || null,
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
      setAlerta({ tipo: 'erro', msg: 'Você precisa aceitar os Termos de Uso para continuar.' })
      ok = false
    } else if (!ok) {
      setAlerta({ tipo: 'erro', msg: 'Corrija os campos em destaque antes de continuar.' })
    }

    if (!ok) { setEnviando(false); return }

    // Valida código de indicação
    if (refCodigo.trim()) {
      const refValido = await verificarRefNoBanco(refCodigo.trim())
      if (!refValido) {
        setRefStatus('erro')
        setRefHint('Usuário não encontrado. Tem certeza que o código está certo? Deixe em branco ou confira com quem te indicou.')
        setAlerta({ tipo: 'erro', msg: 'Código de indicação inválido.' })
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

      if (authError) throw new Error('Erro ao criar conta. Tente novamente.')

      let userId = authData.user?.id

      if (authData.user?.identities?.length === 0) {
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password: senha })
        if (signInError || !signInData?.user?.id) throw new Error('Este e-mail já possui uma conta. Tente fazer login.')
        userId = signInData.user.id
        const { data: perfilExiste } = await supabase.from('usuarios').select('id').eq('id', userId).single()
        if (perfilExiste) throw new Error('Este e-mail já possui uma conta. Tente fazer login.')
      }

      if (!userId) throw new Error('Erro ao obter ID do usuário. Tente novamente.')

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
          if (dbError.message.includes('documento')) throw new Error('Este CPF/CNPJ já está cadastrado.')
          if (dbError.message.includes('usuario'))   throw new Error('Este nome de usuário já está em uso. Escolha outro.')
        }
        throw new Error('Erro ao salvar seus dados. Tente novamente.')
      }

      if (refCodigo.trim() && userId) {
        try { await supabase.rpc('registrar_indicacao', { p_indicado_id: userId, p_ref_handle: refCodigo.trim() }) } catch (_) {}
      }

      try { await supabase.rpc('marcar_cadastro_convertido', { p_email: email.trim() }) } catch (_) {}

      setSucesso(true)

    } catch (err: any) {
      setAlerta({ tipo: 'erro', msg: err.message || 'Ocorreu um erro. Tente novamente.' })
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
            <span className="cadastro-tag">Novo cadastro</span>
            <h1>Crie sua conta na <em>VENTSY</em></h1>
            <p>Preencha as informações abaixo para começar.<br />Os demais detalhes serão completados dentro da plataforma.</p>
          </div>

          <div className="cadastro-card">

            {/* ── SUCESSO ── */}
            {sucesso ? (
              <div className="sucesso-screen block text-center py-5">
                <div className="sucesso-icone-grande">
                  <span className="material-icons text-[2.2rem] text-[var(--verde)]">check</span>
                </div>
                <h2>Conta criada!</h2>
                <p>Seu cadastro foi realizado com sucesso.<br />Acesse a plataforma para completar seu perfil<br />e começar a usar a VENTSY.</p>
                <Link href="/dashboard" className="btn-ir-plataforma">
                  <span className="material-icons">login</span>
                  Entrar na plataforma
                </Link>
              </div>
            ) : (
              <div id="form-cadastro">

                {/* Alerta */}
                {alerta && (
                  <div className={`cadastro-alerta cadastro-alerta-${alerta.tipo}`}>
                    <span className="material-icons">{alerta.tipo === 'erro' ? 'error_outline' : 'check_circle'}</span>
                    <span>{alerta.msg}</span>
                  </div>
                )}

                {/* Tipo de documento */}
                <div className="tipo-doc">
                  <button className={`tipo-btn${tipoDoc === 'cpf' ? ' ativo' : ''}`} onClick={() => trocarTipoDoc('cpf')}>
                    <span className="material-icons">person</span> CPF (Pessoa Física)
                  </button>
                  <button className={`tipo-btn${tipoDoc === 'cnpj' ? ' ativo' : ''}`} onClick={() => trocarTipoDoc('cnpj')}>
                    <span className="material-icons">business</span> CNPJ (Empresa)
                  </button>
                </div>

                {/* Documento */}
                <div className="form-group">
                  <label>{tipoDoc === 'cpf' ? 'CPF' : 'CNPJ'}</label>
                  <div className="input-wrap">
                    <span className="material-icons icon-left">badge</span>
                    <input
                      type="text"
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

                <div className="divider"><span>Dados pessoais</span></div>

                {/* Nome */}
                <div className="form-group">
                  <label>Nome completo</label>
                  <div className="input-wrap">
                    <span className="material-icons icon-left">person_outline</span>
                    <input type="text" value={nome} placeholder="Seu nome completo"
                      onChange={e => setNome(e.target.value)} onBlur={validarNome} />
                    <StatusIcon st={stNome} />
                  </div>
                  <HintText st={stNome} />
                </div>

                {/* Nascimento */}
                <div className="form-group">
                  <label>Data de nascimento</label>
                  <div className="input-wrap">
                    <span className="material-icons icon-left">cake</span>
                    <input type="date" value={nascimento} max={maxNasc}
                      onChange={e => { setNascimento(e.target.value); validarIdade() }}
                      onBlur={validarIdade} />
                    <StatusIcon st={stNasc} />
                  </div>
                  <HintText st={stNasc} />
                </div>

                <div className="divider"><span>Acesso à plataforma</span></div>

                {/* E-mail */}
                <div className="form-group">
                  <label>E-mail</label>
                  <div className="input-wrap">
                    <span className="material-icons icon-left">email</span>
                    <input type="email" value={email} placeholder="seu@email.com"
                      onChange={e => setEmail(e.target.value)} onBlur={validarEmail} />
                    <StatusIcon st={stEmail} />
                  </div>
                  <HintText st={stEmail} />
                </div>

                {/* Usuário */}
                <div className="form-group">
                  <label>Nome de usuário</label>
                  <div className="input-wrap">
                    <span className="material-icons icon-left">alternate_email</span>
                    <input type="text" value={usuario} placeholder="seu_usuario"
                      onChange={e => setUsuario(formatarUsuario(e.target.value))}
                      onBlur={validarUsuario} />
                    <StatusIcon st={stUsuario} />
                  </div>
                  <HintText st={stUsuario} />
                </div>

                {/* Senha */}
                <div className="form-group">
                  <label>Senha</label>
                  <div className="input-wrap">
                    <span className="material-icons icon-left">lock_outline</span>
                    <input type={mostraSenha ? 'text' : 'password'} value={senha}
                      className="com-toggle" placeholder="Mínimo 8 caracteres"
                      onChange={e => { setSenha(e.target.value); setForca(avaliarForca(e.target.value)) }} />
                    <button type="button" className="toggle-senha" onClick={() => setMostraSenha(!mostraSenha)} tabIndex={-1}>
                      <span className="material-icons">{mostraSenha ? 'visibility' : 'visibility_off'}</span>
                    </button>
                  </div>
                  {/* Barras de força */}
                  <div className="senha-forca">
                    {[1,2,3,4].map(i => (
                      <div key={i} className="forca-barra"
                        style={{ background: i <= forca.forca ? forca.cor : 'var(--cinza-borda)' }} />
                    ))}
                  </div>
                  {forca.label && <p className="forca-label" style={{ color: forca.cor }}>{forca.label}</p>}
                </div>

                {/* Confirmar senha */}
                <div className="form-group">
                  <label>Confirmar senha</label>
                  <div className="input-wrap">
                    <span className="material-icons icon-left">lock_outline</span>
                    <input type={mostraSenha2 ? 'text' : 'password'} value={senha2}
                      className="com-toggle" placeholder="Repita a senha"
                      onChange={e => setSenha2(e.target.value)} onBlur={validarSenha2} />
                    <button type="button" className="toggle-senha" onClick={() => setMostraSenha2(!mostraSenha2)} tabIndex={-1}>
                      <span className="material-icons">{mostraSenha2 ? 'visibility' : 'visibility_off'}</span>
                    </button>
                  </div>
                  <HintText st={stSenha2} />
                </div>

                {/* ── BLOCO INDICAÇÃO ── */}
                <div className="indicacao-bloco" id="bloco-indicacao">
                  <div className="indicacao-cabecalho">
                    <div className="indicacao-emoji">🤝</div>
                    <div className="indicacao-cabecalho-texto">
                      <strong>Você veio por indicação?</strong>
                      <span>A gente ama a transparência e o boca a boca. Bem-vindo à equipe VENTSY!</span>
                    </div>
                  </div>
                  <div className="indicacao-corpo">
                    <p>Cole abaixo o código de quem te indicou. Se você veio pelo link, ele <strong>preenche sozinho</strong>.
                      Se estiver em branco, consegue digitar exatamente como a pessoa te passou?{' '}
                      <strong>Não troque maiúsculo por minúsculo</strong> — cole igualzinho. A VENTSY agradece! 💙
                    </p>
                    <div className="indicacao-input-wrap">
                      <span className="material-icons icon-left text-[#ff385c]">card_giftcard</span>
                      <input
                        id="ref-codigo"
                        type="text"
                        value={refCodigo}
                        placeholder="Ex: A3KX92BZ"
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
                  <input type="checkbox" id="termos" checked={termos} onChange={e => setTermos(e.target.checked)} />
                  <p>Li e concordo com os{' '}
                    <Link href="/termos">Termos de Uso</Link> e a{' '}
                    <Link href="/privacidade">Política de Privacidade</Link> da VENTSY.
                  </p>
                </div>

                {/* Botão */}
                <button className="btn-cadastrar" disabled={enviando} onClick={submeter}>
                  <span className="material-icons">
                    {enviando ? 'sync' : 'arrow_forward'}
                  </span>
                  {enviando ? 'Criando conta...' : 'Criar minha conta'}
                </button>

              </div>
            )}
          </div>

          <p className="link-login">Já tem uma conta? <Link href="/login">Entrar</Link></p>
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
