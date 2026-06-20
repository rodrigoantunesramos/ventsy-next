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
        const uid = session.user.id
        setUserId(uid)

        // Migra favoritos salvos deslogado (localStorage) para a conta — uma vez.
        let locais: string[] = []
        try { locais = JSON.parse(localStorage.getItem('ventsy_favs') || '[]') } catch { locais = [] }
        if (locais.length) {
          const { data: existentes } = await supabase.from('favoritos').select('property_id').eq('user_id', uid)
          const jaTem = new Set((existentes || []).map((f) => String(f.property_id)))
          const novos = locais.filter((id) => id && !jaTem.has(String(id)))
          let migrou = true
          if (novos.length) {
            const { error: insErr } = await supabase.from('favoritos').insert(novos.map((id) => ({ user_id: uid, property_id: Number(id) })))
            migrou = !insErr
          }
          // Só limpa o localStorage se a migração deu certo (senão tenta de novo depois).
          if (migrou) localStorage.removeItem('ventsy_favs')
        }

        const { data } = await supabase
          .from('favoritos')
          .select('property_id')
          .eq('user_id', uid)
        setFavorites((data || []).map((f) => String(f.property_id)))
      } else {
        let local: string[] = []
        try { local = JSON.parse(localStorage.getItem('ventsy_favs') || '[]') } catch { local = [] }
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
          .eq('property_id', Number(propertyId))
      } else {
        await supabase.from('favoritos')
          .insert({ user_id: userId, property_id: Number(propertyId) })
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
