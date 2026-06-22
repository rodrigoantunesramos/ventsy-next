'use client'

// Pagamentos consolidados do contratante — /client/pagamentos. Junta todas as
// parcelas de todos os eventos do cliente num só lugar (a pagar / pagas / todas),
// com KPIs e o próximo vencimento em destaque. O pagamento em si acontece na
// página do evento (/client/eventos/[id]); aqui é a visão panorâmica.

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { formatMoney, formatDate } from '@/lib/format'
import { parcelaPaga, parcelaEmAberto, diasAte } from '@/lib/portal'
import { portalClienteApi, type ParcelaCli } from '../eventos/_lib'
import { PageHeader, Card, Kpi, Tabs, Badge, EmptyState, Skeleton, btnPrimary } from '../_ui'
import { Icon } from '../_nav'

// Parcela achatada: a parcela do evento + o contexto (qual evento ela pertence).
type ParcelaFlat = ParcelaCli & { evento_id: string; nome_evento: string }

type EventoResumoLite = {
  evento_id: string
  nome_evento: string | null
  data_inicio: string | null
  propriedade: { nome: string | null; cidade: string | null } | null
}

type Aba = 'aberto' | 'pagas' | 'todas'

// Ordena por vencimento ascendente; datas nulas vão por último.
function porVencimentoAsc(a: ParcelaFlat, b: ParcelaFlat): number {
  const va = a.vencimento ? new Date(a.vencimento).getTime() : Infinity
  const vb = b.vencimento ? new Date(b.vencimento).getTime() : Infinity
  return va - vb
}

export default function PagamentosPage() {
  const [loading, setLoading] = useState(true)
  const [parcelas, setParcelas] = useState<ParcelaFlat[]>([])
  const [aba, setAba] = useState<Aba>('aberto')

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setLoading(false); return }
      try {
        const resumo = await portalClienteApi('resumo')
        const eventos = ((resumo.eventos as EventoResumoLite[] | undefined) || []).slice(0, 25)
        const listas = await Promise.all(eventos.map(async (ev) => {
          try {
            const det = await portalClienteApi('evento', { evento_id: ev.evento_id })
            const ps = (det.parcelas as ParcelaCli[] | undefined) || []
            return ps.map((p): ParcelaFlat => ({
              ...p,
              evento_id: ev.evento_id,
              nome_evento: ev.nome_evento || 'Evento',
            }))
          } catch {
            return [] as ParcelaFlat[]
          }
        }))
        setParcelas(listas.flat())
      } catch {
        setParcelas([])
      }
      setLoading(false)
    })()
  }, [])

  const agora = new Date()

  // Totais (sempre sobre o conjunto completo).
  let total = 0, pago = 0, aberto = 0, vencido = 0
  for (const p of parcelas) {
    const v = Number(p.valor) || 0
    total += v
    if (parcelaPaga(p.status)) { pago += v; continue }
    if (parcelaEmAberto(p)) {
      aberto += v
      const dias = diasAte(p.vencimento, agora)
      if (dias != null && dias < 0) vencido += v
    }
  }

  // Listas por aba.
  const emAberto = parcelas.filter((p) => parcelaEmAberto(p)).sort((a, b) => {
    const da = diasAte(a.vencimento, agora)
    const db = diasAte(b.vencimento, agora)
    const venA = da != null && da < 0 ? 0 : 1
    const venB = db != null && db < 0 ? 0 : 1
    if (venA !== venB) return venA - venB // vencidas primeiro
    return porVencimentoAsc(a, b)
  })
  const pagas = parcelas.filter((p) => parcelaPaga(p.status)).sort((a, b) => {
    const pa = a.pago_em ? new Date(a.pago_em).getTime() : 0
    const pb = b.pago_em ? new Date(b.pago_em).getTime() : 0
    return pb - pa // pagamento mais recente primeiro
  })
  const todas = [...parcelas].sort(porVencimentoAsc)

  const proxima = emAberto[0] || null

  const lista = aba === 'aberto' ? emAberto : aba === 'pagas' ? pagas : todas

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-64" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}</div>
        <Skeleton className="h-28" />
        <Skeleton className="h-64" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Planejamento" title="Pagamentos"
        subtitle="Todas as parcelas dos seus eventos em um só lugar." />

      {parcelas.length === 0 ? (
        <EmptyState icon="card" title="Nenhuma parcela ainda"
          text="Quando seu evento tiver um plano de pagamento, as parcelas aparecem aqui — com vencimentos e status sempre atualizados."
          action={<Link href="/client/eventos" className={btnPrimary}><Icon name="ticket" size={16} /> Ver meus eventos</Link>} />
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi label="Total" value={formatMoney(total)} tone="ink" icon="wallet" />
            <Kpi label="Pago" value={formatMoney(pago)} tone="verde" icon="card" />
            <Kpi label="Em aberto" value={formatMoney(aberto)} tone="gold" icon="calendar" />
            <Kpi label="Vencido" value={formatMoney(vencido)} tone="vermelho" icon="bell" destaque={vencido > 0} />
          </div>

          {/* Próximo vencimento em destaque */}
          {proxima && (
            <Card className="border-brand/30 bg-brand-50/40">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-[.72rem] font-bold uppercase tracking-[.1em] text-brand">Próximo vencimento</div>
                  <div className="mt-1 font-display text-2xl font-black text-ink">{formatMoney(Number(proxima.valor) || 0)}</div>
                  <div className="mt-0.5 truncate text-sm text-ink-muted">
                    {proxima.nome_evento}
                    {proxima.vencimento ? ` · vence ${formatDate(proxima.vencimento)}` : ''}
                  </div>
                </div>
                <Link href={`/client/eventos/${proxima.evento_id}`} className={btnPrimary}>
                  <Icon name="card" size={16} /> Pagar
                </Link>
              </div>
            </Card>
          )}

          {/* Abas */}
          <Tabs
            tabs={[
              { key: 'aberto', label: 'A pagar', count: emAberto.length },
              { key: 'pagas', label: 'Pagas', count: pagas.length },
              { key: 'todas', label: 'Todas', count: todas.length },
            ]}
            active={aba}
            onChange={setAba}
          />

          {lista.length === 0 ? (
            <EmptyState icon="card"
              title={aba === 'aberto' ? 'Nenhuma parcela em aberto' : aba === 'pagas' ? 'Nenhuma parcela paga' : 'Nenhuma parcela'}
              text={aba === 'aberto' ? 'Tudo em dia por aqui. Suas parcelas pagas ficam na aba “Pagas”.' : undefined} />
          ) : (
            <Card className="p-0">
              <div className="divide-y divide-line">
                {lista.map((p) => <ParcelaRow key={`${p.evento_id}-${p.id}`} p={p} agora={agora} />)}
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  )
}

function ParcelaRow({ p, agora }: { p: ParcelaFlat; agora: Date }) {
  const paga = parcelaPaga(p.status)
  const dias = diasAte(p.vencimento, agora)
  const vencida = !paga && parcelaEmAberto(p) && dias != null && dias < 0
  const valor = Number(p.valor) || 0
  const titulo = p.descricao || `Parcela ${p.numero ?? ''}`.trim()

  const sub = paga
    ? p.pago_em ? `Pago em ${formatDate(p.pago_em)}` : 'Pago'
    : p.vencimento ? `Vence ${formatDate(p.vencimento)}` : 'Sem vencimento'

  const badgeTone = paga ? 'verde' : vencida ? 'vermelho' : 'ambar'
  const badgeLabel = paga ? 'Pago' : vencida ? 'Vencida' : 'Em aberto'

  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${paga ? 'bg-emerald-50 text-emerald-600' : vencida ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'}`}>
          <Icon name="card" size={16} />
        </span>
        <div className="min-w-0">
          <div className="truncate text-[.88rem] font-semibold text-ink">{titulo}</div>
          <div className="truncate text-[.72rem] text-ink-muted">{p.nome_evento} · {sub}</div>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <div className="text-right">
          <div className="text-[.95rem] font-bold text-ink">{formatMoney(valor)}</div>
          <Badge tone={badgeTone} className="mt-0.5">{badgeLabel}</Badge>
        </div>
        <Link href={`/client/eventos/${p.evento_id}`} className="shrink-0 text-[.78rem] font-semibold text-brand hover:underline">
          {paga ? 'Ver' : 'Pagar'}
        </Link>
      </div>
    </div>
  )
}
