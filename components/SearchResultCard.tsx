'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  prop: any
  isUltra?: boolean
}

export default function SearchResultCard({ prop, isUltra = false }: Props) {
  const router = useRouter()
  const [fav, setFav] = useState(false)

  const imagem = prop.imagem_url || prop.foto_capa || `https://picsum.photos/seed/${prop.id}/400/300`
  const nome   = prop.nome || 'Sem nome'
  const preco  = prop.valor_hora != null
    ? `R$ ${Number(prop.valor_hora).toLocaleString('pt-BR')}`
    : prop.valor_base != null
    ? `R$ ${Number(prop.valor_base).toLocaleString('pt-BR')}`
    : null
  const nota       = prop.avaliacao ? Number(prop.avaliacao).toFixed(1) : null
  const cidade     = prop.cidade || prop.estado || ''
  const capacidade = prop.capacidade ? `${prop.capacidade} pessoas` : ''
  const categoria  = prop.categoria || ''

  return (
    <div
      className={`card-espaco-vertical${isUltra ? ' card-ultra' : ''}`}
      onClick={() => router.push(`/propriedade?id=${prop.id}`)}
    >
      <div className="foto-card-v">
        <img src={imagem} alt={nome} loading="lazy"
          onError={e => { (e.target as HTMLImageElement).src = `https://picsum.photos/seed/err${prop.id}/400/300` }} />

        {isUltra
          ? <span className="card-badge card-badge-ultra">⭐ Ultra</span>
          : categoria ? <span className="card-badge">{categoria}</span> : null}

        <button className="card-fav" onClick={e => { e.stopPropagation(); setFav(!fav) }}>
          <span style={{ color: fav ? 'var(--vermelho)' : 'white', textShadow: fav ? 'none' : '0 0 4px rgba(0,0,0,.5)' }}>
            {fav ? '❤' : '♡'}
          </span>
        </button>
      </div>

      <div className="info-card-v">
        <div className="card-linha-topo">
          <h3 className="card-nome">{nome}</h3>
          {nota && (
            <span className="card-nota">
              <svg viewBox="0 0 24 24">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
              {nota}
            </span>
          )}
        </div>

        <div className="card-meta">
          {cidade && (
            <span className="card-meta-item">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
                <circle cx="12" cy="9" r="2.5" />
              </svg>
              {cidade}
            </span>
          )}
          {capacidade && (
            <span className="card-meta-item">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
              {capacidade}
            </span>
          )}
        </div>

        <p className="card-preco">
          {preco ? <><strong>{preco}</strong> / hora</> : <span style={{ color: '#bbb' }}>Sob consulta</span>}
        </p>
      </div>
    </div>
  )
}
