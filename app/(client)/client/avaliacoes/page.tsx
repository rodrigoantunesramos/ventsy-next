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
    <div className="px-6 py-7 max-w-[760px] mx-auto">
      <div className="mb-6">
        <h1 className="text-[1.5rem] font-extrabold text-gray-900 m-0">⭐ Minhas Avaliações</h1>
        <p className="text-[.88rem] text-gray-400 mt-1.5">
          {avaliacoes.length > 0
            ? `${avaliacoes.length} avaliação${avaliacoes.length > 1 ? 'ões' : ''} · Média ${media} ★`
            : 'Você ainda não avaliou nenhum espaço'}
        </p>
      </div>

      {avaliacoes.length === 0 ? (
        <div className="text-center py-16 px-5 text-gray-300">
          <div className="text-[3rem] mb-3">⭐</div>
          <div className="text-base font-semibold text-gray-400 mb-1.5">Nenhuma avaliação ainda</div>
          <div className="text-[.85rem]">
            Após realizar um evento em um espaço, compartilhe sua experiência avaliando o local na página da propriedade.
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {avaliacoes.map(av => (
            <ReviewCard key={av.id} review={av} showProperty />
          ))}
        </div>
      )}
    </div>
  )
}
