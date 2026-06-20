'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import { supabase } from '@/lib/supabase'
import { useT } from '@/components/i18n/I18nProvider'

// Página de destino do e-mail de redefinição de senha (resetPasswordForEmail).
// Antes inexistente → o link caía em 404. Aceita o fluxo PKCE (?code) e o
// implícito (sessão já estabelecida pelo detectSessionInUrl).
export default function RedefinirSenhaPage() {
  const router = useRouter()
  const { dict, lhref } = useT()
  const [estado, setEstado] = useState<'verificando' | 'pronto' | 'invalido' | 'ok'>('verificando')
  const [senha, setSenha] = useState('')
  const [confirma, setConfirma] = useState('')
  const [mostra, setMostra] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    let vivo = true
    ;(async () => {
      const { data } = await supabase.auth.getSession()
      if (data.session) {
        if (vivo) setEstado('pronto')
        return
      }
      const code = new URLSearchParams(window.location.search).get('code')
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (!error && vivo) {
          setEstado('pronto')
          return
        }
      }
      if (vivo) setEstado('invalido')
    })()
    return () => {
      vivo = false
    }
  }, [])

  async function salvar(e: FormEvent) {
    e.preventDefault()
    setErro(null)
    if (senha.length < 8) {
      setErro(dict.auth.redefinir.erroSenhaCurta)
      return
    }
    if (senha !== confirma) {
      setErro(dict.auth.redefinir.erroSenhasDiferentes)
      return
    }
    setSalvando(true)
    const { error } = await supabase.auth.updateUser({ password: senha })
    setSalvando(false)
    if (error) {
      setErro(error.message || dict.auth.redefinir.erroGenerico)
      return
    }
    setEstado('ok')
    setTimeout(() => router.replace(lhref('/login')), 2200)
  }

  return (
    <>
      <Header />
      <main className="mx-auto flex min-h-[60vh] max-w-md flex-col justify-center px-4 py-16">
        <h1 className="mb-3 text-2xl font-bold">{dict.auth.redefinir.titulo}</h1>

        {estado === 'verificando' && <p className="text-gray-500">{dict.auth.redefinir.verificando}</p>}

        {estado === 'invalido' && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {dict.auth.redefinir.linkInvalidoInicio}{' '}
            <Link href={lhref('/login')} className="underline">
              {dict.auth.redefinir.linkInvalidoLink}
            </Link>{' '}
            {dict.auth.redefinir.linkInvalidoFim}
          </div>
        )}

        {estado === 'ok' && (
          <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-700">
            {dict.auth.redefinir.sucesso}
          </div>
        )}

        {estado === 'pronto' && (
          <form onSubmit={salvar} className="space-y-4">
            <p className="text-sm text-gray-500">{dict.auth.redefinir.definaNova}</p>
            {erro && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {erro}
              </div>
            )}
            <div>
              <label className="mb-1 block text-sm font-medium">{dict.auth.redefinir.novaSenhaLabel}</label>
              <input
                type={mostra ? 'text' : 'password'}
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder={dict.auth.redefinir.novaSenhaPlaceholder}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-[#ff385c]"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">{dict.auth.redefinir.confirmarSenhaLabel}</label>
              <input
                type={mostra ? 'text' : 'password'}
                value={confirma}
                onChange={(e) => setConfirma(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-[#ff385c]"
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-600">
              <input type="checkbox" checked={mostra} onChange={(e) => setMostra(e.target.checked)} />
              {dict.auth.redefinir.mostrarSenha}
            </label>
            <button
              type="submit"
              disabled={salvando}
              className="w-full rounded-lg bg-[#ff385c] px-4 py-2.5 font-medium text-white disabled:opacity-60"
            >
              {salvando ? dict.auth.redefinir.salvando : dict.auth.redefinir.botao}
            </button>
          </form>
        )}
      </main>
      <Footer />
    </>
  )
}
