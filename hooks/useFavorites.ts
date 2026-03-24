'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

// ─────────────────────────────────────────────────────────────────────────────
// useFavorites
// Se logado: persiste no Supabase (tabela favoritos)
// Se não logado: usa localStorage como fallback
// ─────────────────────────────────────────────────────────────────────────────
export function useFavorites() {
  const [favorites, setFavorites] = useState<string[]>([])
  const [userId, setUserId]       = useState<string | null>(null)
  const [loading, setLoading]     = useState(true)

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()

      if (session) {
        setUserId(session.user.id)
        const { data } = await supabase
          .from('favoritos')
          .select('property_id')
          .eq('user_id', session.user.id)
        setFavorites((data || []).map((f: { property_id: string }) => f.property_id))
      } else {
        const local: string[] = JSON.parse(localStorage.getItem('ventsy_favs') || '[]')
        setFavorites(local)
      }

      setLoading(false)
    }
    init()
  }, [])

  const toggle = useCallback(async (propertyId: string) => {
    const isFav = favorites.includes(propertyId)

    if (userId) {
      // Optimistic update
      setFavorites(prev =>
        isFav ? prev.filter(id => id !== propertyId) : [...prev, propertyId],
      )
      if (isFav) {
        await supabase.from('favoritos')
          .delete()
          .eq('user_id', userId)
          .eq('property_id', propertyId)
      } else {
        await supabase.from('favoritos')
          .insert({ user_id: userId, property_id: propertyId })
      }
    } else {
      const updated = isFav
        ? favorites.filter(id => id !== propertyId)
        : [...favorites, propertyId]
      setFavorites(updated)
      localStorage.setItem('ventsy_favs', JSON.stringify(updated))
    }
  }, [favorites, userId])

  const isFavorite = useCallback(
    (propertyId: string) => favorites.includes(propertyId),
    [favorites],
  )

  return { favorites, isFavorite, toggle, loading, isLoggedIn: !!userId, userId }
}
