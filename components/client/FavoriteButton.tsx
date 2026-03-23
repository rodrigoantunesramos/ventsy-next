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
      onClick={onToggle}
      disabled={loading}
      aria-label={isFavorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
      title={isFavorite ? 'Remover dos favoritos' : 'Salvar'}
      className={`flex items-center gap-1.5 px-3.5 py-2 border-[1.5px] rounded-full cursor-pointer text-[.82rem] font-medium transition-all disabled:opacity-50
        ${isFavorite
          ? 'bg-[#fff5f6] border-[#ff385c] text-[#ff385c]'
          : 'bg-white border-gray-200 text-gray-600 hover:border-[#ff385c] hover:text-[#ff385c]'
        }`}
    >
      <svg
        width="15" height="15"
        fill={isFavorite ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth={2}
        viewBox="0 0 24 24"
      >
        <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
      </svg>
      {showLabel && <span>{isFavorite ? 'Salvo' : 'Salvar'}</span>}
    </button>
  )
}
