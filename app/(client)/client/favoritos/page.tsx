'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import PropertyCardClient from '@/components/client/PropertyCardClient'
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

  // Remover da lista localmente quando desfavoritar
  const handleToggle = async (propertyId: string) => {
    await toggle(propertyId)
    setFavoritos(prev => prev.filter(f => f.property_id !== propertyId))
  }

  if (loading) return null

  return (
    <div style={{ padding: '28px 24px', maxWidth: 980, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#111', margin: 0 }}>
          ❤️ Meus Favoritos
        </h1>
        <p style={{ fontSize: '.88rem', color: '#888', margin: '6px 0 0' }}>
          {favoritos.length > 0
            ? `${favoritos.length} espaço${favoritos.length > 1 ? 's' : ''} salvo${favoritos.length > 1 ? 's' : ''}`
            : 'Nenhum espaço salvo ainda'}
        </p>
      </div>

      {favoritos.length === 0 ? (
        <div className="cl-empty">
          <div className="cl-empty-icon">❤️</div>
          <div className="cl-empty-title">Nenhum favorito ainda</div>
          <div className="cl-empty-sub">
            Salve os espaços que você curtiu para encontrá-los facilmente depois.
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 20 }}>
          {favoritos.map(fav => fav.propriedade && (
            <PropertyCardClient
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
