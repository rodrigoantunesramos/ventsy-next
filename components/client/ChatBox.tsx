'use client'

import { useState, useRef, useEffect } from 'react'
import MessageBubble from './MessageBubble'
import type { Message } from '@/types/client'

interface Props {
  messages: Message[]
  currentUserId: string
  sending: boolean
  onSend: (text: string) => Promise<boolean>
  loading?: boolean
}

export default function ChatBox({ messages, currentUserId, sending, onSend, loading = false }: Props) {
  const [text, setText]   = useState('')
  const bottomRef         = useRef<HTMLDivElement>(null)

  // Auto-scroll para a última mensagem
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async () => {
    if (!text.trim() || sending) return
    const success = await onSend(text)
    if (success) setText('')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  if (loading) {
    return (
      <div className="cl-chatbox" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#bbb', fontSize: '.88rem' }}>Carregando mensagens...</div>
      </div>
    )
  }

  return (
    <div className="cl-chatbox">
      <div className="cl-chat-msgs">
        {messages.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#bbb', fontSize: '.85rem', margin: 'auto' }}>
            <div style={{ fontSize: '2rem', marginBottom: 8 }}>💬</div>
            Nenhuma mensagem ainda. Comece a conversa!
          </div>
        ) : (
          messages.map(msg => (
            <MessageBubble key={msg.id} message={msg} currentUserId={currentUserId} />
          ))
        )}
        <div ref={bottomRef} />
      </div>

      <div className="cl-chat-input-row">
        <input
          className="cl-chat-input"
          type="text"
          placeholder="Digite uma mensagem..."
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={sending}
        />
        <button
          className="cl-chat-send"
          onClick={handleSend}
          disabled={!text.trim() || sending}
        >
          {sending ? '...' : 'Enviar'}
        </button>
      </div>
    </div>
  )
}
