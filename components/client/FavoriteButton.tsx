'use client'

interface Props {
  isFavorite: boolean
  onToggle: () => void
  loading?: boolean
  showLabel?: boolean
}

export default function FavoriteButton({ isFavorite, onToggle, loading = false, showLabel = true }: Props) {
  return (
    <button
      className={`cl-fav-btn${isFavorite ? ' active' : ''}`}
      onClick={onToggle}
      disabled={loading}
      aria-label={isFavorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
      title={isFavorite ? 'Remover dos favoritos' : 'Salvar'}
    >
      <svg
        width="15" height="15"
        fill={isFavorite ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth={2}
        viewBox="0 0 24 24"
      >
        <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
      </svg>
      {showLabel && <span>{isFavorite ? 'Salvo' : 'Salvar'}</span>}
    </button>
  )
}
