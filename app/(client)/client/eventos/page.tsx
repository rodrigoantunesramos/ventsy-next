'use client'
// Meus Eventos — (client)/eventos. Lista os eventos a que o contratante tem
// acesso pelo Portal do Cliente. Ao chegar pelo link de convite (?convite=token),
// vincula o acesso ao usuário logado. Os dados vêm de /api/portal/cliente
// (service-role, valida o acesso) — o cliente nunca lê as tabelas direto.

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { formatDate } from '@/lib/format'
import { portalClienteApi, type EventoResumo } from './_lib'

export default function MeusEventosPage() {
  const router = useRouter()
  const [eventos, setEventos] = useState<EventoResumo[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }
      // Lê o token do convite direto da URL (evita exigir Suspense do useSearchParams).
      const convite = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('convite') : null
      try {
        const r = await portalClienteApi('meus_eventos', convite ? { token: convite } : {})
        setEventos(((r.eventos as EventoResumo[]) || []))
        // Limpa o ?convite= da URL após o claim (não fica no histórico).
        if (convite && typeof window !== 'undefined') window.history.replaceState({}, '', '/client/eventos')
      } catch (e) {
        setErro(e instanceof Error ? e.message : 'Não foi possível carregar seus eventos.')
      } finally {
        setLoading(false)
      }
    })()
  }, [router])

  return (
    <div className="mx-auto max-w-[980px] px-6 py-7">
      <div className="mb-6">
        <h1 className="m-0 text-[1.5rem] font-extrabold text-gray-900">🎫 Meus Eventos</h1>
        <p className="mt-1.5 text-[.88rem] text-gray-400">Acompanhe tudo do seu evento: pagamentos, contrato, convidados e conversas com o organizador.</p>
      </div>

      {loading && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {[0, 1].map((i) => <div key={i} className="h-32 animate-pulse rounded-2xl bg-black/[0.05]" />)}
        </div>
      )}

      {!loading && erro && (
        <div className="rounded-2xl border border-red-100 bg-red-50 p-5 text-sm text-red-700">{erro}</div>
      )}

      {!loading && !erro && eventos.length === 0 && (
        <div className="rounded-2xl border border-[#f0f0f0] bg-white px-5 py-14 text-center shadow-[0_2px_12px_rgba(0,0,0,.05)]">
          <div className="mb-3 text-[3rem]">📭</div>
          <div className="mb-1.5 text-base font-semibold text-gray-500">Nenhum evento por aqui ainda</div>
          <div className="mx-auto max-w-md text-[.85rem] text-gray-400">
            Quando um organizador liberar o acesso ao seu evento, ele aparece aqui. Use o link do convite que você recebeu por e-mail — entre com o mesmo e-mail do convite.
          </div>
        </div>
      )}

      {!loading && !erro && eventos.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {eventos.map((ev) => {
            const local = ev.propriedade ? [ev.propriedade.nome, ev.propriedade.cidade].filter(Boolean).join(' · ') : null
            const conteudo = (
              <div className={`h-full rounded-2xl border border-[#f0f0f0] bg-white p-5 shadow-[0_2px_12px_rgba(0,0,0,.05)] transition-transform ${ev.portal_ativo ? 'cursor-pointer hover:-translate-y-0.5' : 'opacity-70'}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-[1rem] font-bold text-gray-900">{ev.nome_evento || 'Meu evento'}</div>
                    {ev.tipo_evento && <div className="mt-0.5 text-[.78rem] text-gray-400">{ev.tipo_evento}</div>}
                  </div>
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#fff5f6] text-[1.3rem]">🎉</div>
                </div>
                <div className="mt-3 space-y-1 text-[.82rem] text-gray-500">
                  {ev.data_inicio && <div>📅 {formatDate(ev.data_inicio)}</div>}
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
              ? <Link key={ev.evento_id} href={`/client/eventos/${ev.evento_id}`} className="no-underline">{conteudo}</Link>
              : <div key={ev.evento_id}>{conteudo}</div>
          })}
        </div>
      )}
    </div>
  )
}
