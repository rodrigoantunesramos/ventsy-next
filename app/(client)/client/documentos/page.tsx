'use client'

// Documentos & Contratos — /client/documentos. Consolida os contratos de TODOS
// os eventos do contratante num só lugar (ver/assinar). Os dados vêm de
// /api/portal/cliente: 'resumo' lista os eventos e, por evento, 'evento'
// devolve o contrato. Sem "R$" hardcoded — moeda via lib/format.

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { formatMoney, formatDate } from '@/lib/format'
import { portalClienteApi, type ContratoCli } from '../eventos/_lib'
import { PageHeader, Card, Kpi, Badge, EmptyState, Skeleton, btnPrimary, btnGhost } from '../_ui'
import { Icon } from '../_nav'

// Contrato anotado com o evento de origem (não-nulo).
type ContratoItem = NonNullable<ContratoCli> & { evento_id: string; nome_evento: string | null }

type EventoResumoLite = {
  evento_id: string
  nome_evento: string | null
  data_inicio: string | null
  propriedade: { nome: string | null; cidade: string | null } | null
}

export default function DocumentosPage() {
  const [loading, setLoading] = useState(true)
  const [contratos, setContratos] = useState<ContratoItem[]>([])

  async function carregar() {
    const resumo = await portalClienteApi('resumo').catch(() => null)
    const eventos = ((resumo?.eventos as EventoResumoLite[] | undefined) || []).slice(0, 25)
    if (eventos.length === 0) { setContratos([]); return }

    const resultados = await Promise.all(
      eventos.map(async (ev) => {
        try {
          const r = await portalClienteApi('evento', { evento_id: ev.evento_id })
          const c = r.contrato as ContratoCli
          if (!c) return null
          return { ...c, evento_id: ev.evento_id, nome_evento: ev.nome_evento } as ContratoItem
        } catch {
          return null
        }
      }),
    )
    setContratos(resultados.filter((c): c is ContratoItem => c != null))
  }

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setLoading(false); return }
      await carregar()
      setLoading(false)
    })()
  }, [])

  const total = contratos.length
  const assinados = contratos.filter((c) => statusFlags(c).assinado).length
  const pendentes = total - assinados

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-56" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-24" />)}</div>
        <Skeleton className="h-64" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Planejamento" title="Documentos" subtitle="Seus contratos e documentos dos eventos." />

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3">
        <Kpi label="Contratos" value={total} tone="brand" icon="doc" />
        <Kpi label="Assinados" value={assinados} tone="verde" icon="ticket" />
        <Kpi label="Pendentes" value={pendentes} tone="gold" icon="shield" />
      </div>

      {contratos.length === 0 ? (
        <EmptyState
          icon="doc"
          title="Nenhum documento ainda"
          text="Quando o organizador disponibilizar um contrato para os seus eventos, ele aparece aqui para você ver e assinar."
          action={<Link href="/client/eventos" className={btnPrimary}><Icon name="ticket" size={16} /> Ver meus eventos</Link>}
        />
      ) : (
        <div className="space-y-3">
          {contratos.map((c) => <ContratoRow key={`${c.evento_id}-${c.id}`} c={c} />)}
        </div>
      )}

      {/* Aviso: outros arquivos ficam dentro de cada evento */}
      <Card className="flex items-start gap-3 bg-brand-50/40">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand"><Icon name="doc" size={20} /></span>
        <div className="min-w-0">
          <div className="text-sm font-bold text-ink">Outros documentos do evento</div>
          <p className="mt-0.5 text-[.82rem] text-ink-muted">
            Documentos compartilhados pelo organizador aparecem na aba Documentos de cada evento.{' '}
            <Link href="/client/eventos" className="font-semibold text-brand hover:underline">Ir para Meus Eventos</Link>
          </p>
        </div>
      </Card>
    </div>
  )
}

// Deriva os estados do contrato a partir do status/assinatura.
function statusFlags(c: ContratoItem) {
  const status = String(c.status || '').toLowerCase()
  const assinado = status === 'assinado' || !!c.assinado_em
  const disponivel = status === 'enviado' || assinado
  return { status, assinado, disponivel }
}

function ContratoRow({ c }: { c: ContratoItem }) {
  const { assinado, disponivel } = statusFlags(c)
  const titulo = c.titulo || `Contrato ${c.numero || ''}`.trim()
  const href = c.link_token ? `/contrato/${c.link_token}` : null

  return (
    <Card className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand"><Icon name="doc" size={20} /></span>
        <div className="min-w-0">
          <div className="truncate text-[.92rem] font-bold text-ink">{titulo}</div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[.76rem] text-ink-muted">
            {c.nome_evento && <span className="truncate">{c.nome_evento}</span>}
            {c.valor_num != null && (
              <>
                {c.nome_evento && <span aria-hidden>·</span>}
                <span>{formatMoney(c.valor_num, { currency: (c.moeda as 'BRL' | 'USD' | 'EUR') || undefined })}</span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-3">
        <Badge tone={assinado ? 'verde' : disponivel ? 'ambar' : 'cinza'}>
          {assinado ? 'Assinado' : disponivel ? 'Aguardando assinatura' : 'Em preparação'}
        </Badge>
        {href && disponivel && !assinado ? (
          <a href={href} target="_blank" rel="noopener noreferrer" className={btnPrimary}>Ver e assinar</a>
        ) : href && assinado ? (
          <a href={href} target="_blank" rel="noopener noreferrer" className={btnGhost}>Ver contrato</a>
        ) : (
          <span className="text-[.8rem] text-ink-muted">Disponível em breve</span>
        )}
      </div>
    </Card>
  )
}
