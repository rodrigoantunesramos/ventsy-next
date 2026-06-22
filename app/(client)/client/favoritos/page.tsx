'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import PropertyCard from '@/components/PropertyCard'
import { useFavorites } from '@/hooks/useFavorites'
import type { Favorite } from '@/types/client'
import { PageHeader, EmptyState, Skeleton, btnPrimary, Icon } from '../_ui'

export default function FavoritosPage() {
  const router = useRouter()
  const { toggle } = useFavorites()

  const [favoritos, setFavoritos] = useState<Favorite[]>([])
  const [loading,   setLoading]   = useState(true)

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }
      try {
        const res  = await fetch(`/api/favoritos?user_id=${session.user.id}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
        const json = await res.json()
        setFavoritos(json.data || [])
      } catch { /* mantém */ } finally {
        setLoading(false)
      }
    })()
  }, [router])

  const handleToggle = async (propertyId: string) => {
    await toggle(propertyId)
    setFavoritos(prev => prev.filter(f => f.property_id !== propertyId))
  }

  if (loading) return (
    <div className="space-y-6">
      <Skeleton className="h-12 w-48" />
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-64" />)}</div>
    </div>
  )

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Descobrir" title="Favoritos"
        subtitle={favoritos.length > 0
          ? `${favoritos.length} espaço${favoritos.length > 1 ? 's' : ''} salvo${favoritos.length > 1 ? 's' : ''}`
          : 'Os espaços que você curtiu ficam aqui.'} />

      {favoritos.length === 0 ? (
        <EmptyState icon="heart" title="Nenhum favorito ainda"
          text="Salve os espaços que você curtiu para encontrá-los facilmente depois."
          action={<Link href="/busca" className={btnPrimary}><Icon name="search" size={16} /> Explorar espaços</Link>} />
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {favoritos.map(fav => fav.propriedade && (
            <PropertyCard
              key={fav.id}
              property={fav.propriedade}
              isFavorite
              onToggleFavorite={() => handleToggle(fav.property_id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
