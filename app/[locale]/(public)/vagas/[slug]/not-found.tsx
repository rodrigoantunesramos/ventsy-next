import Link from 'next/link'
import { getDictionary } from '@/lib/i18n/getDictionary'
import { defaultLocale } from '@/lib/i18n/config'

// not-found.tsx do App Router não recebe params de locale de forma garantida —
// usa o dicionário do locale padrão (PT) para os textos.
export default function VagaNaoEncontrada() {
  const t = getDictionary(defaultLocale).vagas.naoEncontrada
  return (
    <div className="min-h-screen bg-[#f7f7f8]">
      <header className="border-b border-black/[0.06] bg-white">
        <div className="mx-auto flex h-[60px] max-w-3xl items-center px-4">
          <Link href="/" className="font-display text-[1.4rem] font-bold italic text-brand">VENTSY</Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-8">
        <div className="rounded-2xl bg-white p-10 text-center shadow-card">
          <h1 className="font-display text-xl font-bold text-ink">{t.titulo}</h1>
          <p className="mt-2 text-sm text-ink-muted">{t.texto}</p>
          <Link href="/" className="mt-4 inline-block rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-600">{t.voltar}</Link>
        </div>
      </main>
    </div>
  )
}
