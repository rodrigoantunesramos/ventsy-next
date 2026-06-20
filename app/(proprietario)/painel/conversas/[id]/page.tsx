'use client'

// Thread de mensagens do proprietário — /painel/conversas/[id].
// Reusa o mesmo ChatBox/useChat da área do cliente (componentes agnósticos de
// papel: recebem currentUserId). O envio insere em `mensagens` via RLS e o
// trigger no banco atualiza o resumo da conversa; o realtime entrega ao outro lado.

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase as sb } from '@/lib/supabase'
import ChatBox from '@/components/client/ChatBox'
import { useChat } from '@/hooks/useChat'
import type { Conversation } from '@/types/client'

export default function PainelConversaThread() {
  const params = useParams()
  const router = useRouter()
  const convId = params.id as string

  const [userId, setUserId] = useState('')
  const [conversa, setConversa] = useState<Conversation | null>(null)
  const [loading, setLoading] = useState(true)

  const { messages, loading: chatLoading, sending, sendMessage } = useChat(convId)

  useEffect(() => {
    (async () => {
      const { data: { session } } = await sb.auth.getSession()
      if (!session) { router.replace('/login'); return }
      setUserId(session.user.id)

      const res = await fetch(`/api/conversas/${convId}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const json = await res.json()
      if (json.error || !json.data?.conversa) { router.replace('/painel/conversas'); return }

      setConversa(json.data.conversa)
      setLoading(false)
    })()
  }, [convId, router])

  if (loading) {
    return (
      <div className="mx-auto max-w-[760px]">
        <div className="h-24 animate-pulse rounded-2xl bg-black/[0.05]" />
      </div>
    )
  }

  const titulo = conversa?.contraparte?.nome || conversa?.propriedade?.nome || 'Conversa'

  return (
    <div className="mx-auto flex h-[calc(100vh-140px)] max-w-[760px] flex-col">
      <div className="mb-4 flex items-center gap-3">
        <Link href="/painel/conversas" className="text-[1.2rem] text-ink-muted no-underline">←</Link>
        <div className="min-w-0">
          <div className="truncate text-base font-bold text-ink">{titulo}</div>
          {conversa?.propriedade?.nome && (
            <Link href={`/propriedade/${conversa.propriedade_id}`} className="text-[.75rem] text-brand no-underline">
              {conversa.propriedade.nome} →
            </Link>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1">
        <ChatBox
          messages={messages}
          currentUserId={userId}
          sending={sending}
          onSend={(text) => sendMessage(text, userId)}
          loading={chatLoading}
        />
      </div>
    </div>
  )
}
