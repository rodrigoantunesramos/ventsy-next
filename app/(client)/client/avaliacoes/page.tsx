'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import ReviewCard from '@/components/client/ReviewCard'
import type { ClientReview } from '@/types/client'

export default function AvaliacoesPage() {
  const router = useRouter()

  const [avaliacoes, setAvaliacoes] = useState<ClientReview[]>([])
  const [loading,    setLoading]    = useState(true)

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }

      const res  = await fetch(`/api/avaliacoes?user_id=${session.user.id}`)
      const json = await res.json()
      setAvaliacoes(json.data || [])
      setLoading(false)
    })()
  }, [router])

  if (loading) return null

  const media = avaliacoes.length
    ? (avaliacoes.reduce((s, a) => s + a.nota, 0) / avaliacoes.length).toFixed(1)
    : null

  return (
    <div style={{ padding: '28px 24px', maxWidth: 760, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#111', margin: 0 }}>
          ⭐ Minhas Avaliações
        </h1>
        <p style={{ fontSize: '.88rem', color: '#888', margin: '6px 0 0' }}>
          {avaliacoes.length > 0
            ? `${avaliacoes.length} avaliação${avaliacoes.length > 1 ? 'ões' : ''} · Média ${media} ★`
            : 'Você ainda não avaliou nenhum espaço'}
        </p>
      </div>

      {avaliacoes.length === 0 ? (
        <div className="cl-empty">
          <div className="cl-empty-icon">⭐</div>
          <div className="cl-empty-title">Nenhuma avaliação ainda</div>
          <div className="cl-empty-sub">
            Após realizar um evento em um espaço, compartilhe sua experiência avaliando o local na página da propriedade.
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {avaliacoes.map(av => (
            <ReviewCard key={av.id} review={av} showProperty />
          ))}
        </div>
      )}
    </div>
  )
}
