'use client'
import { useState } from 'react'
import Link from 'next/link'
import FavoriteButton from './client/FavoriteButton'
import type { PropertySummary } from '@/types/client'

interface Props {
  property: PropertySummary
  variant?: 'compact' | 'grid' | 'default'
  delay?: number
  isFavorite?: boolean
  onToggleFavorite?: () => void
  showActions?: boolean
}

const StarIcon = () => (
  <svg viewBox="0 0 24 24" width={10} height={10} fill="#f59e0b">
    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
  </svg>
)

export default function PropertyCard({
  property,
  variant = 'default',
  delay = 0,
  isFavorite: isFavProp,
  onToggleFavorite,
  showActions = true,
}: Props) {
  const [localFav, setLocalFav] = useState(false)
  const controlled = onToggleFavorite !== undefined
  const fav = controlled ? (isFavProp ?? false) : localFav
  const toggleFav = controlled ? onToggleFavorite! : () => setLocalFav(f => !f)

  const isUltra = property._plano === 'ultra'
  const isPro   = property._plano === 'pro'
  const img     = property.imagem_url || property.foto_capa || `https://picsum.photos/seed/${property.id}/420/320`
  const nome    = property.nome || 'Sem nome'
  const cidade  = property.cidade || property.estado || ''
  const nota    = property._nota ?? (property.avaliacao > 0 ? String(property.avaliacao) : null)

  /* ── Compact: homepage carousel ─────────────────────────────────── */
  if (variant === 'compact') {
    const preco = property.preco ?? property.valor_base
    return (
      <div
        className={`flex-shrink-0 w-[188px] bg-white rounded-[14px] overflow-hidden cursor-pointer relative
          transition-all duration-200 hover:-translate-y-1.5 hover:shadow-[0_14px_32px_rgba(0,0,0,.11)]
          animate-[fadeUp_.35s_ease_both]
          ${isUltra ? 'card-ultra-border shadow-[0_4px_18px_rgba(240,192,64,.2)] w-[208px]' : 'border border-gray-200'}
          ${isPro && !isUltra ? 'border border-gray-300 shadow-sm' : ''}`}
        style={{ animationDelay: `${delay}s` }}
        onClick={() => { window.location.href = `/propriedade/${property.id}` }}
        title={nome}
      >
        {isUltra && (
          <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-[#f0c040] via-[#ff385c] to-[#f0c040] z-10" />
        )}
        {isUltra && (
          <div className="absolute top-4 -right-6 z-10 bg-gradient-to-br from-[#f0c040] to-[#d4a000] text-white text-[9px] font-black tracking-wider uppercase py-0.5 px-8 rotate-45 shadow-sm">
            Premium
          </div>
        )}

        <div className={`relative overflow-hidden ${isUltra ? 'h-[132px]' : 'h-[120px]'}`}>
          <img
            src={img} alt={nome} loading="lazy"
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            onError={e => { (e.target as HTMLImageElement).src = `https://picsum.photos/seed/err${property.id}/420/320` }}
          />
          {isUltra && (
            <span className="absolute bottom-2 left-2 bg-amber-400 text-white text-[9px] font-black uppercase tracking-wide px-2 py-0.5 rounded-full backdrop-blur-sm">
              ✦ Premium
            </span>
          )}
          {isPro && !isUltra && (
            <span className="absolute bottom-2 left-2 bg-[#0d0d0d]/80 text-white text-[9px] font-black uppercase tracking-wide px-2 py-0.5 rounded-full border border-white/20 backdrop-blur-sm">
              Pro
            </span>
          )}
          <button
            className={`absolute top-2 right-2 w-7 h-7 rounded-full bg-white/80 backdrop-blur-sm border-none flex items-center justify-center text-sm cursor-pointer transition-all hover:scale-110 hover:bg-white z-10 ${fav ? 'text-[#ff385c]' : 'text-gray-400'}`}
            onClick={e => { e.stopPropagation(); toggleFav() }}
          >
            {fav ? '❤' : '♡'}
          </button>
        </div>

        <div className="px-3 py-3">
          <div className="font-bold text-[#0d0d0d] text-[.86rem] truncate mb-0.5">{nome}</div>
          {cidade && <div className="text-gray-400 text-[.73rem] mb-2 truncate">{cidade}</div>}
          <div className="flex items-center justify-between">
            {preco != null ? (
              <span className="text-[.76rem] text-gray-600">
                A partir de <strong className="text-[#0d0d0d] font-bold">R$ {Number(preco).toLocaleString('pt-BR')}</strong>
              </span>
            ) : (
              <span className="text-[.76rem] text-gray-300">Sob consulta</span>
            )}
            {nota && (
              <span className="flex items-center gap-0.5 text-[.75rem] font-bold text-[#0d0d0d]">
                <StarIcon />
                {parseFloat(nota).toFixed(1)}
              </span>
            )}
          </div>
        </div>
      </div>
    )
  }

  /* ── Grid: search results ────────────────────────────────────────── */
  if (variant === 'grid') {
    const capacidade = property.capacidade ? `${property.capacidade} pessoas` : ''
    const categoria  = property.categoria || ''
    return (
      <div
        className={`bg-white rounded-2xl overflow-hidden cursor-pointer flex flex-col
          transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg
          ${isUltra ? 'card-ultra-border shadow-[0_4px_18px_rgba(240,192,64,.2)]' : 'border border-gray-200'}`}
        onClick={() => { window.location.href = `/propriedade/${property.id}` }}
      >
        {isUltra && (
          <div className="h-[3px] bg-gradient-to-r from-[#f0c040] via-[#ff385c] to-[#f0c040]" />
        )}

        <div className="relative h-48 overflow-hidden">
          <img
            src={img} alt={nome} loading="lazy"
            className="w-full h-full object-cover"
            onError={e => { (e.target as HTMLImageElement).src = `https://picsum.photos/seed/err${property.id}/400/300` }}
          />
          {isUltra ? (
            <span className="absolute bottom-2 left-2 bg-amber-400 text-white text-[9px] font-black uppercase tracking-wide px-2 py-0.5 rounded-full">
              ✦ Premium
            </span>
          ) : isPro ? (
            <span className="absolute bottom-2 left-2 bg-[#0d0d0d]/80 text-white text-[9px] font-black uppercase tracking-wide px-2 py-0.5 rounded-full border border-white/20">
              Pro
            </span>
          ) : categoria ? (
            <span className="absolute bottom-2 left-2 bg-black/50 text-white text-[9px] font-semibold px-2 py-0.5 rounded-full">
              {categoria}
            </span>
          ) : null}
          <button
            className="absolute top-2 right-2 w-8 h-8 rounded-full bg-white/80 backdrop-blur-sm flex items-center justify-center border-none cursor-pointer z-10"
            onClick={e => { e.stopPropagation(); toggleFav() }}
          >
            <span className={fav ? 'text-[#ff385c]' : 'text-white drop-shadow'}>{fav ? '❤' : '♡'}</span>
          </button>
        </div>

        <div className="p-3 flex flex-col gap-1.5 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold text-[#0d0d0d] text-sm leading-tight line-clamp-2 flex-1">{nome}</h3>
            {nota && (
              <span className="flex items-center gap-0.5 text-xs text-gray-600 flex-shrink-0">
                <StarIcon />
                {parseFloat(nota).toFixed(1)}
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-gray-500">
            {cidade && (
              <span className="flex items-center gap-1">
                <svg viewBox="0 0 24 24" width={12} height={12} fill="none" stroke="currentColor" strokeWidth={2}>
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
                  <circle cx="12" cy="9" r="2.5" />
                </svg>
                {cidade}
              </span>
            )}
            {capacidade && (
              <span className="flex items-center gap-1">
                <svg viewBox="0 0 24 24" width={12} height={12} fill="none" stroke="currentColor" strokeWidth={2}>
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
                {capacidade}
              </span>
            )}
          </div>
          <p className="text-sm mt-auto pt-2 border-t border-gray-100">
            {property.valor_hora > 0 ? (
              <><strong className="text-[#0d0d0d]">R$ {Number(property.valor_hora).toLocaleString('pt-BR')}</strong><span className="text-gray-400 text-xs"> / hora</span></>
            ) : property.valor_base > 0 ? (
              <strong className="text-[#0d0d0d]">R$ {Number(property.valor_base).toLocaleString('pt-BR')}</strong>
            ) : (
              <span className="text-gray-300 text-xs">Sob consulta</span>
            )}
          </p>
        </div>
      </div>
    )
  }

  /* ── Default: client area ────────────────────────────────────────── */
  const precoDisplay = property.valor_hora > 0
    ? `R$ ${Number(property.valor_hora).toLocaleString('pt-BR')}/h`
    : property.valor_base > 0
      ? `R$ ${Number(property.valor_base).toLocaleString('pt-BR')}`
      : 'A consultar'

  return (
    <div className="bg-white rounded-[14px] shadow-[0_2px_12px_rgba(0,0,0,.05)] border border-[#f0f0f0] overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(0,0,0,.09)]">
      <Link href={`/propriedade/${property.id}`} className="no-underline">
        <img
          className="w-full h-[180px] object-cover block"
          src={img} alt={nome}
          onError={e => { (e.target as HTMLImageElement).src = 'https://picsum.photos/seed/ventsy/800/500' }}
        />
        <div className="px-4 py-3.5">
          <div className="text-[.95rem] font-bold text-gray-900 truncate mb-1">{nome}</div>
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
            <span className="text-[.82rem] text-[#ff385c] font-bold">{precoDisplay}</span>
          </div>
        </div>
      </Link>

      {showActions && onToggleFavorite && (
        <div className="px-4 pb-3.5 flex gap-2">
          <FavoriteButton isFavorite={fav} onToggle={toggleFav} />
        </div>
      )}
    </div>
  )
}
