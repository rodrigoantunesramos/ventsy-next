'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import { supabase } from '@/lib/supabase'

// Página de destino do e-mail de redefinição de senha (resetPasswordForEmail).
// Antes inexistente → o link caía em 404. Aceita o fluxo PKCE (?code) e o
// implícito (sessão já estabelecida pelo detectSessionInUrl).
export default function RedefinirSenhaPage() {
  const router = useRouter()
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
      setErro('A senha deve ter ao menos 8 caracteres.')
      return
    }
    if (senha !== confirma) {
      setErro('As senhas não conferem.')
      return
    }
    setSalvando(true)
    const { error } = await supabase.auth.updateUser({ password: senha })
    setSalvando(false)
    if (error) {
      setErro(error.message || 'Não foi possível redefinir a senha.')
      return
    }
    setEstado('ok')
    setTimeout(() => router.replace('/login'), 2200)
  }

  return (
    <>
      <Header />
      <main className="mx-auto flex min-h-[60vh] max-w-md flex-col justify-center px-4 py-16">
        <h1 className="mb-3 text-2xl font-bold">Redefinir senha</h1>

        {estado === 'verificando' && <p className="text-gray-500">Verificando o link…</p>}

        {estado === 'invalido' && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            Link inválido ou expirado. Volte ao{' '}
            <Link href="/login" className="underline">
              login
            </Link>{' '}
            e solicite um novo e-mail de redefinição.
          </div>
        )}

        {estado === 'ok' && (
          <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-700">
            Senha redefinida com sucesso! Redirecionando para o login…
          </div>
        )}

        {estado === 'pronto' && (
          <form onSubmit={salvar} className="space-y-4">
            <p className="text-sm text-gray-500">Defina sua nova senha de acesso.</p>
            {erro && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {erro}
              </div>
            )}
            <div>
              <label className="mb-1 block text-sm font-medium">Nova senha</label>
              <input
                type={mostra ? 'text' : 'password'}
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="Ao menos 8 caracteres"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-[#ff385c]"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Confirmar senha</label>
              <input
                type={mostra ? 'text' : 'password'}
                value={confirma}
                onChange={(e) => setConfirma(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-[#ff385c]"
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-600">
              <input type="checkbox" checked={mostra} onChange={(e) => setMostra(e.target.checked)} />
              Mostrar senha
            </label>
            <button
              type="submit"
              disabled={salvando}
              className="w-full rounded-lg bg-[#ff385c] px-4 py-2.5 font-medium text-white disabled:opacity-60"
            >
              {salvando ? 'Salvando…' : 'Redefinir senha'}
            </button>
          </form>
        )}
      </main>
      <Footer />
    </>
  )
}
