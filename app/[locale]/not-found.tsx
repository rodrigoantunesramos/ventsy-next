import Link from 'next/link'

// 404 dentro de um locale válido (ex.: /pt/inexistente). Renderiza DENTRO do
// [locale]/layout, então não precisa de <html> próprio.
export default function LocaleNotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="font-display text-6xl font-black text-brand">404</h1>
      <p className="text-lg text-ink-soft">Página não encontrada.</p>
      <Link href="/" className="font-semibold text-brand underline">
        Voltar ao início
      </Link>
    </main>
  )
}
