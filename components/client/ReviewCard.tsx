'use client'

import Link from 'next/link'
import RatingStars from './RatingStars'
import type { ClientReview } from '@/types/client'

interface Props {
  review: ClientReview
  showProperty?: boolean
}

function formatDate(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
}

export default function ReviewCard({ review, showProperty = true }: Props) {
  return (
    <div className="cl-review-card">
      <div className="cl-review-header">
        <div>
          {showProperty && review.propriedade && (
            <Link
              href={`/propriedade/${review.propriedade_id}`}
              style={{ textDecoration: 'none' }}
            >
              <div className="cl-review-prop">{review.propriedade.nome}</div>
            </Link>
          )}
          <RatingStars value={review.nota} readonly size="sm" />
        </div>
        <span className="cl-review-date">{formatDate(review.criado_em)}</span>
      </div>

      {review.texto && <p className="cl-review-text">{review.texto}</p>}

      {review.evento_tipo && (
        <div className="cl-review-evento">🎉 {review.evento_tipo}</div>
      )}
    </div>
  )
}
