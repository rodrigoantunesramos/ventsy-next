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
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
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

      {review.resposta && (
        <div className="mt-3 rounded-xl border border-[#f0f0f0] bg-[#f7f7f8] px-3.5 py-2.5">
          <div className="mb-0.5 text-[.72rem] font-semibold text-gray-500">↩︎ Resposta do anfitrião</div>
          <p className="m-0 text-[.83rem] leading-[1.5] text-gray-600">{review.resposta}</p>
        </div>
      )}
    </div>
  )
}
