'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import PropertyCardClient from '@/components/client/PropertyCardClient'
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
    { icon: '❤️', label: 'Favoritos', value: favoritos.length, href: '/client/favoritos', bg: '#fff5f6', color: '#ff385c' },
    { icon: '💬', label: 'Conversas', value: conversas.length, href: '/client/conversas',  bg: '#f0f9ff', color: '#3b82f6' },
    { icon: '⭐', label: 'Avaliações', value: avaliacoes.length, href: '/client/avaliacoes', bg: '#fffbeb', color: '#d97706' },
  ]

  return (
    <div style={{ padding: '28px 24px', maxWidth: 980, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#111', margin: 0 }}>
          Bem-vindo à sua área 🎉
        </h1>
        <p style={{ fontSize: '.88rem', color: '#888', margin: '6px 0 0' }}>
          Gerencie seus favoritos, conversas e avaliações de espaços para eventos.
        </p>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 32 }}>
        {stats.map(s => (
          <Link key={s.label} href={s.href} style={{ textDecoration: 'none' }}>
            <div className="cl-stat-card" style={{ cursor: 'pointer' }}>
              <div className="cl-stat-icon" style={{ background: s.bg }}>
                {s.icon}
              </div>
              <div>
                <div className="cl-stat-label">{s.label}</div>
                <div className="cl-stat-value" style={{ color: s.color }}>{s.value}</div>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Favoritos recentes */}
      {favoritos.length > 0 && (
        <section style={{ marginBottom: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#111' }}>
              ❤️ Favoritos recentes
            </h2>
            <Link href="/client/favoritos" style={{ fontSize: '.82rem', color: '#ff385c', textDecoration: 'none' }}>
              Ver todos →
            </Link>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
            {favoritos.slice(0, 4).map(fav => fav.propriedade && (
              <PropertyCardClient
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
        <section style={{ marginBottom: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#111' }}>
              💬 Últimas conversas
            </h2>
            <Link href="/client/conversas" style={{ fontSize: '.82rem', color: '#ff385c', textDecoration: 'none' }}>
              Ver todas →
            </Link>
          </div>
          <div style={{
            background: '#fff', borderRadius: 14,
            boxShadow: '0 2px 12px rgba(0,0,0,.05)',
            border: '1px solid #f0f0f0', overflow: 'hidden',
          }}>
            {conversas.slice(0, 3).map(conv => (
              <Link
                key={conv.id}
                href={`/client/conversas/${conv.id}`}
                className="cl-conv-item"
              >
                <div className="cl-conv-avatar">
                  {conv.propriedade?.nome?.[0] ?? '?'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="cl-conv-nome">
                    {conv.propriedade?.nome ?? 'Espaço'}
                  </div>
                  <div className="cl-conv-preview">
                    {conv.ultima_mensagem ?? 'Nenhuma mensagem ainda'}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Avaliações recentes */}
      {avaliacoes.length > 0 && (
        <section>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#111' }}>
              ⭐ Minhas avaliações
            </h2>
            <Link href="/client/avaliacoes" style={{ fontSize: '.82rem', color: '#ff385c', textDecoration: 'none' }}>
              Ver todas →
            </Link>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {avaliacoes.slice(0, 2).map(av => (
              <div key={av.id} style={{
                background: '#fff', borderRadius: 14,
                boxShadow: '0 2px 12px rgba(0,0,0,.05)',
                border: '1px solid #f0f0f0',
                padding: '16px 20px',
              }}>
                <div style={{ fontWeight: 700, fontSize: '.9rem', marginBottom: 4 }}>
                  {av.propriedade?.nome ?? 'Espaço'}
                </div>
                <div style={{ color: '#f59e0b', fontSize: '.88rem', marginBottom: 6 }}>
                  {'★'.repeat(av.nota)}{'☆'.repeat(5 - av.nota)}
                </div>
                {av.texto && <p style={{ margin: 0, fontSize: '.85rem', color: '#555' }}>{av.texto}</p>}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Empty state geral */}
      {favoritos.length === 0 && conversas.length === 0 && avaliacoes.length === 0 && (
        <div className="cl-empty">
          <div className="cl-empty-icon">🗺️</div>
          <div className="cl-empty-title">Comece a explorar!</div>
          <div className="cl-empty-sub">Favorite espaços, entre em contato com proprietários e avalie os locais onde realizou seus eventos.</div>
          <Link
            href="/busca"
            style={{
              display: 'inline-block', marginTop: 20,
              background: '#ff385c', color: '#fff',
              borderRadius: 12, padding: '10px 24px',
              fontSize: '.9rem', fontWeight: 700, textDecoration: 'none',
            }}
          >
            🔍 Explorar espaços
          </Link>
        </div>
      )}
    </div>
  )
}
