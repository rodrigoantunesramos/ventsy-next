'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
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

      try {
        const res  = await fetch(`/api/avaliacoes?user_id=${session.user.id}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
        const json = await res.json()
        setAvaliacoes(json.data || [])
      } catch { /* mantém */ } finally {
        setLoading(false)
      }
    })()
  }, [router])

  if (loading) return (
    <div className="px-6 py-7 max-w-[760px] mx-auto">
      <div className="mb-6 h-8 w-48 animate-pulse rounded bg-black/[0.05]" />
      <div className="flex flex-col gap-4">{[0, 1].map((i) => <div key={i} className="h-28 animate-pulse rounded-2xl bg-black/[0.05]" />)}</div>
    </div>
  )

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
          <div className="mx-auto max-w-md text-[.85rem]">
            Depois que seu evento acontecer, você pode avaliar o espaço e o evento direto em <strong>Meus Eventos</strong>.
          </div>
          <Link href="/client/eventos" className="mt-5 inline-block rounded-xl bg-[#ff385c] px-6 py-2.5 text-[.9rem] font-bold text-white no-underline transition-colors hover:bg-[#e0304f]">
            🎫 Ir para Meus Eventos
          </Link>
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
