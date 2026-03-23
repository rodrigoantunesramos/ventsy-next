'use client'

import type { Message } from '@/types/client'

interface Props {
  message: Message
  currentUserId: string
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

export default function MessageBubble({ message, currentUserId }: Props) {
  const isSent = message.sender_id === currentUserId

  return (
    <div className={`cl-bubble-wrap ${isSent ? 'sent' : 'recv'}`}>
      <div className={`cl-bubble ${isSent ? 'sent' : 'recv'}`}>
        {message.text}
        <div className="cl-bubble-time">{formatTime(message.created_at)}</div>
      </div>
    </div>
  )
}
