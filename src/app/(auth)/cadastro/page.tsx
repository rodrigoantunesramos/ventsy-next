'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/supabase'
import Link from 'next/link'
import { DocumentoStep } from './components/documento'
import { DadosPessoais } from './components/dados_pessoais'
import { SenhaStep } from './components/senha_cadastro'
import { IndicacaoField } from './components/indicacao'

export default function CadastroPage() {
  const [tipoPessoa, setTipoPessoa] = useState<'pf' | 'pj'>('pf')
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  const [formData, setFormData] = useState({
    nome: '', documento: '', nascimento: '', email: '', username: '', senha: '', confirmarSenha: '', indicacao: ''
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleCadastro = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    if (formData.senha !== formData.confirmarSenha) {
      alert("As senhas não coincidem!")
      setLoading(false)
      return
    }

    const { error } = await supabase.auth.signUp({
      email: formData.email,
      password: formData.senha,
      options: {
        data: {
          full_name: formData.nome,
          username: formData.username.toLowerCase(),
          documento: formData.documento,
          nascimento: formData.nascimento,
          indicacao: formData.indicacao
        }
      }
    })

    if (error) {
      alert(error.message)
    } else {
      alert("Conta criada! Verifique seu e-mail para confirmar.")
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
      <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
        <div>
          <h2 className="text-3xl font-extrabold text-gray-900 text-center">Crie sua conta na <span className="text-blue-600">VENTSY</span></h2>
          <p className="mt-2 text-center text-sm text-gray-600">Preencha as informações abaixo para começar.</p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleCadastro}>
          <DocumentoStep tipoPessoa={tipoPessoa} setTipoPessoa={setTipoPessoa} onChange={handleChange} />
          <DadosPessoais onChange={handleChange} />
          <SenhaStep onChange={handleChange} />
          <IndicacaoField onChange={handleChange} />

          <div className="flex items-start">
            <input type="checkbox" required className="mt-1 h-4 w-4 text-blue-600 border-gray-300 rounded" />
            <label className="ml-2 block text-xs text-gray-500">
              Li e concordo com os <Link href="/termos" className="text-blue-600 underline">Termos de Uso</Link> e a <Link href="/politica" className="text-blue-600 underline">Política de Privacidade</Link> da VENTSY.
            </label>
          </div>

          <button type="submit" disabled={loading} className="w-full flex justify-center py-3 text-sm font-bold rounded-xl text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400">
            {loading ? "Processando..." : "➡️ Criar minha conta"}
          </button>
        </form>
      </div>
    </div>
  )
}