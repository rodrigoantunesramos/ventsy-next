'use client'

// Início premium do contratante — /client. Hero com contagem regressiva do
// próximo evento, pendências acionáveis, KPIs (eventos, carteira, indicações,
// favoritos), progresso do planejador, atalhos e convite de indicação. Agrega
// /api/portal/cliente (resumo) + carteira + indicações + favoritos.

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import PropertyCard from '@/components/PropertyCard'
import { useFavorites } from '@/hooks/useFavorites'
import { formatMoney, formatMoneyShort, formatDate } from '@/lib/format'
import { kpisIndicacoes } from '@/lib/indique'
import { portalClienteApi } from './eventos/_lib'
import { PageHeader, Card, Kpi, Section, ActionTile, ProgressBar, EmptyState, Skeleton, btnPrimary, Icon } from './_ui'
import type { Favorite, Conversation } from '@/types/client'

type EventoLite = {
  evento_id: string; nome_evento: string | null; tipo_evento: string | null
  data_inicio: string | null; data_fim: string | null; status: string | null
  propriedade: { nome: string | null; cidade: string | null; estado: string | null } | null
  portal_ativo: boolean; dias_ate: number | null
}
type ProximaParcela = { evento_id: string; nome_evento: string | null; valor: number; vencimento: string | null; vencida: boolean } | null
type ContratoPendente = { evento_id: string; nome_evento: string | null } | null

export default function ClientHome() {
  const router = useRouter()
  const { toggle } = useFavorites()

  const [nome, setNome] = useState('')
  const [eventos, setEventos] = useState<EventoLite[]>([])
  const [proxParcela, setProxParcela] = useState<ProximaParcela>(null)
  const [contratoPend, setContratoPend] = useState<ContratoPendente>(null)
  const [favoritos, setFavoritos] = useState<Favorite[]>([])
  const [conversas, setConversas] = useState<Conversation[]>([])
  const [saldo, setSaldo] = useState(0)
  const [cupons, setCupons] = useState(0)
  const [indicConv, setIndicConv] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }
      const uid = session.user.id
      const headers = { Authorization: `Bearer ${session.access_token}` }

      let primeiro = session.user.email?.split('@')[0] ?? ''
      try {
        const { data: perfil } = await supabase.from('usuarios').select('nome').eq('id', uid).single()
        if (perfil?.nome) primeiro = String(perfil.nome).split(' ')[0]
      } catch { /* opcional */ }
      setNome(primeiro)

      const [resumo, favRes, convRes, cartRes, indicRes] = await Promise.all([
        portalClienteApi('resumo').catch(() => ({ eventos: [], proxima_parcela: null, contrato_pendente: null })),
        fetch('/api/favoritos', { headers }).then((r) => r.json()).catch(() => ({ data: [] })),
        fetch('/api/conversas', { headers }).then((r) => r.json()).catch(() => ({ data: [] })),
        fetch('/api/client/carteira', { headers }).then((r) => r.json()).catch(() => ({ resumo: { saldo: 0 }, cupons: [] })),
        fetch('/api/client/indicacoes', { headers }).then((r) => r.json()).catch(() => ({ indicacoes: [] })),
      ])

      setEventos((resumo.eventos as EventoLite[]) || [])
      setProxParcela((resumo.proxima_parcela as ProximaParcela) ?? null)
      setContratoPend((resumo.contrato_pendente as ContratoPendente) ?? null)
      setFavoritos((favRes.data || []) as Favorite[])
      setConversas(((convRes.data || []) as Conversation[]).filter((c) => c.papel !== 'dono'))
      setSaldo(Number(cartRes?.resumo?.saldo) || 0)
      setCupons(((cartRes?.cupons || []) as { status?: string }[]).filter((c) => c.status === 'disponivel').length)
      setIndicConv(kpisIndicacoes((indicRes?.indicacoes || []) as []).convertidos)
      setLoading(false)
    })()
  }, [router])

  if (loading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-40 w-full" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}</div>
        <Skeleton className="h-56 w-full" />
      </div>
    )
  }

  const proximo = eventos
    .filter((e) => e.dias_ate != null && e.dias_ate >= 0)
    .sort((a, b) => (a.dias_ate ?? 9999) - (b.dias_ate ?? 9999))[0] || null
  const temPendencia = !!proxParcela || !!contratoPend
  const semNada = eventos.length === 0 && favoritos.length === 0 && conversas.length === 0

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Minha área"
        title={nome ? `Olá, ${nome} 👋` : 'Bem-vindo à sua área'}
        subtitle="Acompanhe seus eventos, recompensas e tudo o que precisa em um só lugar."
        actions={<Link href="/busca" className={btnPrimary}><Icon name="search" size={16} /> Explorar espaços</Link>}
      />

      {/* HERO — próximo evento / contagem regressiva */}
      {proximo ? (
        <Link href={`/client/eventos/${proximo.evento_id}`} className="block">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand to-brand-700 p-6 text-white shadow-card transition hover:-translate-y-0.5 sm:p-8">
            <div className="absolute -right-10 -top-10 h-44 w-44 rounded-full bg-white/10" />
            <div className="absolute -bottom-16 right-16 h-40 w-40 rounded-full bg-white/5" />
            <div className="relative flex flex-wrap items-end justify-between gap-5">
              <div className="min-w-0">
                <div className="text-[.78rem] font-semibold uppercase tracking-wide text-white/80">Seu próximo evento</div>
                <div className="mt-1 truncate font-display text-2xl font-bold sm:text-3xl">{proximo.nome_evento || 'Meu evento'}</div>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-white/90">
                  {proximo.data_inicio && <span>📅 {formatDate(proximo.data_inicio)}</span>}
                  {proximo.propriedade?.nome && <span>📍 {[proximo.propriedade.nome, proximo.propriedade.cidade].filter(Boolean).join(' · ')}</span>}
                </div>
              </div>
              <div className="text-center">
                <div className="font-display text-5xl font-black leading-none sm:text-6xl">{proximo.dias_ate}</div>
                <div className="mt-1 text-[.78rem] font-semibold uppercase tracking-wide text-white/80">{proximo.dias_ate === 0 ? 'é hoje! 🎉' : proximo.dias_ate === 1 ? 'dia restante' : 'dias restantes'}</div>
              </div>
            </div>
          </div>
        </Link>
      ) : !semNada ? (
        <Card className="bg-gradient-to-br from-brand to-brand-700 text-white">
          <div className="font-display text-xl font-bold">Tudo em dia por aqui ✨</div>
          <p className="mt-1 text-sm text-white/85">Você não tem eventos futuros agendados. Que tal planejar o próximo?</p>
          <Link href="/busca" className="mt-4 inline-flex rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-brand">Encontrar um espaço</Link>
        </Card>
      ) : null}

      {/* PENDÊNCIAS */}
      {temPendencia && (
        <Section title="⚡ Precisa da sua atenção">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {proxParcela && (
              <Link href={`/client/eventos/${proxParcela.evento_id}`} className="block">
                <div className={`flex items-center justify-between gap-3 rounded-2xl border p-4 shadow-card transition hover:-translate-y-0.5 ${proxParcela.vencida ? 'border-red-200 bg-red-50' : 'border-amber-200 bg-amber-50'}`}>
                  <div className="min-w-0">
                    <div className={`text-[.78rem] font-semibold ${proxParcela.vencida ? 'text-red-700' : 'text-amber-700'}`}>💳 {proxParcela.vencida ? 'Parcela vencida' : 'Parcela a vencer'}</div>
                    <div className="mt-0.5 text-[.95rem] font-bold text-ink">{formatMoney(proxParcela.valor)}</div>
                    <div className="truncate text-[.76rem] text-ink-muted">{proxParcela.nome_evento || 'Seu evento'}{proxParcela.vencimento ? ` · vence ${formatDate(proxParcela.vencimento)}` : ''}</div>
                  </div>
                  <span className="shrink-0 rounded-xl bg-brand px-3.5 py-2 text-[.8rem] font-semibold text-white">Pagar</span>
                </div>
              </Link>
            )}
            {contratoPend && (
              <Link href={`/client/eventos/${contratoPend.evento_id}`} className="block">
                <div className="flex items-center justify-between gap-3 rounded-2xl border border-sky-200 bg-sky-50 p-4 shadow-card transition hover:-translate-y-0.5">
                  <div className="min-w-0">
                    <div className="text-[.78rem] font-semibold text-sky-700">📄 Contrato a assinar</div>
                    <div className="mt-0.5 text-[.95rem] font-bold text-ink">{contratoPend.nome_evento || 'Seu evento'}</div>
                    <div className="truncate text-[.76rem] text-ink-muted">Aguardando sua assinatura</div>
                  </div>
                  <span className="shrink-0 rounded-xl bg-brand px-3.5 py-2 text-[.8rem] font-semibold text-white">Ver e assinar</span>
                </div>
              </Link>
            )}
          </div>
        </Section>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Link href="/client/eventos"><Kpi label="Eventos" value={eventos.length} tone="brand" icon="ticket" sub={proximo ? 'próximo em breve' : 'nenhum futuro'} /></Link>
        <Link href="/client/carteira"><Kpi label="Saldo em créditos" value={formatMoneyShort(saldo)} tone="verde" icon="wallet" sub={`${cupons} cupom(ns) ativo(s)`} /></Link>
        <Link href="/client/indique"><Kpi label="Indicações" value={indicConv} tone="roxo" icon="gift" sub="amigos que entraram" /></Link>
        <Link href="/client/favoritos"><Kpi label="Favoritos" value={favoritos.length} tone="gold" icon="heart" sub="espaços salvos" /></Link>
      </div>

      {/* ATALHOS premium */}
      <Section title="Atalhos">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <ActionTile icon="clipboard" title="Planejador" text="Checklist & orçamento" href="/client/planejador" tone="brand" />
          <ActionTile icon="card" title="Pagamentos" text="Parcelas & recibos" href="/client/pagamentos" tone="verde" />
          <ActionTile icon="gift" title="Indique" text="Ganhe créditos" href="/client/indique" tone="roxo" />
          <ActionTile icon="wallet" title="Carteira" text="Créditos & cupons" href="/client/carteira" tone="azul" />
          <ActionTile icon="doc" title="Documentos" text="Contratos" href="/client/documentos" tone="gold" />
          <ActionTile icon="compass" title="Explorar" text="Achar espaços" href="/busca" tone="vermelho" />
        </div>
      </Section>

      {/* Meus eventos */}
      {eventos.length > 0 && (
        <Section title="🎫 Meus eventos" action={<Link href="/client/eventos" className="text-[.82rem] font-semibold text-brand">Ver todos →</Link>}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {eventos.slice(0, 4).map((ev) => <EventoCard key={ev.evento_id} ev={ev} />)}
          </div>
        </Section>
      )}

      {/* Indique banner */}
      <div className="overflow-hidden rounded-3xl border border-brand/20 bg-gradient-to-br from-violet-50 to-brand-50 p-6 sm:flex sm:items-center sm:justify-between sm:gap-6">
        <div className="min-w-0">
          <div className="font-display text-xl font-bold text-ink">Indique amigos e ganhe créditos 🎁</div>
          <p className="mt-1 max-w-xl text-sm text-ink-muted">Cada amigo que entra pela sua indicação rende créditos na sua carteira — e ele ainda ganha um cupom de boas-vindas.</p>
        </div>
        <Link href="/client/indique" className="mt-4 inline-flex shrink-0 rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white sm:mt-0">Convidar agora</Link>
      </div>

      {/* Favoritos recentes */}
      {favoritos.length > 0 && (
        <Section title="❤️ Favoritos recentes" action={<Link href="/client/favoritos" className="text-[.82rem] font-semibold text-brand">Ver todos →</Link>}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {favoritos.slice(0, 4).map((fav) => fav.propriedade && (
              <PropertyCard key={fav.id} property={fav.propriedade} isFavorite onToggleFavorite={() => toggle(fav.property_id)} />
            ))}
          </div>
        </Section>
      )}

      {/* Vazio total */}
      {semNada && (
        <EmptyState icon="compass" title="Comece a explorar!" text="Favorite espaços, converse com proprietários e acompanhe seus eventos por aqui."
          action={<Link href="/busca" className={btnPrimary}><Icon name="search" size={16} /> Explorar espaços</Link>} />
      )}
    </div>
  )
}

function EventoCard({ ev }: { ev: EventoLite }) {
  const local = ev.propriedade ? [ev.propriedade.nome, ev.propriedade.cidade].filter(Boolean).join(' · ') : null
  const faltam = ev.dias_ate != null && ev.dias_ate >= 0 ? ev.dias_ate : null
  const inner = (
    <div className={`h-full rounded-2xl border border-line bg-surface p-5 shadow-card transition ${ev.portal_ativo ? 'hover:-translate-y-0.5' : 'opacity-70'}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-[1rem] font-bold text-ink">{ev.nome_evento || 'Meu evento'}</div>
          {ev.tipo_evento && <div className="mt-0.5 text-[.78rem] text-ink-muted">{ev.tipo_evento}</div>}
        </div>
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-[1.3rem]">🎉</div>
      </div>
      <div className="mt-3 space-y-1 text-[.82rem] text-ink-muted">
        {ev.data_inicio && <div>📅 {formatDate(ev.data_inicio)}{faltam != null && faltam <= 30 ? <span className="ml-1 text-brand">· {faltam === 0 ? 'hoje!' : `faltam ${faltam} dia(s)`}</span> : null}</div>}
        {local && <div className="truncate">📍 {local}</div>}
      </div>
      <div className="mt-4">
        {ev.portal_ativo ? <span className="text-[.82rem] font-semibold text-brand">Acompanhar evento →</span> : <span className="text-[.78rem] text-amber-600">Portal indisponível no momento</span>}
      </div>
    </div>
  )
  return ev.portal_ativo ? <Link href={`/client/eventos/${ev.evento_id}`} className="block">{inner}</Link> : <div>{inner}</div>
}
