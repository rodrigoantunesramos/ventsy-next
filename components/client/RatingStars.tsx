'use client'

interface Props {
  value: number
  onChange?: (v: number) => void
  readonly?: boolean
  size?: 'sm' | 'md' | 'lg'
}

const SIZES = { sm: '1rem', md: '1.4rem', lg: '1.8rem' }

export default function RatingStars({ value, onChange, readonly = false, size = 'md' }: Props) {
  return (
    <div
      className="flex gap-1"
      style={{ fontSize: SIZES[size] }}
      aria-label={`Avaliação: ${value} de 5 estrelas`}
    >
      {[1, 2, 3, 4, 5].map(star => (
        <button
          key={star}
          type="button"
          onClick={() => !readonly && onChange?.(star)}
          className={`bg-transparent border-none p-0 leading-none transition-transform
            ${readonly ? 'cursor-default' : 'cursor-pointer hover:scale-115'}`}
          style={{ color: star <= value ? '#f59e0b' : '#ddd', fontSize: SIZES[size] }}
          aria-label={`${star} estrela${star > 1 ? 's' : ''}`}
        >
          ★
        </button>
      ))}
    </div>
  )
}
