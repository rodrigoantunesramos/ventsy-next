'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/supabase'
import Link from 'next/link'

export default function ResetPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [mensagem, setMensagem] = useState('')
  const supabase = createClient()

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/atualizar_senha`,
    })

    if (error) {
      setMensagem('Erro ao enviar e-mail. Verifique o endereço digitado.')
    } else {
      setMensagem('Link de recuperação enviado! Verifique sua caixa de entrada.')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900">Recuperar Senha</h2>
          <p className="mt-2 text-sm text-gray-600">Enviaremos um link para você criar uma nova senha.</p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleReset}>
          {mensagem && (
            <div className={`p-3 rounded-lg text-sm text-center border ${mensagem.includes('Erro') ? 'bg-red-50 text-red-600 border-red-100' : 'bg-green-50 text-green-600 border-green-100'}`}>
              {mensagem}
            </div>
          )}

          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase">Seu E-mail</label>
            <input 
              type="email" required 
              className="block w-full mt-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500"
              placeholder="email@exemplo.com"
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 text-sm font-bold rounded-xl text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 transition-all"
          >
            {loading ? "Enviando..." : "Enviar link de recuperação"}
          </button>

          <div className="text-center mt-4">
            <Link href="/login" className="text-sm font-medium text-blue-600 hover:underline">
              Voltar para o login
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}