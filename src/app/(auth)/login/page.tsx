'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/supabase'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [identificador, setIdentificador] = useState('') // Pode ser email ou username
  const [senha, setSenha] = useState('')
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')
  const supabase = createClient()
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setErro('')

    let emailParaLogin = identificador

    // Lógica: Se não tiver "@", assumimos que é um Username e buscamos o email
    if (!identificador.includes('@')) {
      const { data, error } = await supabase
        .from('usuarios')
        .select('email')
        .eq('username', identificador.toLowerCase())
        .single()

      if (error || !data) {
        setErro('Usuário não encontrado.')
        setLoading(false)
        return
      }
      emailParaLogin = data.email
    }

    // Autenticação real no Supabase
    const { error } = await supabase.auth.signInWithPassword({
      email: emailParaLogin,
      password: senha,
    })

    if (error) {
      setErro('E-mail/Usuário ou senha incorretos.')
      setLoading(false)
    } else {
      // Redireciona para o Dashboard do Proprietario após o login
      router.push('/painel')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
      <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
        <div className="text-center">
          <h2 className="text-3xl font-extrabold text-gray-900">Entrar na <span className="text-blue-600">VENTSY</span></h2>
          <p className="mt-2 text-sm text-gray-600">Bem-vindo de volta! Sentimos sua falta.</p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleLogin}>
          {erro && (
            <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm text-center border border-red-100">
              {erro}
            </div>
          )}

          <div className="space-y-4">
            {/* Campo E-mail ou Usuário */}
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase">E-mail ou Usuário</label>
              <div className="relative mt-1">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">@</span>
                <input 
                  type="text" required 
                  className="block w-full pl-10 py-2 border border-gray-300 rounded-md focus:ring-blue-500"
                  placeholder="seu_usuario ou email@exemplo.com"
                  onChange={(e) => setIdentificador(e.target.value)}  
                />
              </div>
            </div>

            {/* Campo Senha */}
            <div>
              <div className="flex justify-between items-center">
                <label className="text-xs font-semibold text-gray-500 uppercase">Senha</label>
                <Link href="/recuperar_senha" size="sm" className="text-xs text-blue-600 hover:underline">
                  Esqueci minha senha
                </Link>
              </div>
              <div className="relative mt-1">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">🔒</span>
                <input 
                  type="password" required 
                  className="block w-full pl-10 py-2 border border-gray-300 rounded-md focus:ring-blue-500"
                  placeholder="••••••••"
                  onChange={(e) => setSenha(e.target.value)}
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex justify-center py-3 text-sm font-bold rounded-xl text-white bg-blue-600 hover:bg-blue-700 transition-all disabled:bg-gray-400"
          >
            {loading ? "Entrando..." : "Entrar na plataforma"}
          </button>

          <div className="text-center mt-4">
            <p className="text-sm text-gray-600">
              Não possui cadastro? <Link href="/cadastro" className="font-bold text-blue-600 hover:text-blue-500">Cadastrar</Link>
            </p>
          </div>
        </form>
      </div>
    </div>
  )
}