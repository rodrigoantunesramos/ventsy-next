'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  prop: any
  plano?: 'basico' | 'pro' | 'ultra'
  isUltra?: boolean // deprecated: use plano
}

export default function SearchResultCard({ prop, plano = 'basico', isUltra }: Props) {
  const isUltraPlan = plano === 'ultra' || isUltra
  const isProPlan   = plano === 'pro'
  const router      = useRouter()
  const [fav, setFav] = useState(false)

  const imagem     = prop.imagem_url || prop.foto_capa || `https://picsum.photos/seed/${prop.id}/400/300`
  const nome       = prop.nome || 'Sem nome'
  const nota       = prop.avaliacao ? Number(prop.avaliacao).toFixed(1) : null
  const cidade     = prop.cidade || prop.estado || ''
  const capacidade = prop.capacidade ? `${prop.capacidade} pessoas` : ''
  const categoria  = prop.categoria || ''
  const preco      = prop.valor_hora != null
    ? `R$ ${Number(prop.valor_hora).toLocaleString('pt-BR')}`
    : prop.valor_base != null
    ? `R$ ${Number(prop.valor_base).toLocaleString('pt-BR')}`
    : null

  return (
    <div
      className={`bg-white rounded-2xl overflow-hidden cursor-pointer flex flex-col
        transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg
        ${isUltraPlan ? 'card-ultra-border shadow-[0_4px_18px_rgba(240,192,64,.2)]' : 'border border-gray-200'}`}
      onClick={() => router.push(`/propriedade/${prop.id}`)}
    >
      {/* Faixa topo ultra */}
      {isUltraPlan && (
        <div className="h-[3px] bg-gradient-to-r from-[#f0c040] via-[#ff385c] to-[#f0c040]" />
      )}

      {/* Foto */}
      <div className="relative h-48 overflow-hidden">
        <img
          src={imagem}
          alt={nome}
          className="w-full h-full object-cover"
          loading="lazy"
          onError={e => { (e.target as HTMLImageElement).src = `https://picsum.photos/seed/err${prop.id}/400/300` }}
        />

        {isUltraPlan ? (
          <span className="absolute bottom-2 left-2 bg-amber-400 text-white text-[9px] font-black uppercase tracking-wide px-2 py-0.5 rounded-full">
            ✦ Premium
          </span>
        ) : isProPlan ? (
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
          onClick={e => { e.stopPropagation(); setFav(!fav) }}
        >
          <span className={fav ? 'text-[#ff385c]' : 'text-white drop-shadow'}>{fav ? '❤' : '♡'}</span>
        </button>
      </div>

      {/* Informações */}
      <div className="p-3 flex flex-col gap-1.5 flex-1">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-[#0d0d0d] text-sm leading-tight line-clamp-2 flex-1">{nome}</h3>
          {nota && (
            <span className="flex items-center gap-0.5 text-xs text-gray-600 flex-shrink-0">
              <svg viewBox="0 0 24 24" width={10} height={10} fill="#f59e0b">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
              {nota}
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
          {preco ? (
            <><strong className="text-[#0d0d0d]">{preco}</strong><span className="text-gray-400 text-xs"> / hora</span></>
          ) : (
            <span className="text-gray-300 text-xs">Sob consulta</span>
          )}
        </p>
      </div>
    </div>
  )
}
