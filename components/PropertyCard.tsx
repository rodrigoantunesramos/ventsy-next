'use client'
import { useState } from 'react'

interface Props {
  prop: any
  delay?: number
}

export default function PropertyCard({ prop, delay = 0 }: Props) {
  const [fav, setFav] = useState(false)
  const plano = prop._plano
  const isUltra = plano === 'ultra'
  const isPro = plano === 'pro'
  const img = prop.imagem_url || prop.foto_capa || `https://picsum.photos/seed/${prop.id}/420/320`
  const nome = prop.nome || 'Sem nome'
  const cid = prop.cidade ? `📍 ${prop.cidade}` : (prop.estado || '')
  const preco = prop.preco ?? prop.valor_base
  const nota = prop._nota
  const id = prop.id || ''

  const cls = `card${isUltra ? ' card-ultra' : isPro ? ' card-pro' : ''}`

  return (
    <div
      className={cls}
      style={{ animationDelay: `${delay}s` }}
      onClick={() => window.location.href = `/propriedade/${id}`}
      title={nome}
    >
      {isUltra && <div className="ribbon">Premium</div>}

      <div className="card-foto">
        <img
          src={img}
          alt={nome}
          loading="lazy"
          onError={(e) => { (e.target as HTMLImageElement).src = `https://picsum.photos/seed/err${id}/420/320` }}
        />
        {isUltra && <div className="card-badge badge-ultra">✦ Premium</div>}
        {isPro && !isUltra && <div className="card-badge badge-pro">Pro</div>}
        <button
          className={`card-fav${fav ? ' fav-on' : ''}`}
          onClick={(e) => { e.stopPropagation(); setFav(!fav) }}
        >
          {fav ? '❤' : '♡'}
        </button>
      </div>

      <div className="card-body">
        <div className="card-nome">{nome}</div>
        {cid && <div className="card-cidade">{cid}</div>}
        <div className="card-footer">
          {preco != null
            ? <span className="card-preco">A partir de <strong>R$ {Number(preco).toLocaleString('pt-BR')}</strong></span>
            : <span className="card-preco" style={{ color: '#ccc' }}>Sob consulta</span>
          }
          {nota ? (
            <span className="card-nota">
              <svg viewBox="0 0 24 24" width={10} height={10} fill="var(--ouro)">
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
