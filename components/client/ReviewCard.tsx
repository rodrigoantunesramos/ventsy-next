'use client'

import Link from 'next/link'
import RatingStars from './RatingStars'
import type { ClientReview } from '@/types/client'

interface Props {
  review: ClientReview
  showProperty?: boolean
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
}

export default function ReviewCard({ review, showProperty = true }: Props) {
  return (
    <div className="bg-white rounded-[14px] shadow-[0_2px_12px_rgba(0,0,0,.05)] border border-[#f0f0f0] px-5 py-[18px]">
      <div className="flex items-center justify-between mb-2.5">
        <div>
          {showProperty && review.propriedade && (
            <Link href={`/propriedade/${review.propriedade_id}`} className="no-underline">
              <div className="text-[.88rem] font-bold text-gray-900">{review.propriedade.nome}</div>
            </Link>
          )}
          <RatingStars value={review.nota} readonly size="sm" />
        </div>
        <span className="text-[.75rem] text-gray-300">{formatDate(review.criado_em)}</span>
      </div>

      {review.texto && (
        <p className="text-[.88rem] text-gray-600 leading-[1.55] m-0">{review.texto}</p>
      )}

      {review.evento_tipo && (
        <div className="text-[.75rem] text-gray-400 mt-1.5">🎉 {review.evento_tipo}</div>
      )}
    </div>
  )
}
