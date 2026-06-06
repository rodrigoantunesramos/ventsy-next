'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import { supabase, supabaseAny, authHeaders } from '@/lib/supabase'
import CheckoutReserva from '@/components/CheckoutReserva'

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

type Prop = { id: number; nome: string | null }
type Bloqueio = { prop_id: number; data: string; motivo: string | null }

const STATUS: Record<string, { label: string; cls: string }> = {
  solicitada: { label: 'Solicitada', cls: 'bg-amber-100 text-amber-700' },
  aprovada: { label: 'Aprovada', cls: 'bg-emerald-100 text-emerald-700' },
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

function brl(v: number | null) {
  return v && v > 0 ? v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'A combinar'
}

function Card({ r, papel, onStatus, onPagar }: { r: Reserva; papel: 'host' | 'guest'; onStatus: (id: string, s: string) => void; onPagar?: (r: Reserva) => void }) {
  const s = STATUS[r.status] || { label: r.status, cls: 'bg-gray-100 text-gray-600' }
  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Link href={`/propriedade/${r.propriedade_id}`} className="font-display text-lg font-bold text-ink hover:text-brand transition-colors">
            {r.propriedade?.nome || `Espaço #${r.propriedade_id}`}
          </Link>
          <p className="text-sm text-ink-muted">{[r.propriedade?.cidade, r.propriedade?.estado].filter(Boolean).join(', ')}</p>
        </div>
        <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${s.cls}`}>{s.label}</span>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 mt-4 text-sm">
        <div><span className="text-ink-muted">Quando:</span> <span className="font-medium text-ink-soft">{periodo(r)}</span></div>
        <div><span className="text-ink-muted">Pessoas:</span> <span className="font-medium text-ink-soft">{r.pessoas || '—'}</span></div>
        <div><span className="text-ink-muted">Evento:</span> <span className="font-medium text-ink-soft">{r.tipo_evento || '—'}</span></div>
        <div><span className="text-ink-muted">Estimativa:</span> <span className="font-medium text-ink-soft">{brl(r.valor_estimado)}</span></div>
        {papel === 'host' && r.nome && (
          <div className="col-span-2"><span className="text-ink-muted">Solicitante:</span> <span className="font-medium text-ink-soft">{r.nome}</span></div>
        )}
      </div>

      {papel === 'host' && r.status === 'solicitada' && (
        <div className="flex gap-2 mt-4">
          <button onClick={() => onStatus(r.id, 'aprovada')} className="flex-1 bg-brand hover:bg-brand-600 text-white text-sm font-bold rounded-xl py-2.5 transition-colors">Aprovar</button>
          <button onClick={() => onStatus(r.id, 'recusada')} className="flex-1 bg-white border border-gray-300 hover:border-gray-400 text-ink-soft text-sm font-semibold rounded-xl py-2.5 transition-colors">Recusar</button>
        </div>
      )}
      {papel === 'guest' && r.status === 'aprovada' && onPagar && (
        <button onClick={() => onPagar(r)} className="w-full mt-4 bg-brand hover:bg-brand-600 text-white text-sm font-bold rounded-xl py-2.5 transition-colors">Pagar agora</button>
      )}
      {papel === 'guest' && (r.status === 'solicitada' || r.status === 'aprovada') && (
        <div className="mt-3">
          <button onClick={() => onStatus(r.id, 'cancelada')} className="text-sm text-ink-muted hover:text-red-600 font-medium underline transition-colors">Cancelar solicitação</button>
        </div>
      )}
    </div>
  )
}

export default function ReservasPage() {
  const [userId, setUserId] = useState<string | null>(null)
  const [authChecked, setAuthChecked] = useState(false)
  const [reservas, setReservas] = useState<Reserva[]>([])
  const [props, setProps] = useState<Prop[]>([])
  const [bloqueios, setBloqueios] = useState<Bloqueio[]>([])
  const [loading, setLoading] = useState(true)
  const [selProp, setSelProp] = useState<number | ''>('')
  const [selData, setSelData] = useState('')
  const [toast, setToast] = useState('')
  const [pagar, setPagar] = useState<Reserva | null>(null)
  const [userEmail, setUserEmail] = useState('')
  const [mpConectado, setMpConectado] = useState<boolean | null>(null)

  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 4000) }

  const load = useCallback(async (uid: string) => {
    setLoading(true)
    const [{ data: rs }, { data: ps }] = await Promise.all([
      supabaseAny.from('reservas').select('*, propriedade:propriedades(id,nome,cidade,estado)').order('criado_em', { ascending: false }),
      supabaseAny.from('propriedades').select('id,nome').eq('usuario_id', uid),
    ])
    setReservas((rs || []) as Reserva[])
    const properties = (ps || []) as Prop[]
    setProps(properties)
    if (properties.length) {
      setSelProp((cur) => (cur === '' ? properties[0].id : cur))
      const { data: bs } = await supabaseAny.from('disponibilidade').select('prop_id,data,motivo').in('prop_id', properties.map((p) => p.id)).order('data')
      setBloqueios((bs || []) as Bloqueio[])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setAuthChecked(true)
      if (session) { setUserId(session.user.id); setUserEmail(session.user.email || ''); load(session.user.id) }
      else setLoading(false)
    })
  }, [load])

  useEffect(() => {
    if (!userId) return
    authHeaders().then((h) =>
      fetch('/api/mp/status', { headers: h }).then((r) => r.json()).then((j) => setMpConectado(!!j.conectado)).catch(() => {}),
    )
    const p = new URLSearchParams(window.location.search).get('mp')
    if (p === 'conectado') { flash('✅ Mercado Pago conectado! Você já pode receber pagamentos.'); window.history.replaceState({}, '', '/reservas') }
    else if (p === 'erro') { flash('Não foi possível conectar o Mercado Pago. Tente novamente.'); window.history.replaceState({}, '', '/reservas') }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  const onStatus = async (id: string, status: string) => {
    const prev = reservas
    setReservas((p) => p.map((r) => (r.id === id ? { ...r, status } : r)))
    const { error } = await supabaseAny.from('reservas').update({ status }).eq('id', id)
    if (error) { setReservas(prev); flash(error.message || 'Não foi possível atualizar a reserva.') }
  }

  const bloquear = async () => {
    if (selProp === '' || !selData) return
    if (bloqueios.some((b) => b.prop_id === selProp && b.data === selData)) { flash('Essa data já está bloqueada.'); return }
    const { error } = await supabaseAny.from('disponibilidade').insert({ prop_id: selProp, data: selData, motivo: 'Bloqueado pelo anfitrião' })
    if (error) { flash(error.message); return }
    setBloqueios((b) => [...b, { prop_id: selProp as number, data: selData, motivo: 'Bloqueado pelo anfitrião' }].sort((a, z) => a.data.localeCompare(z.data)))
    setSelData('')
  }

  const desbloquear = async (prop_id: number, data: string) => {
    setBloqueios((b) => b.filter((x) => !(x.prop_id === prop_id && x.data === data)))
    await supabaseAny.from('disponibilidade').delete().eq('prop_id', prop_id).eq('data', data)
  }

  const conectarMP = async () => {
    const res = await fetch('/api/mp/oauth/start', { headers: await authHeaders() })
    const json = await res.json()
    if (json.url) window.location.href = json.url
    else flash(json.error || 'Não foi possível iniciar a conexão com o Mercado Pago.')
  }

  const minhas = reservas.filter((r) => r.usuario_id === userId)
  const recebidas = reservas.filter((r) => r.host_id === userId)
  const pendentes = recebidas.filter((r) => r.status === 'solicitada').length

  return (
    <>
      <Header />
      <main className="max-w-4xl mx-auto px-5 pt-28 pb-20">
        <h1 className="font-display text-3xl md:text-4xl font-black text-ink tracking-tight mb-8">Minhas reservas</h1>

        {!authChecked || loading ? (
          <p className="text-ink-muted py-10 text-center">Carregando...</p>
        ) : !userId ? (
          <div className="rounded-2xl border border-gray-200 bg-white shadow-card p-8 text-center">
            <p className="text-ink-soft mb-4">Entre na sua conta para ver suas reservas e solicitações.</p>
            <Link href="/login" className="inline-block bg-brand hover:bg-brand-600 text-white font-bold rounded-xl px-6 py-3 transition-colors">Entrar</Link>
          </div>
        ) : (
          <div className="space-y-12">
            <section>
              <h2 className="font-display text-xl font-bold text-ink mb-4 flex items-center gap-2">
                Recebidas (sou anfitrião)
                <span className="text-ink-muted font-sans text-base font-normal">· {recebidas.length}</span>
                {pendentes > 0 && <span className="text-xs font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">{pendentes} pendente{pendentes > 1 ? 's' : ''}</span>}
              </h2>
              {recebidas.length === 0 ? (
                <p className="text-ink-muted text-sm">Nenhuma solicitação recebida ainda.</p>
              ) : (
                <div className="grid sm:grid-cols-2 gap-4">{recebidas.map((r) => <Card key={r.id} r={r} papel="host" onStatus={onStatus} />)}</div>
              )}
            </section>

            <section>
              <h2 className="font-display text-xl font-bold text-ink mb-4">Minhas solicitações (sou hóspede) <span className="text-ink-muted font-sans text-base font-normal">· {minhas.length}</span></h2>
              {minhas.length === 0 ? (
                <p className="text-ink-muted text-sm">Você ainda não solicitou nenhuma reserva. <Link href="/busca" className="text-brand font-semibold underline">Explorar espaços</Link></p>
              ) : (
                <div className="grid sm:grid-cols-2 gap-4">{minhas.map((r) => <Card key={r.id} r={r} papel="guest" onStatus={onStatus} onPagar={setPagar} />)}</div>
              )}
            </section>

            {props.length > 0 && (
              <section>
                <h2 className="font-display text-xl font-bold text-ink mb-1">Recebimentos</h2>
                <p className="text-sm text-ink-muted mb-4">Conecte sua conta Mercado Pago para receber os pagamentos direto na sua conta — a Ventsy retém apenas a comissão.</p>
                <div className="rounded-2xl border border-gray-200 bg-white shadow-card p-5 flex items-center justify-between gap-4 flex-wrap">
                  {mpConectado === true ? (
                    <span className="text-sm font-semibold text-emerald-700 inline-flex items-center gap-2">✅ Conta Mercado Pago conectada</span>
                  ) : (
                    <>
                      <span className="text-sm text-ink-soft">Sua conta ainda não está conectada.</span>
                      <button onClick={conectarMP} className="bg-[#009ee3] hover:brightness-95 text-white text-sm font-bold rounded-xl px-5 py-2.5 transition">Conectar Mercado Pago</button>
                    </>
                  )}
                </div>
              </section>
            )}

            {props.length > 0 && (
              <section>
                <h2 className="font-display text-xl font-bold text-ink mb-1">Disponibilidade dos meus espaços</h2>
                <p className="text-sm text-ink-muted mb-4">Bloqueie datas em que o espaço não pode ser reservado.</p>
                <div className="rounded-2xl border border-gray-200 bg-white shadow-card p-5">
                  <div className="flex flex-wrap items-end gap-3">
                    <div className="flex-1 min-w-[180px]">
                      <label className="block text-sm font-semibold text-ink-soft mb-1.5">Espaço</label>
                      <select value={selProp} onChange={(e) => setSelProp(Number(e.target.value))} className="w-full border border-gray-300 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20">
                        {props.map((p) => <option key={p.id} value={p.id}>{p.nome || `Espaço #${p.id}`}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-ink-soft mb-1.5">Data</label>
                      <input type="date" value={selData} min={new Date().toISOString().split('T')[0]} onChange={(e) => setSelData(e.target.value)} className="border border-gray-300 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20" />
                    </div>
                    <button onClick={bloquear} disabled={selProp === '' || !selData} className="bg-ink hover:bg-ink-soft disabled:opacity-50 text-white text-sm font-bold rounded-xl px-5 py-2.5 transition-colors">Bloquear data</button>
                  </div>

                  <div className="mt-5">
                    <p className="text-sm font-semibold text-ink-soft mb-2">Datas bloqueadas{selProp !== '' ? '' : ''}</p>
                    {bloqueios.filter((b) => b.prop_id === selProp).length === 0 ? (
                      <p className="text-sm text-ink-muted">Nenhuma data bloqueada para este espaço.</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {bloqueios.filter((b) => b.prop_id === selProp).map((b) => (
                          <span key={b.data} className="inline-flex items-center gap-1.5 bg-gray-100 text-ink-soft text-sm rounded-full pl-3 pr-1.5 py-1">
                            {new Date(b.data + 'T12:00:00').toLocaleDateString('pt-BR')}
                            <button onClick={() => desbloquear(b.prop_id, b.data)} className="w-5 h-5 rounded-full hover:bg-gray-200 flex items-center justify-center text-ink-muted" title="Desbloquear">×</button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </section>
            )}
          </div>
        )}
      </main>
      <Footer />

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-[#0d0d0d] text-white rounded-xl px-5 py-2.5 text-sm font-medium shadow-lg z-[9999] max-w-[90vw] text-center">{toast}</div>
      )}

      {pagar && (
        <CheckoutReserva
          reservaId={pagar.id}
          valorBase={Number(pagar.valor_estimado) || 0}
          email={userEmail}
          onClose={() => setPagar(null)}
          onPaid={() => { setReservas((prev) => prev.map((r) => (r.id === pagar.id ? { ...r, status: 'paga' } : r))); setPagar(null); flash('✅ Pagamento aprovado! Reserva confirmada.') }}
        />
      )}
    </>
  )
}
