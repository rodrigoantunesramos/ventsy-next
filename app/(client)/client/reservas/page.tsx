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

const STATUS: Record<string, { label: string; cls: string; passo: number }> = {
  solicitada: { label: 'Aguardando aprovação', cls: 'border-amber-200 bg-amber-50 text-amber-700', passo: 1 },
  aprovada: { label: 'Aprovada — pague para confirmar', cls: 'border-sky-200 bg-sky-50 text-sky-700', passo: 2 },
  paga: { label: 'Confirmada', cls: 'border-emerald-200 bg-emerald-50 text-emerald-700', passo: 3 },
  confirmada: { label: 'Confirmada', cls: 'border-emerald-200 bg-emerald-50 text-emerald-700', passo: 3 },
  recusada: { label: 'Recusada', cls: 'border-red-200 bg-red-50 text-red-700', passo: 0 },
  cancelada: { label: 'Cancelada', cls: 'border-gray-200 bg-gray-100 text-gray-500', passo: 0 },
  expirada: { label: 'Expirada', cls: 'border-gray-200 bg-gray-100 text-gray-500', passo: 0 },
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
    <div className="mx-auto max-w-[760px] px-6 py-7">
      <div className="mb-6">
        <h1 className="m-0 text-[1.5rem] font-extrabold text-gray-900">📅 Minhas Reservas</h1>
        <p className="mt-1.5 text-[.88rem] text-gray-400">Acompanhe o andamento das reservas que você solicitou.</p>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[0, 1].map((i) => <div key={i} className="h-32 animate-pulse rounded-2xl bg-black/[0.05]" />)}
        </div>
      ) : reservas.length === 0 ? (
        <div className="rounded-2xl border border-[#f0f0f0] bg-white px-5 py-14 text-center shadow-[0_2px_12px_rgba(0,0,0,.05)]">
          <div className="mb-3 text-[3rem]">📅</div>
          <div className="mb-1.5 text-base font-semibold text-gray-500">Nenhuma reserva ainda</div>
          <div className="mx-auto max-w-sm text-[.85rem] text-gray-400">Encontre um espaço e solicite uma reserva — o andamento aparece aqui.</div>
          <Link href="/busca" className="mt-5 inline-block rounded-xl bg-[#ff385c] px-6 py-2.5 text-[.9rem] font-bold text-white no-underline transition-colors hover:bg-[#e0304f]">
            🔍 Explorar espaços
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {reservas.map((r) => {
            const st = STATUS[r.status] || { label: r.status, cls: 'border-gray-200 bg-gray-100 text-gray-500', passo: 0 }
            return (
              <div key={r.id} className="rounded-2xl border border-[#f0f0f0] bg-white p-5 shadow-[0_2px_12px_rgba(0,0,0,.05)]">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-[1rem] font-bold text-gray-900">{r.propriedade?.nome || 'Espaço'}</div>
                    <div className="mt-0.5 text-[.8rem] text-gray-400">
                      {r.propriedade?.cidade ? `${r.propriedade.cidade} · ` : ''}{r.tipo_evento || 'Evento'}
                    </div>
                  </div>
                  <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[.72rem] font-semibold ${st.cls}`}>{st.label}</span>
                </div>

                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[.82rem] text-gray-500">
                  {r.data_inicio && <span>📅 {formatDate(r.data_inicio)}</span>}
                  {r.pessoas ? <span>👥 {r.pessoas} pessoas</span> : null}
                  {r.valor_estimado ? <span>💰 {formatMoney(Number(r.valor_estimado))} estimado</span> : null}
                </div>

                {st.passo > 0 && (
                  <div className="mt-4 flex items-center">
                    {PASSOS.map((p, i) => (
                      <div key={p} className="flex items-center">
                        <div className={`flex h-6 w-6 items-center justify-center rounded-full text-[.7rem] font-bold ${i + 1 <= st.passo ? 'bg-[#ff385c] text-white' : 'bg-gray-100 text-gray-400'}`}>{i + 1}</div>
                        <span className={`ml-1.5 text-[.74rem] ${i + 1 <= st.passo ? 'font-semibold text-gray-700' : 'text-gray-400'}`}>{p}</span>
                        {i < PASSOS.length - 1 && <div className={`mx-2 h-px w-5 ${i + 1 < st.passo ? 'bg-[#ff385c]' : 'bg-gray-200'}`} />}
                      </div>
                    ))}
                  </div>
                )}

                {r.propriedade?.id && (
                  <div className="mt-3">
                    <Link href={`/propriedade/${r.propriedade.id}`} className="text-[.8rem] font-semibold text-[#ff385c] no-underline">Ver espaço →</Link>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
