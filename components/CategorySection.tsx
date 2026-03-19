'use client'
import { useRouter } from 'next/navigation'
import PropertyCard from './PropertyCard'
import { supabase } from '@/lib/supabase'

interface Props {
  cat: { nome: string; emoji: string }
  props: any[]
}

export default function CategorySection({ cat, props }: Props) {
  const router = useRouter()

  const buscarCat = async (nome: string) => {
    try { await supabase.from('buscas').insert({ tipo_evento: nome }) } catch (_) {}
    router.push(`/busca?tipo=${encodeURIComponent(nome)}`)
  }

  return (
    <div className="secao">
      <div className="secao-header">
        <span className="secao-emoji">{cat.emoji}</span>
        <h2 className="secao-titulo">{cat.nome}</h2>
        <button className="btn-ver-todos" onClick={() => buscarCat(cat.nome)}>
          Ver todos
          <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2.5}>
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </button>
      </div>
      <div className="carrossel">
        {props.map((p, i) => (
          <PropertyCard key={p.id} prop={p} delay={i * 0.055} />
        ))}
      </div>
    </div>
  )
}
