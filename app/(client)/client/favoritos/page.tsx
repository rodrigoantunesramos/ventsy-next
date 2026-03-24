'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import PropertyCard from '@/components/PropertyCard'
import { useFavorites } from '@/hooks/useFavorites'
import type { Favorite } from '@/types/client'

export default function FavoritosPage() {
  const router = useRouter()
  const { isFavorite, toggle } = useFavorites()

  const [favoritos, setFavoritos] = useState<Favorite[]>([])
  const [loading,   setLoading]   = useState(true)

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }

      const res  = await fetch(`/api/favoritos?user_id=${session.user.id}`)
      const json = await res.json()
      setFavoritos(json.data || [])
      setLoading(false)
    })()
  }, [router])

  const handleToggle = async (propertyId: string) => {
    await toggle(propertyId)
    setFavoritos(prev => prev.filter(f => f.property_id !== propertyId))
  }

  if (loading) return null

  return (
    <div className="px-6 py-7 max-w-[980px] mx-auto">
      <div className="mb-6">
        <h1 className="text-[1.5rem] font-extrabold text-gray-900 m-0">❤️ Meus Favoritos</h1>
        <p className="text-[.88rem] text-gray-400 mt-1.5">
          {favoritos.length > 0
            ? `${favoritos.length} espaço${favoritos.length > 1 ? 's' : ''} salvo${favoritos.length > 1 ? 's' : ''}`
            : 'Nenhum espaço salvo ainda'}
        </p>
      </div>

      {favoritos.length === 0 ? (
        <div className="text-center py-16 px-5 text-gray-300">
          <div className="text-[3rem] mb-3">❤️</div>
          <div className="text-base font-semibold text-gray-400 mb-1.5">Nenhum favorito ainda</div>
          <div className="text-[.85rem]">Salve os espaços que você curtiu para encontrá-los facilmente depois.</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {favoritos.map(fav => fav.propriedade && (
            <PropertyCard
              key={fav.id}
              property={fav.propriedade}
              isFavorite={isFavorite(fav.property_id)}
              onToggleFavorite={() => handleToggle(fav.property_id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
