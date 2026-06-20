'use client'

// Inbox de mensagens do proprietário — /painel/conversas.
// Lista as conversas em que o usuário é o ANFITRIÃO (papel 'dono'), vindas de
// /api/conversas (que cobre os dois papéis). Atualiza em tempo real via Supabase
// Realtime (postgres_changes em `conversas` filtrado por owner_id).

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase as sb } from '@/lib/supabase'
import type { Conversation } from '@/types/client'

function timeAgo(iso?: string) {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'agora'
  if (m < 60) return `${m}min`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  return `${Math.floor(h / 24)}d`
}

function inicial(nome?: string | null) {
  return (nome?.trim()?.[0] ?? '?').toUpperCase()
}

export default function PainelConversasPage() {
  const router = useRouter()
  const [conversas, setConversas] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)

  const carregar = useCallback(async () => {
    const { data: { session } } = await sb.auth.getSession()
    if (!session) { router.replace('/login'); return }
    const res = await fetch('/api/conversas', { headers: { Authorization: `Bearer ${session.access_token}` } })
    const json = await res.json()
    const lista = ((json.data || []) as Conversation[]).filter((c) => c.papel === 'dono')
    setConversas(lista)
    setLoading(false)
  }, [router])

  useEffect(() => { carregar() }, [carregar])

  // Tempo real: qualquer mudança nas minhas conversas (nova msg/nova conversa)
  // recarrega a lista — barato e mantém o topo sempre na atividade mais recente.
  useEffect(() => {
    let channel: ReturnType<typeof sb.channel> | null = null
    ;(async () => {
      const { data: { session } } = await sb.auth.getSession()
      if (!session) return
      channel = sb
        .channel('inbox-dono')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'conversas', filter: `owner_id=eq.${session.user.id}` },
          () => { carregar() },
        )
        .subscribe()
    })()
    return () => { if (channel) sb.removeChannel(channel) }
  }, [carregar])

  return (
    <div className="mx-auto max-w-[760px]">
      <div className="mb-6">
        <h1 className="m-0 text-[1.5rem] font-extrabold text-ink">Mensagens</h1>
        <p className="mt-1.5 text-[.88rem] text-ink-muted">
          {loading
            ? 'Carregando…'
            : conversas.length > 0
              ? `${conversas.length} conversa${conversas.length > 1 ? 's' : ''} com clientes`
              : 'Nenhuma conversa ainda'}
        </p>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => <div key={i} className="h-[68px] animate-pulse rounded-xl bg-black/[0.05]" />)}
        </div>
      ) : conversas.length === 0 ? (
        <div className="rounded-2xl border border-black/[0.06] bg-white px-5 py-14 text-center shadow-pop">
          <div className="mb-3 text-[3rem]">💬</div>
          <div className="mb-1.5 text-base font-semibold text-ink-soft">Nenhuma mensagem ainda</div>
          <div className="mx-auto max-w-sm text-[.85rem] text-ink-muted">
            Quando um cliente entrar em contato pelo seu anúncio, a conversa aparece aqui — e você responde em tempo real.
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-black/[0.06] bg-white shadow-pop">
          {conversas.map((c) => (
            <Link
              key={c.id}
              href={`/painel/conversas/${c.id}`}
              className="flex items-center gap-3.5 border-b border-black/[0.04] px-5 py-3.5 no-underline transition-colors last:border-0 hover:bg-[#f7f7f7]"
            >
              <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-brand text-base font-bold text-white">
                {inicial(c.contraparte?.nome)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[.9rem] font-semibold text-ink">{c.contraparte?.nome || 'Cliente'}</div>
                <div className="truncate text-[.8rem] text-ink-muted">
                  {c.propriedade?.nome ? `${c.propriedade.nome} · ` : ''}{c.ultima_mensagem || 'Nenhuma mensagem ainda'}
                </div>
              </div>
              {c.ultima_mensagem_em && (
                <span className="flex-shrink-0 whitespace-nowrap text-[.72rem] text-ink-muted/70">{timeAgo(c.ultima_mensagem_em)}</span>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
