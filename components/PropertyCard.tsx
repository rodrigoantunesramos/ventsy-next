'use client'
import { useState } from 'react'

interface Props {
  prop: any
  delay?: number
}

export default function PropertyCard({ prop, delay = 0 }: Props) {
  const [fav, setFav] = useState(false)

  const plano    = prop._plano
  const isUltra  = plano === 'ultra'
  const isPro    = plano === 'pro'
  const img      = prop.imagem_url || prop.foto_capa || `https://picsum.photos/seed/${prop.id}/420/320`
  const nome     = prop.nome || 'Sem nome'
  const cidade   = prop.cidade ? `📍 ${prop.cidade}` : (prop.estado || '')
  const preco    = prop.preco ?? prop.valor_base
  const nota     = prop._nota
  const id       = prop.id || ''

  return (
    <div
      className={`flex-shrink-0 w-[188px] bg-white rounded-[14px] overflow-hidden cursor-pointer relative
        transition-all duration-200 hover:-translate-y-1.5 hover:shadow-[0_14px_32px_rgba(0,0,0,.11)]
        animate-[fadeUp_.35s_ease_both]
        ${isUltra ? 'card-ultra-border shadow-[0_4px_18px_rgba(240,192,64,.2)] w-[208px]' : 'border border-gray-200'}
        ${isPro && !isUltra ? 'border border-gray-300 shadow-sm' : ''}`}
      style={{ animationDelay: `${delay}s` }}
      onClick={() => { window.location.href = `/propriedade/${id}` }}
      title={nome}
    >
      {/* Faixa topo ultra */}
      {isUltra && (
        <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-[#f0c040] via-[#ff385c] to-[#f0c040] z-10" />
      )}

      {/* Ribbon "Premium" */}
      {isUltra && (
        <div className="absolute top-4 -right-6 z-10 bg-gradient-to-br from-[#f0c040] to-[#d4a000] text-white text-[9px] font-black tracking-wider uppercase py-0.5 px-8 rotate-45 shadow-sm">
          Premium
        </div>
      )}

      {/* Foto */}
      <div className={`relative overflow-hidden ${isUltra ? 'h-[132px]' : 'h-[120px]'}`}>
        <img
          src={img}
          alt={nome}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          loading="lazy"
          onError={e => { (e.target as HTMLImageElement).src = `https://picsum.photos/seed/err${id}/420/320` }}
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
          onClick={e => { e.stopPropagation(); setFav(!fav) }}
        >
          {fav ? '❤' : '♡'}
        </button>
      </div>

      {/* Corpo */}
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
          {nota ? (
            <span className="flex items-center gap-0.5 text-[.75rem] font-bold text-[#0d0d0d]">
              <svg viewBox="0 0 24 24" width={10} height={10} fill="#f59e0b">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
              {parseFloat(nota).toFixed(1)}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  )
}
