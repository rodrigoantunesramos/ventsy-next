'use client'
import Link from 'next/link'
import { useT } from './i18n/I18nProvider'
import { rotuloDado } from '@/lib/i18n/dados'

export default function Footer() {
  const { dict, lhref } = useT()
  return (
    <footer className="bg-[#0d0d0d] text-gray-300 pt-12 pb-8 mt-16">
      <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row gap-10 mb-10">
        <div className="flex-1">
          <h3 className="text-white font-semibold text-sm mb-4">{dict.footer.atendimento}</h3>
          <ul className="space-y-2 list-none">
            <li><Link href={lhref('/fale-conosco')} className="text-gray-400 hover:text-white text-sm no-underline transition-colors">{dict.footer.faleConosco}</Link></li>
            <li><Link href={lhref('/privacidade')} className="text-gray-400 hover:text-white text-sm no-underline transition-colors">{dict.footer.privacidade}</Link></li>
            <li><Link href={lhref('/termos')} className="text-gray-400 hover:text-white text-sm no-underline transition-colors">{dict.footer.termos}</Link></li>
            <li><Link href={lhref('/como-funciona')} className="text-gray-400 hover:text-white text-sm no-underline transition-colors">{dict.footer.comoFunciona}</Link></li>
          </ul>
        </div>
        <div className="flex-1">
          <h3 className="text-white font-semibold text-sm mb-4">{dict.footer.anunciar}</h3>
          <ul className="space-y-2 list-none">
            <li><Link href={lhref('/cadastro')} className="text-gray-400 hover:text-white text-sm no-underline transition-colors">{dict.footer.cadastrePropriedade}</Link></li>
            <li><Link href={lhref('/planos')} className="text-gray-400 hover:text-white text-sm no-underline transition-colors">{dict.footer.planosDisponiveis}</Link></li>
          </ul>
        </div>
        <div className="flex-1">
          <h3 className="text-white font-semibold text-sm mb-4">{dict.footer.descubra}</h3>
          <ul className="space-y-2 list-none">
            {['Salão de Festas', 'Casas de Festas', 'Sítios', 'Chácaras', 'Rooftops'].map((cat) => (
              <li key={cat}>
                <Link href={`${lhref('/busca')}?tipo=${encodeURIComponent(cat)}`} className="text-gray-400 hover:text-white text-sm no-underline transition-colors">
                  {rotuloDado(dict.dados.categorias, cat)}
                </Link>
              </li>
            ))}
            <li><Link href={lhref('/listas')} className="text-gray-400 hover:text-white text-sm no-underline transition-colors">{dict.footer.listasPublicas}</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-gray-800 pt-6 text-center">
        <p className="text-gray-600 text-sm">{dict.footer.direitos}</p>
      </div>
    </footer>
  )
}
