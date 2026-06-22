'use client'

// Minhas Reservas — /client/reservas. Acompanha as solicitações de reserva que o
// cliente fez no marketplace (status solicitada → aprovada → confirmada). Lê a
// tabela `reservas` por RLS (usuario_id = auth.uid()). Não é o mesmo que "Meus
// Eventos" (evento contratado via Portal) — aqui é o estágio pré-contratação.

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { formatMoney, formatDate } from '@/lib/format'
import { PageHeader, Card, Badge, EmptyState, Skeleton, btnPrimary, Icon } from '../_ui'

type Reserva = {
  id: string
  status: string
  data_inicio: string | null
  data_fim: string | null
  valor_estimado: number | null
  pessoas: number | null
  tipo_evento: string | null
  criado_em: string
  propriedade: { id: number; nome: string | null; cidade: string | null } | null
}

const STATUS: Record<string, { label: string; tone: 'ambar' | 'azul' | 'verde' | 'vermelho' | 'cinza'; passo: number }> = {
  solicitada: { label: 'Aguardando aprovação', tone: 'ambar', passo: 1 },
  aprovada: { label: 'Aprovada — pague para confirmar', tone: 'azul', passo: 2 },
  paga: { label: 'Confirmada', tone: 'verde', passo: 3 },
  confirmada: { label: 'Confirmada', tone: 'verde', passo: 3 },
  recusada: { label: 'Recusada', tone: 'vermelho', passo: 0 },
  cancelada: { label: 'Cancelada', tone: 'cinza', passo: 0 },
  expirada: { label: 'Expirada', tone: 'cinza', passo: 0 },
}
const PASSOS = ['Solicitada', 'Aprovada', 'Confirmada']

export default function ClientReservasPage() {
  const router = useRouter()
  const [reservas, setReservas] = useState<Reserva[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }
      const { data } = await supabase
        .from('reservas')
        .select('id, status, data_inicio, data_fim, valor_estimado, pessoas, tipo_evento, criado_em, propriedade:propriedades(id, nome, cidade)')
        .eq('usuario_id', session.user.id)
        .order('criado_em', { ascending: false })
      const lista = ((data || []) as unknown as Reserva[]).filter((r) => r.status !== 'bloqueio')
      setReservas(lista)
      setLoading(false)
    })()
  }, [router])

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader eyebrow="Minha área" title="Minhas reservas" subtitle="Acompanhe o andamento das reservas que você solicitou." />

      {loading ? (
        <div className="space-y-3">{[0, 1].map((i) => <Skeleton key={i} className="h-32" />)}</div>
      ) : reservas.length === 0 ? (
        <EmptyState icon="calendar" title="Nenhuma reserva ainda"
          text="Encontre um espaço e solicite uma reserva — o andamento aparece aqui."
          action={<Link href="/busca" className={btnPrimary}><Icon name="search" size={16} /> Explorar espaços</Link>} />
      ) : (
        <div className="space-y-4">
          {reservas.map((r) => {
            const st = STATUS[r.status] || { label: r.status, tone: 'cinza' as const, passo: 0 }
            return (
              <Card key={r.id}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-[1rem] font-bold text-ink">{r.propriedade?.nome || 'Espaço'}</div>
                    <div className="mt-0.5 text-[.8rem] text-ink-muted">
                      {r.propriedade?.cidade ? `${r.propriedade.cidade} · ` : ''}{r.tipo_evento || 'Evento'}
                    </div>
                  </div>
                  <Badge tone={st.tone}>{st.label}</Badge>
                </div>

                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[.82rem] text-ink-muted">
                  {r.data_inicio && <span>📅 {formatDate(r.data_inicio)}</span>}
                  {r.pessoas ? <span>👥 {r.pessoas} pessoas</span> : null}
                  {r.valor_estimado ? <span>💰 {formatMoney(Number(r.valor_estimado))} estimado</span> : null}
                </div>

                {st.passo > 0 && (
                  <div className="mt-4 flex items-center">
                    {PASSOS.map((p, i) => (
                      <div key={p} className="flex items-center">
                        <div className={`flex h-6 w-6 items-center justify-center rounded-full text-[.7rem] font-bold ${i + 1 <= st.passo ? 'bg-brand text-white' : 'bg-black/[0.06] text-ink-muted'}`}>{i + 1}</div>
                        <span className={`ml-1.5 text-[.74rem] ${i + 1 <= st.passo ? 'font-semibold text-ink-soft' : 'text-ink-muted'}`}>{p}</span>
                        {i < PASSOS.length - 1 && <div className={`mx-2 h-px w-5 ${i + 1 < st.passo ? 'bg-brand' : 'bg-black/[0.1]'}`} />}
                      </div>
                    ))}
                  </div>
                )}

                {r.propriedade?.id && (
                  <div className="mt-3">
                    <Link href={`/propriedade/${r.propriedade.id}`} className="text-[.8rem] font-semibold text-brand">Ver espaço →</Link>
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
