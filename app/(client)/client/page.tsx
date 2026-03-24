'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import PropertyCard from '@/components/PropertyCard'
import { useFavorites } from '@/hooks/useFavorites'
import type { Favorite, ClientReview, Conversation } from '@/types/client'

export default function ClientDashboard() {
  const router = useRouter()
  const { isFavorite, toggle } = useFavorites()

  const [userId,    setUserId]    = useState('')
  const [favoritos, setFavoritos] = useState<Favorite[]>([])
  const [avaliacoes,setAvaliacoes]= useState<ClientReview[]>([])
  const [conversas, setConversas] = useState<Conversation[]>([])
  const [loading,   setLoading]   = useState(true)

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }

      const uid = session.user.id
      setUserId(uid)

      const [favRes, avalRes, convRes] = await Promise.all([
        fetch(`/api/favoritos?user_id=${uid}`).then(r => r.json()),
        fetch(`/api/avaliacoes?user_id=${uid}`).then(r => r.json()),
        fetch(`/api/conversas?user_id=${uid}`).then(r => r.json()),
      ])

      setFavoritos(favRes.data || [])
      setAvaliacoes(avalRes.data || [])
      setConversas(convRes.data || [])
      setLoading(false)
    })()
  }, [router])

  if (loading) return null

  const stats = [
    { icon: '❤️', label: 'Favoritos',  value: favoritos.length,  href: '/client/favoritos',  bg: '#fff5f6', color: '#ff385c' },
    { icon: '💬', label: 'Conversas',  value: conversas.length,  href: '/client/conversas',  bg: '#f0f9ff', color: '#3b82f6' },
    { icon: '⭐', label: 'Avaliações', value: avaliacoes.length, href: '/client/avaliacoes', bg: '#fffbeb', color: '#d97706' },
  ]

  return (
    <div className="px-6 py-7 max-w-[980px] mx-auto">

      {/* Cabeçalho */}
      <div className="mb-7">
        <h1 className="text-[1.5rem] font-extrabold text-gray-900 m-0">Bem-vindo à sua área 🎉</h1>
        <p className="text-[.88rem] text-gray-400 mt-1.5">
          Gerencie seus favoritos, conversas e avaliações de espaços para eventos.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {stats.map(s => (
          <Link key={s.label} href={s.href} className="no-underline">
            <div className="bg-white rounded-[14px] shadow-[0_2px_12px_rgba(0,0,0,.05)] border border-[#f0f0f0] px-6 py-5 flex items-center gap-4 cursor-pointer hover:-translate-y-0.5 transition-transform">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center text-[1.4rem] flex-shrink-0" style={{ background: s.bg }}>
                {s.icon}
              </div>
              <div>
                <div className="text-[.78rem] text-gray-400 mb-0.5">{s.label}</div>
                <div className="text-[1.6rem] font-extrabold leading-none" style={{ color: s.color }}>{s.value}</div>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Favoritos recentes */}
      {favoritos.length > 0 && (
        <section className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="m-0 text-[1.05rem] font-bold text-gray-900">❤️ Favoritos recentes</h2>
            <Link href="/client/favoritos" className="text-[.82rem] text-[#ff385c] no-underline">Ver todos →</Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {favoritos.slice(0, 4).map(fav => fav.propriedade && (
              <PropertyCard
                key={fav.id}
                property={fav.propriedade}
                isFavorite={isFavorite(fav.property_id)}
                onToggleFavorite={() => toggle(fav.property_id)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Últimas conversas */}
      {conversas.length > 0 && (
        <section className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="m-0 text-[1.05rem] font-bold text-gray-900">💬 Últimas conversas</h2>
            <Link href="/client/conversas" className="text-[.82rem] text-[#ff385c] no-underline">Ver todas →</Link>
          </div>
          <div className="bg-white rounded-[14px] shadow-[0_2px_12px_rgba(0,0,0,.05)] border border-[#f0f0f0] overflow-hidden">
            {conversas.slice(0, 3).map(conv => (
              <Link
                key={conv.id}
                href={`/client/conversas/${conv.id}`}
                className="flex items-center gap-3.5 px-5 py-3.5 border-b border-[#f5f5f5] last:border-0 no-underline text-inherit hover:bg-gray-50 transition-colors"
              >
                <div className="w-11 h-11 rounded-full bg-[#ff385c] text-white flex items-center justify-center font-bold text-base flex-shrink-0">
                  {conv.propriedade?.nome?.[0] ?? '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-[.9rem] text-gray-900">{conv.propriedade?.nome ?? 'Espaço'}</div>
                  <div className="text-[.8rem] text-gray-400 mt-0.5 truncate">{conv.ultima_mensagem ?? 'Nenhuma mensagem ainda'}</div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Avaliações recentes */}
      {avaliacoes.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="m-0 text-[1.05rem] font-bold text-gray-900">⭐ Minhas avaliações</h2>
            <Link href="/client/avaliacoes" className="text-[.82rem] text-[#ff385c] no-underline">Ver todas →</Link>
          </div>
          <div className="flex flex-col gap-3">
            {avaliacoes.slice(0, 2).map(av => (
              <div key={av.id} className="bg-white rounded-[14px] shadow-[0_2px_12px_rgba(0,0,0,.05)] border border-[#f0f0f0] px-5 py-4">
                <div className="font-bold text-[.9rem] mb-1">{av.propriedade?.nome ?? 'Espaço'}</div>
                <div className="text-amber-400 text-[.88rem] mb-1.5">
                  {'★'.repeat(av.nota)}{'☆'.repeat(5 - av.nota)}
                </div>
                {av.texto && <p className="m-0 text-[.85rem] text-gray-600">{av.texto}</p>}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Empty state */}
      {favoritos.length === 0 && conversas.length === 0 && avaliacoes.length === 0 && (
        <div className="text-center py-16 px-5 text-gray-300">
          <div className="text-[3rem] mb-3">🗺️</div>
          <div className="text-base font-semibold text-gray-400 mb-1.5">Comece a explorar!</div>
          <div className="text-[.85rem]">
            Favorite espaços, entre em contato com proprietários e avalie os locais onde realizou seus eventos.
          </div>
          <Link
            href="/busca"
            className="inline-block mt-5 bg-[#ff385c] hover:bg-[#e0304f] text-white rounded-xl py-2.5 px-6 text-[.9rem] font-bold no-underline transition-colors"
          >
            🔍 Explorar espaços
          </Link>
        </div>
      )}
    </div>
  )
}
