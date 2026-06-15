'use client'

// Ilha cliente: formulário de candidatura (POST /api/rh/candidatura). Honeypot
// anti-bot. O conteúdo da vaga é renderizado no servidor (page.tsx).
import { useState, type ChangeEvent, type FormEvent } from 'react'
import { useT } from '@/components/i18n/I18nProvider'

const inp =
  'w-full rounded-xl border border-black/10 px-3.5 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20'

export default function Candidatura({ slug }: { slug: string }) {
  const { dict } = useT()
  const t = dict.vagas
  const [f, setF] = useState({ nome: '', email: '', telefone: '', curriculo_url: '', mensagem: '', website: '' })
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [erro, setErro] = useState('')

  const set =
    (k: keyof typeof f) =>
    (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setF((s) => ({ ...s, [k]: e.target.value }))

  async function enviar(e: FormEvent) {
    e.preventDefault()
    setErro('')
    if (!f.nome.trim()) { setErro(t.erroNome); return }
    setEnviando(true)
    try {
      const res = await fetch('/api/rh/candidatura', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...f, slug }),
      })
      const json = await res.json()
      setEnviando(false)
      if (res.ok && json.ok) setEnviado(true)
      else setErro(json.error || t.erroEnvioGenerico)
    } catch {
      setEnviando(false)
      setErro(t.erroRede)
    }
  }

  if (enviado) {
    return (
      <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-center" role="status">
        <div className="text-2xl" aria-hidden="true">🎉</div>
        <p className="mt-1 font-semibold text-emerald-800">{t.sucessoTitulo}</p>
        <p className="mt-0.5 text-sm text-emerald-700">{t.sucessoTexto}</p>
      </div>
    )
  }

  return (
    <form onSubmit={enviar} className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
      <label className="block sm:col-span-2">
        <span className="mb-1.5 block text-sm font-semibold text-ink-soft">{t.nomeLabel}</span>
        <input className={inp} value={f.nome} onChange={set('nome')} autoComplete="name" required />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-sm font-semibold text-ink-soft">{t.emailLabel}</span>
        <input type="email" inputMode="email" autoComplete="email" className={inp} value={f.email} onChange={set('email')} />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-sm font-semibold text-ink-soft">{t.telefoneLabel}</span>
        <input type="tel" inputMode="tel" autoComplete="tel" className={inp} value={f.telefone} onChange={set('telefone')} />
      </label>
      <label className="block sm:col-span-2">
        <span className="mb-1.5 block text-sm font-semibold text-ink-soft">{t.curriculoLabel}</span>
        <input type="url" className={inp} value={f.curriculo_url} onChange={set('curriculo_url')} placeholder="https://" />
      </label>
      <label className="block sm:col-span-2">
        <span className="mb-1.5 block text-sm font-semibold text-ink-soft">{t.mensagemLabel}</span>
        <textarea className={`${inp} min-h-[88px]`} value={f.mensagem} onChange={set('mensagem')} placeholder={t.mensagemPlaceholder} />
      </label>
      {/* honeypot (oculto) */}
      <input type="text" tabIndex={-1} autoComplete="off" value={f.website} onChange={set('website')} className="hidden" aria-hidden />
      {erro && <p className="text-sm text-red-600 sm:col-span-2" role="alert">{erro}</p>}
      <div className="sm:col-span-2">
        <button type="submit" disabled={enviando} className="rounded-xl bg-brand px-6 py-3 text-sm font-bold text-white transition hover:bg-brand-600 disabled:opacity-60">
          {enviando ? t.btnEnviando : t.btnEnviar}
        </button>
      </div>
    </form>
  )
}
