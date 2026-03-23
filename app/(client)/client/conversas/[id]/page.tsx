'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import ChatBox from '@/components/client/ChatBox'
import { useChat } from '@/hooks/useChat'
import type { Conversation } from '@/types/client'

export default function ConversaPage() {
  const params = useParams()
  const router = useRouter()
  const convId = params.id as string

  const [userId,   setUserId]   = useState('')
  const [conversa, setConversa] = useState<Conversation | null>(null)
  const [loading,  setLoading]  = useState(true)

  const { messages, loading: chatLoading, sending, sendMessage } = useChat(convId)

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }

      setUserId(session.user.id)

      const res  = await fetch(`/api/conversas/${convId}`)
      const json = await res.json()

      if (json.error || !json.data?.conversa) {
        router.push('/client/conversas')
        return
      }

      setConversa(json.data.conversa)
      setLoading(false)
    })()
  }, [convId, router])

  const handleSend = async (text: string) => {
    return sendMessage(text, userId)
  }

  if (loading) return null

  return (
    <div style={{ padding: '28px 24px', maxWidth: 760, margin: '0 auto', height: 'calc(100vh - 116px)', display: 'flex', flexDirection: 'column' }}>

      {/* Header da conversa */}
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 14 }}>
        <Link href="/client/conversas" style={{ color: '#888', textDecoration: 'none', fontSize: '1.2rem' }}>
          ←
        </Link>
        <div>
          <div style={{ fontWeight: 700, fontSize: '1rem', color: '#111' }}>
            {conversa?.propriedade?.nome ?? 'Conversa'}
          </div>
          {conversa?.propriedade && (
            <Link
              href={`/propriedade/${conversa.propriedade_id}`}
              style={{ fontSize: '.75rem', color: '#ff385c', textDecoration: 'none' }}
            >
              Ver espaço →
            </Link>
          )}
        </div>
      </div>

      {/* Chat */}
      <div style={{ flex: 1, minHeight: 0 }}>
        <ChatBox
          messages={messages}
          currentUserId={userId}
          sending={sending}
          onSend={handleSend}
          loading={chatLoading}
        />
      </div>
    </div>
  )
}
