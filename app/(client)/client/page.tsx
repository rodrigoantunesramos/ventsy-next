'use client'

// Início do contratante — /client. Centrado em "Meus Eventos": destaca o próximo
// evento e as pendências acionáveis (parcela a vencer, contrato a assinar), que
// vêm agregadas de /api/portal/cliente (action 'resumo'). Favoritos/conversas/
// avaliações entram como atalhos secundários. Sem `return null` — usa skeletons.

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import PropertyCard from '@/components/PropertyCard'
import { useFavorites } from '@/hooks/useFavorites'
import { formatMoney, formatDate } from '@/lib/format'
import { portalClienteApi } from './eventos/_lib'
import type { Favorite, Conversation } from '@/types/client'

type EventoResumoLite = {
  evento_id: string
  nome_evento: string | null
  tipo_evento: string | null
  data_inicio: string | null
  data_fim: string | null
  status: string | null
  propriedade: { nome: string | null; cidade: string | null; estado: string | null } | null
  portal_ativo: boolean
  dias_ate: number | null
}
type ProximaParcela = { evento_id: string; nome_evento: string | null; valor: number; vencimento: string | null; descricao: string | null; numero: number | null; vencida: boolean } | null
type ContratoPendente = { evento_id: string; nome_evento: string | null } | null

export default function ClientDashboard() {
  const router = useRouter()
  const { toggle } = useFavorites()

  const [nome, setNome] = useState('')
  const [eventos, setEventos] = useState<EventoResumoLite[]>([])
  const [proxParcela, setProxParcela] = useState<ProximaParcela>(null)
  const [contratoPend, setContratoPend] = useState<ContratoPendente>(null)
  const [favoritos, setFavoritos] = useState<Favorite[]>([])
  const [conversas, setConversas] = useState<Conversation[]>([])
  const [avaliacoesCount, setAvaliacoesCount] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }
      const uid = session.user.id
      const headers = { Authorization: `Bearer ${session.access_token}` }

      let primeiroNome = session.user.email?.split('@')[0] ?? ''
      try {
        const { data: perfil } = await supabase.from('usuarios').select('nome').eq('id', uid).single()
        if (perfil?.nome) primeiroNome = String(perfil.nome).split(' ')[0]
      } catch { /* perfil opcional */ }
      setNome(primeiroNome)

      const [resumo, favRes, convRes, avalRes] = await Promise.all([
        portalClienteApi('resumo').catch(() => ({ eventos: [], proxima_parcela: null, contrato_pendente: null })),
        fetch('/api/favoritos', { headers }).then((r) => r.json()).catch(() => ({ data: [] })),
        fetch('/api/conversas', { headers }).then((r) => r.json()).catch(() => ({ data: [] })),
        fetch(`/api/avaliacoes?user_id=${uid}`, { headers }).then((r) => r.json()).catch(() => ({ data: [] })),
      ])

      setEventos((resumo.eventos as EventoResumoLite[]) || [])
      setProxParcela((resumo.proxima_parcela as ProximaParcela) ?? null)
      setContratoPend((resumo.contrato_pendente as ContratoPendente) ?? null)
      setFavoritos((favRes.data || []) as Favorite[])
      setConversas(((convRes.data || []) as Conversation[]).filter((c) => c.papel !== 'dono'))
      setAvaliacoesCount(((avalRes.data || []) as unknown[]).length)
      setLoading(false)
    })()
  }, [router])

  const temPendencia = !!proxParcela || !!contratoPend
  const semNada = !loading && eventos.length === 0 && favoritos.length === 0 && conversas.length === 0

  return (
    <div className="mx-auto max-w-[980px] px-6 py-7">
      {/* Cabeçalho */}
      <div className="mb-6">
        <h1 className="m-0 text-[1.5rem] font-extrabold text-gray-900">
          {nome ? `Olá, ${nome} 👋` : 'Bem-vindo à sua área 🎉'}
        </h1>
        <p className="mt-1.5 text-[.88rem] text-gray-400">Acompanhe seus eventos, conversas e favoritos em um só lugar.</p>
      </div>

      {loading ? (
        <DashboardSkeleton />
      ) : (
        <>
          {/* Pendências acionáveis */}
          {temPendencia && (
            <section className="mb-7">
              <h2 className="mb-3 text-[1.05rem] font-bold text-gray-900">⚡ Precisa da sua atenção</h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {proxParcela && (
                  <Link href={`/client/eventos/${proxParcela.evento_id}`} className="no-underline">
                    <div className={`flex items-center justify-between gap-3 rounded-2xl border p-4 shadow-[0_2px_12px_rgba(0,0,0,.05)] transition-transform hover:-translate-y-0.5 ${proxParcela.vencida ? 'border-red-200 bg-red-50' : 'border-amber-200 bg-amber-50'}`}>
                      <div className="min-w-0">
                        <div className={`text-[.78rem] font-semibold ${proxParcela.vencida ? 'text-red-700' : 'text-amber-700'}`}>
                          💳 {proxParcela.vencida ? 'Parcela vencida' : 'Parcela a vencer'}
                        </div>
                        <div className="mt-0.5 truncate text-[.85rem] font-bold text-gray-900">{formatMoney(proxParcela.valor)}</div>
                        <div className="truncate text-[.76rem] text-gray-500">
                          {proxParcela.nome_evento || 'Seu evento'}
                          {proxParcela.vencimento ? ` · vence ${formatDate(proxParcela.vencimento)}` : ''}
                        </div>
                      </div>
                      <span className="shrink-0 rounded-xl bg-[#ff385c] px-3.5 py-2 text-[.8rem] font-semibold text-white">Pagar</span>
                    </div>
                  </Link>
                )}
                {contratoPend && (
                  <Link href={`/client/eventos/${contratoPend.evento_id}`} className="no-underline">
                    <div className="flex items-center justify-between gap-3 rounded-2xl border border-sky-200 bg-sky-50 p-4 shadow-[0_2px_12px_rgba(0,0,0,.05)] transition-transform hover:-translate-y-0.5">
                      <div className="min-w-0">
                        <div className="text-[.78rem] font-semibold text-sky-700">📄 Contrato a assinar</div>
                        <div className="mt-0.5 truncate text-[.85rem] font-bold text-gray-900">{contratoPend.nome_evento || 'Seu evento'}</div>
                        <div className="truncate text-[.76rem] text-gray-500">Aguardando sua assinatura</div>
                      </div>
                      <span className="shrink-0 rounded-xl bg-[#ff385c] px-3.5 py-2 text-[.8rem] font-semibold text-white">Ver e assinar</span>
                    </div>
                  </Link>
                )}
              </div>
            </section>
          )}

          {/* Meus Eventos */}
          {eventos.length > 0 && (
            <section className="mb-8">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="m-0 text-[1.05rem] font-bold text-gray-900">🎫 Meus eventos</h2>
                <Link href="/client/eventos" className="text-[.82rem] text-[#ff385c] no-underline">Ver todos →</Link>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {eventos.slice(0, 4).map((ev) => <EventoCard key={ev.evento_id} ev={ev} />)}
              </div>
            </section>
          )}

          {/* Atalhos / stats */}
          <section className="mb-8 grid grid-cols-3 gap-3">
            <StatLink icon="❤️" label="Favoritos" value={favoritos.length} href="/client/favoritos" color="#ff385c" bg="#fff5f6" />
            <StatLink icon="💬" label="Conversas" value={conversas.length} href="/client/conversas" color="#3b82f6" bg="#f0f9ff" />
            <StatLink icon="⭐" label="Avaliações" value={avaliacoesCount} href="/client/avaliacoes" color="#d97706" bg="#fffbeb" />
          </section>

          {/* Favoritos recentes */}
          {favoritos.length > 0 && (
            <section className="mb-8">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="m-0 text-[1.05rem] font-bold text-gray-900">❤️ Favoritos recentes</h2>
                <Link href="/client/favoritos" className="text-[.82rem] text-[#ff385c] no-underline">Ver todos →</Link>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {favoritos.slice(0, 4).map((fav) => fav.propriedade && (
                  <PropertyCard
                    key={fav.id}
                    property={fav.propriedade}
                    isFavorite
                    onToggleFavorite={() => toggle(fav.property_id)}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Vazio total */}
          {semNada && (
            <div className="px-5 py-16 text-center text-gray-300">
              <div className="mb-3 text-[3rem]">🗺️</div>
              <div className="mb-1.5 text-base font-semibold text-gray-400">Comece a explorar!</div>
              <div className="text-[.85rem]">Favorite espaços, converse com proprietários e acompanhe seus eventos por aqui.</div>
              <Link href="/busca" className="mt-5 inline-block rounded-xl bg-[#ff385c] px-6 py-2.5 text-[.9rem] font-bold text-white no-underline transition-colors hover:bg-[#e0304f]">
                🔍 Explorar espaços
              </Link>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ── Card de evento (mesma linguagem visual de /client/eventos) ────────────────
function EventoCard({ ev }: { ev: EventoResumoLite }) {
  const local = ev.propriedade ? [ev.propriedade.nome, ev.propriedade.cidade].filter(Boolean).join(' · ') : null
  const faltam = ev.dias_ate != null && ev.dias_ate >= 0 ? ev.dias_ate : null
  const inner = (
    <div className={`h-full rounded-2xl border border-[#f0f0f0] bg-white p-5 shadow-[0_2px_12px_rgba(0,0,0,.05)] transition-transform ${ev.portal_ativo ? 'cursor-pointer hover:-translate-y-0.5' : 'opacity-70'}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-[1rem] font-bold text-gray-900">{ev.nome_evento || 'Meu evento'}</div>
          {ev.tipo_evento && <div className="mt-0.5 text-[.78rem] text-gray-400">{ev.tipo_evento}</div>}
        </div>
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#fff5f6] text-[1.3rem]">🎉</div>
      </div>
      <div className="mt-3 space-y-1 text-[.82rem] text-gray-500">
        {ev.data_inicio && <div>📅 {formatDate(ev.data_inicio)}{faltam != null && faltam <= 30 ? <span className="ml-1 text-[#ff385c]">· {faltam === 0 ? 'hoje!' : `faltam ${faltam} dia(s)`}</span> : null}</div>}
        {local && <div className="truncate">📍 {local}</div>}
      </div>
      <div className="mt-4">
        {ev.portal_ativo
          ? <span className="text-[.82rem] font-semibold text-[#ff385c]">Acompanhar evento →</span>
          : <span className="text-[.78rem] text-amber-600">Portal indisponível no momento</span>}
      </div>
    </div>
  )
  return ev.portal_ativo
    ? <Link href={`/client/eventos/${ev.evento_id}`} className="no-underline">{inner}</Link>
    : <div>{inner}</div>
}

function StatLink({ icon, label, value, href, color, bg }: { icon: string; label: string; value: number; href: string; color: string; bg: string }) {
  return (
    <Link href={href} className="no-underline">
      <div className="flex items-center gap-3 rounded-[14px] border border-[#f0f0f0] bg-white px-4 py-3.5 shadow-[0_2px_12px_rgba(0,0,0,.05)] transition-transform hover:-translate-y-0.5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[1.2rem]" style={{ background: bg }}>{icon}</div>
        <div className="min-w-0">
          <div className="text-[1.3rem] font-extrabold leading-none" style={{ color }}>{value}</div>
          <div className="mt-0.5 truncate text-[.74rem] text-gray-400">{label}</div>
        </div>
      </div>
    </Link>
  )
}

function DashboardSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="mb-7 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="h-24 rounded-2xl bg-black/[0.05]" />
        <div className="h-24 rounded-2xl bg-black/[0.05]" />
      </div>
      <div className="mb-3 h-5 w-40 rounded bg-black/[0.05]" />
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="h-32 rounded-2xl bg-black/[0.05]" />
        <div className="h-32 rounded-2xl bg-black/[0.05]" />
      </div>
      <div className="grid grid-cols-3 gap-3">
        {[0, 1, 2].map((i) => <div key={i} className="h-16 rounded-[14px] bg-black/[0.05]" />)}
      </div>
    </div>
  )
}
