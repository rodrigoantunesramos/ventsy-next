// Server Component: seção/carrossel de uma categoria na home. "Ver todos" é um
// <Link> rastreável (era router.push em client). Os cards são ilhas cliente.
import Link from 'next/link'
import PropertyCard from './PropertyCard'
import type { PropertySummary } from '@/types/client'

interface Props {
  cat: { nome: string; emoji: string }
  props: PropertySummary[]
}

export default function CategorySection({ cat, props }: Props) {
  return (
    <section className="max-w-[1440px] mx-auto px-[5%] pt-1 pb-0">
      {/* Cabeçalho da seção */}
      <div className="flex items-center gap-3 mb-3">
        <span className="text-lg leading-none" aria-hidden="true">{cat.emoji}</span>
        <h2 className="font-['Playfair_Display'] text-[1.1rem] font-black text-[#0d0d0d] tracking-tight">
          {cat.nome}
        </h2>
        <Link
          href={`/busca?tipo=${encodeURIComponent(cat.nome)}`}
          className="ml-auto bg-[#0d0d0d] hover:bg-[#ff385c] text-white no-underline rounded-full px-5 py-2 text-[.8rem] font-bold cursor-pointer whitespace-nowrap flex items-center gap-1.5 transition-all duration-200 hover:scale-[1.03]"
        >
          Ver todos
          <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </Link>
      </div>

      {/* Carrossel */}
      <div className="flex gap-3.5 overflow-x-auto pb-4 scrollbar-hide snap-x">
        {props.map((p, i) => (
          <div key={p.id} className="snap-start">
            <PropertyCard property={p} variant="compact" delay={i * 0.055} />
          </div>
        ))}
      </div>
    </section>
  )
}
