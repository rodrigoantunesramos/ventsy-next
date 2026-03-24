'use client'

import type { Message } from '@/types/client'

interface Props {
  message: Message
  currentUserId: string
}

function formatTime(iso: string | null) {
  if (!iso) return ''
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

export default function MessageBubble({ message, currentUserId }: Props) {
  const isSent = message.sender_id === currentUserId

  return (
    <div className={`flex mb-2.5 ${isSent ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[70%] px-3.5 py-2.5 text-[.88rem] leading-[1.5] break-words
          ${isSent
            ? 'bg-[#ff385c] text-white rounded-2xl rounded-br-[4px]'
            : 'bg-gray-100 text-gray-800 rounded-2xl rounded-bl-[4px]'
          }`}
      >
        {message.text}
        <div className="text-[.68rem] opacity-60 mt-1">{formatTime(message.created_at)}</div>
      </div>
    </div>
  )
}
