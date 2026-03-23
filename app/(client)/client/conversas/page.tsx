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
    <div className="px-6 py-7 max-w-[760px] mx-auto">
      <div className="mb-6">
        <h1 className="text-[1.5rem] font-extrabold text-gray-900 m-0">💬 Conversas</h1>
        <p className="text-[.88rem] text-gray-400 mt-1.5">
          {conversas.length > 0
            ? `${conversas.length} conversa${conversas.length > 1 ? 's' : ''}`
            : 'Nenhuma conversa iniciada'}
        </p>
      </div>

      {conversas.length === 0 ? (
        <div className="text-center py-16 px-5 text-gray-300">
          <div className="text-[3rem] mb-3">💬</div>
          <div className="text-base font-semibold text-gray-400 mb-1.5">Nenhuma conversa ainda</div>
          <div className="text-[.85rem]">
            Encontre um espaço que você goste e inicie uma conversa com o proprietário.
          </div>
          <Link
            href="/busca"
            className="inline-block mt-5 bg-[#ff385c] hover:bg-[#e0304f] text-white rounded-xl py-2.5 px-6 text-[.9rem] font-bold no-underline transition-colors"
          >
            🔍 Explorar espaços
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-[14px] shadow-[0_2px_12px_rgba(0,0,0,.05)] border border-[#f0f0f0] overflow-hidden">
          {conversas.map(conv => (
            <Link
              key={conv.id}
              href={`/client/conversas/${conv.id}`}
              className="flex items-center gap-3.5 px-5 py-3.5 border-b border-[#f5f5f5] last:border-0 no-underline text-inherit hover:bg-gray-50 transition-colors"
            >
              <div className="w-11 h-11 rounded-full bg-[#ff385c] text-white flex items-center justify-center font-bold text-base flex-shrink-0">
                {conv.propriedade?.nome?.[0] ?? '?'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-[.9rem] text-gray-900">{conv.propriedade?.nome ?? 'Espaço'}</div>
                <div className="text-[.8rem] text-gray-400 mt-0.5 truncate max-w-[280px]">{conv.ultima_mensagem ?? 'Nenhuma mensagem ainda'}</div>
              </div>
              {conv.ultima_mensagem_em && (
                <span className="text-[.72rem] text-gray-300 whitespace-nowrap flex-shrink-0">
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
