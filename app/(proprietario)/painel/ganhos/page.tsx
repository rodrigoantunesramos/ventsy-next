'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { supabase, supabaseAny } from '@/lib/supabase'
import { calcularTaxas, brl } from '@/lib/fees'

type Reserva = {
  id: string
  propriedade_id: number
  host_id: string | null
  usuario_id: string
  nome: string | null
  tipo_evento: string | null
  modo: string | null
  data_inicio: string | null
  data_fim: string | null
  horas: number | null
  pessoas: number | null
  valor_estimado: number | null
  status: string
  criado_em: string
  propriedade?: { id: number; nome: string | null; cidade: string | null; estado: string | null } | null
}

// status que representam dinheiro confirmado para o anfitrião
const CONFIRMADAS = new Set(['paga', 'confirmada', 'realizada', 'avaliada'])

const STATUS: Record<string, { label: string; cls: string }> = {
  solicitada: { label: 'Solicitada', cls: 'bg-amber-100 text-amber-700' },
  aprovada: { label: 'Aprovada', cls: 'bg-sky-100 text-sky-700' },
  recusada: { label: 'Recusada', cls: 'bg-red-100 text-red-700' },
  paga: { label: 'Paga', cls: 'bg-emerald-100 text-emerald-700' },
  confirmada: { label: 'Confirmada', cls: 'bg-emerald-100 text-emerald-700' },
  realizada: { label: 'Realizada', cls: 'bg-gray-100 text-gray-600' },
  cancelada: { label: 'Cancelada', cls: 'bg-gray-100 text-gray-500' },
  avaliada: { label: 'Avaliada', cls: 'bg-gray-100 text-gray-600' },
}

function periodo(r: Reserva) {
  const f = (d: string | null) => (d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR') : '—')
  if (r.modo === 'diaria') return `${f(r.data_inicio)}${r.data_fim ? ' — ' + f(r.data_fim) : ''}`
  if (r.modo === 'hora') return `${f(r.data_inicio)} · ${r.horas || 0}h`
  return f(r.data_inicio)
}

function Kpi({ label, valor, sub, destaque }: { label: string; valor: string; sub?: string; destaque?: boolean }) {
  return (
    <div className={`rounded-2xl border p-5 ${destaque ? 'border-brand/30 bg-brand/5' : 'border-gray-200 bg-white'} shadow-card`}>
      <p className="text-sm text-ink-muted">{label}</p>
      <p className={`font-display font-black tracking-tight mt-1 ${destaque ? 'text-brand text-3xl' : 'text-ink text-2xl'}`}>{valor}</p>
      {sub && <p className="text-xs text-ink-muted mt-1">{sub}</p>}
    </div>
  )
}

export default function GanhosPage() {
  const [userId, setUserId] = useState<string | null>(null)
  const [authChecked, setAuthChecked] = useState(false)
  const [reservas, setReservas] = useState<Reserva[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async (uid: string) => {
    setLoading(true)
    const { data } = await supabaseAny
      .from('reservas')
      .select('*, propriedade:propriedades(id,nome,cidade,estado)')
      .order('criado_em', { ascending: false })
    setReservas(((data || []) as Reserva[]).filter((r) => r.host_id === uid))
    setLoading(false)
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setAuthChecked(true)
      if (session) { setUserId(session.user.id); load(session.user.id) }
      else setLoading(false)
    })
  }, [load])

  const confirmadas = reservas.filter((r) => CONFIRMADAS.has(r.status))
  const val = (r: Reserva) => Number(r.valor_estimado) || 0
  const faturamento = confirmadas.reduce((s, r) => s + val(r), 0)
  const repasse = confirmadas.reduce((s, r) => s + calcularTaxas(val(r)).repasseAnfitriao, 0)
  const comissao = confirmadas.reduce((s, r) => s + calcularTaxas(val(r)).comissaoVentsy, 0)
  const aReceber = reservas.filter((r) => r.status === 'aprovada').reduce((s, r) => s + calcularTaxas(val(r)).repasseAnfitriao, 0)
  const pendentes = reservas.filter((r) => r.status === 'solicitada').length
  const aprovadas = reservas.filter((r) => r.status === 'aprovada').length

  // contagem por status (ordem definida)
  const ordemStatus = ['solicitada', 'aprovada', 'paga', 'confirmada', 'realizada', 'avaliada', 'recusada', 'cancelada']
  const counts = ordemStatus
    .map((s) => ({ s, n: reservas.filter((r) => r.status === s).length }))
    .filter((x) => x.n > 0)

  // ganhos por espaço (confirmadas)
  const espMap = new Map<number, { nome: string; total: number; count: number }>()
  confirmadas.forEach((r) => {
    const cur = espMap.get(r.propriedade_id) || { nome: r.propriedade?.nome || `Espaço #${r.propriedade_id}`, total: 0, count: 0 }
    cur.total += calcularTaxas(val(r)).repasseAnfitriao
    cur.count += 1
    espMap.set(r.propriedade_id, cur)
  })
  const porEspaco = Array.from(espMap.values()).sort((a, b) => b.total - a.total)

  return (
    <>
      <div className="mx-auto max-w-5xl">
        <div className="flex items-center justify-between gap-3 mb-8 flex-wrap">
          <div>
            <h1 className="font-display text-3xl md:text-4xl font-black text-ink tracking-tight">Reservas &amp; Ganhos</h1>
            <p className="text-ink-muted mt-1">Ganhos das suas reservas online (marketplace). Para o caixa completo do negócio de eventos, veja o <Link href="/painel/financeiro" className="text-brand font-semibold underline">Financeiro</Link>.</p>
          </div>
          <Link href="/painel/reservas" className="bg-ink hover:bg-ink-soft text-white font-bold text-sm rounded-xl px-5 py-2.5 transition-colors">Gerenciar reservas →</Link>
        </div>

        {!authChecked || loading ? (
          <p className="text-ink-muted py-10 text-center">Carregando...</p>
        ) : !userId ? (
          <div className="rounded-2xl border border-gray-200 bg-white shadow-card p-8 text-center">
            <p className="text-ink-soft mb-4">Entre na sua conta para ver seus ganhos.</p>
            <Link href="/login" className="inline-block bg-brand hover:bg-brand-600 text-white font-bold rounded-xl px-6 py-3 transition-colors">Entrar</Link>
          </div>
        ) : reservas.length === 0 ? (
          <div className="rounded-2xl border border-gray-200 bg-white shadow-card p-8 text-center">
            <p className="text-ink-soft mb-2">Você ainda não recebeu nenhuma reserva.</p>
            <p className="text-ink-muted text-sm mb-5">Quando alguém reservar um dos seus espaços, os ganhos aparecem aqui.</p>
            <Link href="/painel/meus-espacos" className="inline-block bg-brand hover:bg-brand-600 text-white font-bold rounded-xl px-6 py-3 transition-colors">Ver meus espaços</Link>
          </div>
        ) : (
          <div className="space-y-10">
            {/* KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <Kpi label="Seu repasse líquido" valor={brl(repasse)} sub={`de ${confirmadas.length} reserva${confirmadas.length === 1 ? '' : 's'} confirmada${confirmadas.length === 1 ? '' : 's'}`} destaque />
              <Kpi label="Faturamento confirmado" valor={brl(faturamento)} sub="valor total das reservas pagas" />
              <Kpi label="Comissão Ventsy" valor={brl(comissao)} sub={`modelo ${calcularTaxas(100).modelo === 'anfitriao' ? '15% anfitrião' : 'dividido'}`} />
              <Kpi label="A receber" valor={brl(aReceber)} sub={`${aprovadas} aprovada${aprovadas === 1 ? '' : 's'} aguardando pgto.`} />
            </div>

            {pendentes > 0 && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 flex items-center justify-between gap-3 flex-wrap">
                <span className="text-sm text-amber-800 font-medium">
                  Você tem <strong>{pendentes}</strong> solicitação{pendentes > 1 ? 'ões' : ''} aguardando sua aprovação.
                </span>
                <Link href="/painel/reservas" className="text-sm font-bold text-amber-900 underline">Revisar agora →</Link>
              </div>
            )}

            {/* Status breakdown */}
            {counts.length > 0 && (
              <section>
                <h2 className="font-display text-lg font-bold text-ink mb-3">Reservas por status</h2>
                <div className="flex flex-wrap gap-2">
                  {counts.map(({ s, n }) => {
                    const st = STATUS[s] || { label: s, cls: 'bg-gray-100 text-gray-600' }
                    return (
                      <span key={s} className={`inline-flex items-center gap-2 text-sm font-semibold px-3 py-1.5 rounded-full ${st.cls}`}>
                        {st.label}<span className="font-black">{n}</span>
                      </span>
                    )
                  })}
                </div>
              </section>
            )}

            {/* Ganhos por espaço */}
            {porEspaco.length > 0 && (
              <section>
                <h2 className="font-display text-lg font-bold text-ink mb-3">Ganhos por espaço</h2>
                <div className="grid sm:grid-cols-2 gap-4">
                  {porEspaco.map((e, i) => (
                    <div key={i} className="rounded-2xl border border-gray-200 bg-white shadow-card p-5 flex items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold text-ink">{e.nome}</p>
                        <p className="text-xs text-ink-muted">{e.count} reserva{e.count === 1 ? '' : 's'} confirmada{e.count === 1 ? '' : 's'}</p>
                      </div>
                      <p className="font-display text-xl font-black text-ink">{brl(e.total)}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Detalhamento */}
            <section>
              <h2 className="font-display text-lg font-bold text-ink mb-3">Detalhamento das reservas</h2>
              <div className="rounded-2xl border border-gray-200 bg-white shadow-card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 text-ink-muted text-left">
                        <th className="px-4 py-3 font-semibold">Espaço</th>
                        <th className="px-4 py-3 font-semibold whitespace-nowrap">Quando</th>
                        <th className="px-4 py-3 font-semibold">Status</th>
                        <th className="px-4 py-3 font-semibold text-right whitespace-nowrap">Valor</th>
                        <th className="px-4 py-3 font-semibold text-right whitespace-nowrap">Sua parte</th>
                        <th className="px-4 py-3 font-semibold text-right whitespace-nowrap">Comissão</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reservas.map((r) => {
                        const t = calcularTaxas(val(r))
                        const st = STATUS[r.status] || { label: r.status, cls: 'bg-gray-100 text-gray-600' }
                        const conf = CONFIRMADAS.has(r.status)
                        return (
                          <tr key={r.id} className="border-t border-gray-100 hover:bg-gray-50/60">
                            <td className="px-4 py-3">
                              <Link href={`/propriedade/${r.propriedade_id}`} className="font-medium text-ink hover:text-brand transition-colors">
                                {r.propriedade?.nome || `Espaço #${r.propriedade_id}`}
                              </Link>
                            </td>
                            <td className="px-4 py-3 text-ink-soft whitespace-nowrap">{periodo(r)}</td>
                            <td className="px-4 py-3"><span className={`text-xs font-bold px-2 py-0.5 rounded-full ${st.cls}`}>{st.label}</span></td>
                            <td className="px-4 py-3 text-right text-ink-soft whitespace-nowrap">{val(r) > 0 ? brl(val(r)) : '—'}</td>
                            <td className={`px-4 py-3 text-right whitespace-nowrap font-semibold ${conf ? 'text-ink' : 'text-ink-muted'}`}>{val(r) > 0 ? brl(t.repasseAnfitriao) : '—'}</td>
                            <td className="px-4 py-3 text-right text-ink-muted whitespace-nowrap">{val(r) > 0 ? brl(t.comissaoVentsy) : '—'}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
              <p className="text-xs text-ink-muted mt-3">
                &ldquo;Sua parte&rdquo; é o repasse líquido após a comissão da Ventsy. Os repasses caem direto na sua conta Mercado Pago quando conectada —{' '}
                <Link href="/painel/reservas" className="text-brand font-semibold underline">configurar recebimentos</Link>.
              </p>
            </section>
          </div>
        )}
      </div>
    </>
  )
}
