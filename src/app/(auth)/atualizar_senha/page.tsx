'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/supabase'
import { useRouter } from 'next/navigation'

export default function UpdatePasswordPage() {
  const [novaSenha, setNovaSenha] = useState('')
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')
  const supabase = createClient()
  const router = useRouter()

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    const { error } = await supabase.auth.updateUser({
      password: novaSenha
    })

    if (error) {
      setErro('Não foi possível atualizar a senha. O link pode ter expirado.')
      setLoading(false)
    } else {
      alert('Senha atualizada com sucesso!')
      router.push('/login')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
        <h2 className="text-2xl font-bold text-gray-900 text-center">Nova Senha</h2>
        <p className="text-center text-sm text-gray-600 mt-2">Digite sua nova senha de acesso abaixo.</p>

        <form className="mt-8 space-y-6" onSubmit={handleUpdate}>
          {erro && <div className="text-red-500 text-sm text-center">{erro}</div>}
          
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase">Nova Senha</label>
            <input 
              type="password" required minLength={6}
              className="block w-full mt-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500"
              placeholder="No mínimo 6 caracteres"
              onChange={(e) => setNovaSenha(e.target.value)}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 text-sm font-bold rounded-xl text-white bg-green-600 hover:bg-green-700 transition-all"
          >
            {loading ? "Salvando..." : "Atualizar Senha"}
          </button>
        </form>
      </div>
    </div>
  )
}