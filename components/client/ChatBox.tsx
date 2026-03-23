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
  const [text, setText] = useState('')
  const bottomRef       = useRef<HTMLDivElement>(null)

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
      <div className="flex flex-col h-full bg-white rounded-[14px] shadow-[0_2px_12px_rgba(0,0,0,.05)] border border-[#f0f0f0] overflow-hidden items-center justify-center">
        <div className="text-gray-300 text-[.88rem]">Carregando mensagens...</div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-white rounded-[14px] shadow-[0_2px_12px_rgba(0,0,0,.05)] border border-[#f0f0f0] overflow-hidden">
      {/* Mensagens */}
      <div className="flex-1 overflow-y-auto p-5 flex flex-col">
        {messages.length === 0 ? (
          <div className="text-center text-gray-300 text-[.85rem] m-auto">
            <div className="text-[2rem] mb-2">💬</div>
            Nenhuma mensagem ainda. Comece a conversa!
          </div>
        ) : (
          messages.map(msg => (
            <MessageBubble key={msg.id} message={msg} currentUserId={currentUserId} />
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex gap-2.5 px-4 py-3.5 border-t border-[#f0f0f0] bg-[#fafafa]">
        <input
          type="text"
          className="flex-1 px-3.5 py-2.5 border-[1.5px] border-gray-200 rounded-full text-[.88rem] font-[inherit] outline-none transition-colors focus:border-[#ff385c] disabled:opacity-50"
          placeholder="Digite uma mensagem..."
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={sending}
        />
        <button
          className="px-[18px] py-2.5 bg-[#ff385c] text-white border-none rounded-full text-[.88rem] font-semibold cursor-pointer transition-opacity disabled:opacity-50 disabled:cursor-default font-[inherit]"
          onClick={handleSend}
          disabled={!text.trim() || sending}
        >
          {sending ? '...' : 'Enviar'}
        </button>
      </div>
    </div>
  )
}
