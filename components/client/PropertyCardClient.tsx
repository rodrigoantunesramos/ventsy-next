'use client'

import Link from 'next/link'
import FavoriteButton from './FavoriteButton'
import type { PropertySummary } from '@/types/client'

interface Props {
  property: PropertySummary
  isFavorite?: boolean
  onToggleFavorite?: () => void
  showActions?: boolean
}

const FALLBACK = 'https://picsum.photos/seed/ventsy/800/500'

export default function PropertyCardClient({ property, isFavorite = false, onToggleFavorite, showActions = true }: Props) {
  const img = property.imagem_url || property.foto_capa || FALLBACK
  const preco = property.valor_hora > 0
    ? `R$ ${Number(property.valor_hora).toLocaleString('pt-BR')}/h`
    : property.valor_base > 0
      ? `R$ ${Number(property.valor_base).toLocaleString('pt-BR')}`
      : 'A consultar'

  return (
    <div className="bg-white rounded-[14px] shadow-[0_2px_12px_rgba(0,0,0,.05)] border border-[#f0f0f0] overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(0,0,0,.09)]">
      <Link href={`/propriedade/${property.id}`} className="no-underline">
        <img
          className="w-full h-[180px] object-cover block"
          src={img}
          alt={property.nome}
          onError={e => { (e.target as HTMLImageElement).src = FALLBACK }}
        />
        <div className="px-4 py-3.5">
          <div className="text-[.95rem] font-bold text-gray-900 truncate mb-1">{property.nome}</div>
          <div className="text-[.78rem] text-gray-400 mb-2">
            📍 {[property.cidade, property.estado].filter(Boolean).join(', ')}
          </div>
          {property.tipo_propriedade && (
            <div className="text-[.75rem] text-gray-300 mb-1.5">{property.tipo_propriedade}</div>
          )}
          <div className="flex items-center justify-between mt-2">
            <span className="text-[.82rem] text-gray-900 font-semibold">
              {property.avaliacao > 0 ? `★ ${parseFloat(String(property.avaliacao)).toFixed(1)}` : ''}
            </span>
            <span className="text-[.82rem] text-[#ff385c] font-bold">{preco}</span>
          </div>
        </div>
      </Link>

      {showActions && onToggleFavorite && (
        <div className="px-4 pb-3.5 flex gap-2">
          <FavoriteButton isFavorite={isFavorite} onToggle={onToggleFavorite} />
        </div>
      )}
    </div>
  )
}
