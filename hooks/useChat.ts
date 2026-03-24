'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import type { Message } from '@/types/client'

// ─────────────────────────────────────────────────────────────────────────────
// useChat
// Estrutura preparada para Supabase Realtime
// Inscreve-se em INSERT na tabela mensagens filtrado por conversation_id
// ─────────────────────────────────────────────────────────────────────────────
export function useChat(conversationId: string) {
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading]   = useState(true)
  const [sending, setSending]   = useState(false)
  const channelRef              = useRef<ReturnType<typeof supabase.channel> | null>(null)

  const loadMessages = useCallback(async () => {
    if (!conversationId) return
    setLoading(true)
    const { data } = await supabase
      .from('mensagens')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
    setMessages(data || [])
    setLoading(false)
  }, [conversationId])

  useEffect(() => {
    if (!conversationId) return

    loadMessages()

    // Realtime subscription
    const channel = supabase
      .channel(`chat:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'mensagens',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          setMessages(prev => {
            // Evitar duplicatas
            if (prev.some(m => m.id === (payload.new as Message).id)) return prev
            return [...prev, payload.new as Message]
          })
        },
      )
      .subscribe()

    channelRef.current = channel
    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current)
    }
  }, [conversationId, loadMessages])

  const sendMessage = useCallback(async (text: string, senderId: string): Promise<boolean> => {
    if (!text.trim() || !conversationId) return false
    setSending(true)
    try {
      const { data, error } = await supabase
        .from('mensagens')
        .insert({ conversation_id: conversationId, sender_id: senderId, text: text.trim() })
        .select()
        .single()

      if (!error && data) {
        setMessages(prev =>
          prev.some(m => m.id === data.id) ? prev : [...prev, data],
        )
        return true
      }
      return false
    } finally {
      setSending(false)
    }
  }, [conversationId])

  return { messages, loading, sending, sendMessage, reload: loadMessages }
}
