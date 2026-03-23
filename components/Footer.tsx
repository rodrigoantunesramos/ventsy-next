import Link from 'next/link'

export default function Footer() {
  return (
    <footer className="bg-[#0d0d0d] text-gray-300 pt-12 pb-8 mt-16">
      <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row gap-10 mb-10">
        <div className="flex-1">
          <h3 className="text-white font-semibold text-sm mb-4">Atendimento</h3>
          <ul className="space-y-2 list-none">
            <li><Link href="/fale-conosco" className="text-gray-400 hover:text-white text-sm no-underline transition-colors">Fale Conosco</Link></li>
            <li><Link href="/privacidade" className="text-gray-400 hover:text-white text-sm no-underline transition-colors">Política de Privacidade</Link></li>
            <li><Link href="/termos" className="text-gray-400 hover:text-white text-sm no-underline transition-colors">Termos de Uso</Link></li>
            <li><Link href="/como-funciona" className="text-gray-400 hover:text-white text-sm no-underline transition-colors">Como Funciona</Link></li>
          </ul>
        </div>
        <div className="flex-1">
          <h3 className="text-white font-semibold text-sm mb-4">Anunciar</h3>
          <ul className="space-y-2 list-none">
            <li><Link href="/cadastro" className="text-gray-400 hover:text-white text-sm no-underline transition-colors">Cadastre sua propriedade</Link></li>
            <li><Link href="/planos" className="text-gray-400 hover:text-white text-sm no-underline transition-colors">Planos Disponíveis</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-gray-800 pt-6 text-center">
        <p className="text-gray-600 text-sm">© 2026 VENTSY. Todos os direitos reservados.</p>
      </div>
    </footer>
  )
}
