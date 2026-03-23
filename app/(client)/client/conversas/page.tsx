'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import type { Conversation } from '@/types/client'

function timeAgo(iso: string) {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const m    = Math.floor(diff / 60000)
  if (m < 1)  return 'agora'
  if (m < 60) return `${m}min atrás`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h atrás`
  return `${Math.floor(h / 24)}d atrás`
}

export default function ConversasPage() {
  const router = useRouter()

  const [conversas, setConversas] = useState<Conversation[]>([])
  const [loading,   setLoading]   = useState(true)

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }

      const res  = await fetch(`/api/conversas?user_id=${session.user.id}`)
      const json = await res.json()
      setConversas(json.data || [])
      setLoading(false)
    })()
  }, [router])

  if (loading) return null

  return (
    <div style={{ padding: '28px 24px', maxWidth: 760, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#111', margin: 0 }}>
          💬 Conversas
        </h1>
        <p style={{ fontSize: '.88rem', color: '#888', margin: '6px 0 0' }}>
          {conversas.length > 0
            ? `${conversas.length} conversa${conversas.length > 1 ? 's' : ''}`
            : 'Nenhuma conversa iniciada'}
        </p>
      </div>

      {conversas.length === 0 ? (
        <div className="cl-empty">
          <div className="cl-empty-icon">💬</div>
          <div className="cl-empty-title">Nenhuma conversa ainda</div>
          <div className="cl-empty-sub">
            Encontre um espaço que você goste e inicie uma conversa com o proprietário.
          </div>
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
      ) : (
        <div style={{
          background: '#fff', borderRadius: 14,
          boxShadow: '0 2px 12px rgba(0,0,0,.05)',
          border: '1px solid #f0f0f0', overflow: 'hidden',
        }}>
          {conversas.map(conv => (
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
              {conv.ultima_mensagem_em && (
                <span className="cl-conv-tempo">
                  {timeAgo(conv.ultima_mensagem_em)}
                </span>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
