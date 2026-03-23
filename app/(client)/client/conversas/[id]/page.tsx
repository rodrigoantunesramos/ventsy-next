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

  if (loading) return null

  return (
    <div
      className="px-6 py-7 max-w-[760px] mx-auto flex flex-col"
      style={{ height: 'calc(100vh - 116px)' }}
    >
      {/* Header */}
      <div className="mb-4 flex items-center gap-3.5">
        <Link href="/client/conversas" className="text-gray-400 no-underline text-[1.2rem]">←</Link>
        <div>
          <div className="font-bold text-base text-gray-900">{conversa?.propriedade?.nome ?? 'Conversa'}</div>
          {conversa?.propriedade && (
            <Link href={`/propriedade/${conversa.propriedade_id}`} className="text-[.75rem] text-[#ff385c] no-underline">
              Ver espaço →
            </Link>
          )}
        </div>
      </div>

      {/* Chat */}
      <div className="flex-1 min-h-0">
        <ChatBox
          messages={messages}
          currentUserId={userId}
          sending={sending}
          onSend={text => sendMessage(text, userId)}
          loading={chatLoading}
        />
      </div>
    </div>
  )
}
