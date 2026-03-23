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
    <div className="cl-prop-card">
      <Link href={`/propriedade/${property.id}`} style={{ textDecoration: 'none' }}>
        <img
          className="cl-prop-img"
          src={img}
          alt={property.nome}
          onError={e => { (e.target as HTMLImageElement).src = FALLBACK }}
        />
        <div className="cl-prop-body">
          <div className="cl-prop-nome">{property.nome}</div>
          <div className="cl-prop-loc">
            📍 {[property.cidade, property.estado].filter(Boolean).join(', ')}
          </div>
          {property.tipo_propriedade && (
            <div style={{ fontSize: '.75rem', color: '#aaa', marginBottom: 6 }}>
              {property.tipo_propriedade}
            </div>
          )}
          <div className="cl-prop-footer">
            <span className="cl-prop-nota">
              {property.avaliacao > 0 ? `★ ${parseFloat(String(property.avaliacao)).toFixed(1)}` : ''}
            </span>
            <span className="cl-prop-preco">{preco}</span>
          </div>
        </div>
      </Link>

      {showActions && onToggleFavorite && (
        <div style={{ padding: '0 16px 14px', display: 'flex', gap: 8 }}>
          <FavoriteButton isFavorite={isFavorite} onToggle={onToggleFavorite} />
        </div>
      )}
    </div>
  )
}
