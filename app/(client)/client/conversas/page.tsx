'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import type { Conversation } from '@/types/client'
import { PageHeader, Card, EmptyState, Skeleton, btnPrimary, Icon } from '../_ui'

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

  const carregar = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/login'); return }
    try {
      const res  = await fetch('/api/conversas', { headers: { Authorization: `Bearer ${session.access_token}` } })
      const json = await res.json()
      const lista = ((json.data || []) as Conversation[]).filter((c) => c.papel !== 'dono')
      setConversas(lista)
    } catch { /* mantém a lista atual */ } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => { carregar() }, [carregar])

  // Tempo real: nova mensagem/conversa minha atualiza a lista na hora.
  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null
    ;(async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      channel = supabase
        .channel('conversas-cliente')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'conversas', filter: `user_id=eq.${session.user.id}` }, () => { carregar() })
        .subscribe()
    })()
    return () => { if (channel) supabase.removeChannel(channel) }
  }, [carregar])

  if (loading) return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Skeleton className="h-12 w-48" />
      <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-[68px]" />)}</div>
    </div>
  )

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader eyebrow="Minha área" title="Conversas"
        subtitle={conversas.length > 0 ? `${conversas.length} conversa${conversas.length > 1 ? 's' : ''} com organizadores` : 'Fale direto com os anfitriões dos espaços.'} />

      {conversas.length === 0 ? (
        <EmptyState icon="chat" title="Nenhuma conversa ainda"
          text="Encontre um espaço que você goste e inicie uma conversa com o proprietário."
          action={<Link href="/busca" className={btnPrimary}><Icon name="search" size={16} /> Explorar espaços</Link>} />
      ) : (
        <Card className="p-0">
          <div className="divide-y divide-line">
            {conversas.map(conv => (
              <Link key={conv.id} href={`/client/conversas/${conv.id}`}
                className="flex items-center gap-3.5 px-5 py-3.5 transition hover:bg-black/[0.02]">
                <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-brand text-base font-bold text-white">
                  {conv.propriedade?.nome?.[0] ?? '?'}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[.9rem] font-semibold text-ink">{conv.propriedade?.nome ?? 'Espaço'}</div>
                  <div className="mt-0.5 max-w-[280px] truncate text-[.8rem] text-ink-muted">{conv.ultima_mensagem ?? 'Nenhuma mensagem ainda'}</div>
                </div>
                {conv.ultima_mensagem_em && (
                  <span className="flex-shrink-0 whitespace-nowrap text-[.72rem] text-ink-muted">{timeAgo(conv.ultima_mensagem_em)}</span>
                )}
              </Link>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}
