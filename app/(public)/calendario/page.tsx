'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import { supabase, supabaseAny } from '@/lib/supabase'
import { brl } from '@/lib/fees'

type Prop = { id: number; nome: string | null; valor_hora: number | null; valor_base: number | null }
type Disp = { prop_id: number; data: string; motivo: string | null; bloqueado: boolean; preco: number | null; min_horas: number | null }

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function CalendarioPage() {
  const [userId, setUserId] = useState<string | null>(null)
  const [authChecked, setAuthChecked] = useState(false)
  const [props, setProps] = useState<Prop[]>([])
  const [selProp, setSelProp] = useState<number | ''>('')
  const [cursor, setCursor] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1) })
  const [dispMap, setDispMap] = useState<Record<string, Disp>>({})
  const [loading, setLoading] = useState(true)

  const [editDay, setEditDay] = useState<string | null>(null)
  const [fBloq, setFBloq] = useState(false)
  const [fPreco, setFPreco] = useState('')
  const [fMin, setFMin] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setAuthChecked(true)
      if (!session) { setLoading(false); return }
      setUserId(session.user.id)
      const { data } = await supabaseAny.from('propriedades').select('id,nome,valor_hora,valor_base').eq('usuario_id', session.user.id).order('id')
      const list = (data || []) as Prop[]
      setProps(list)
      if (list.length) setSelProp(list[0].id)
      setLoading(false)
    })
  }, [])

  const loadMonth = useCallback(async (propId: number, monthStart: Date) => {
    const first = ymd(new Date(monthStart.getFullYear(), monthStart.getMonth(), 1))
    const last = ymd(new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0))
    const { data } = await supabaseAny.from('disponibilidade').select('*').eq('prop_id', propId).gte('data', first).lte('data', last)
    const map: Record<string, Disp> = {}
    ;(data || []).forEach((r: Disp) => { map[r.data] = r })
    setDispMap(map)
  }, [])

  useEffect(() => {
    if (selProp === '') return
    loadMonth(selProp as number, cursor)
  }, [selProp, cursor, loadMonth])

  const selPropObj = props.find((p) => p.id === selProp)
  const precoBase = selPropObj ? (selPropObj.valor_hora || selPropObj.valor_base || 0) : 0
  const precoLabel = selPropObj?.valor_hora ? '/h' : ''

  const year = cursor.getFullYear()
  const month = cursor.getMonth()
  const firstWeekday = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: (string | null)[] = []
  for (let i = 0; i < firstWeekday; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(ymd(new Date(year, month, d)))
  const todayStr = ymd(new Date())

  const irMes = (delta: number) => setCursor(new Date(year, month + delta, 1))

  function openDay(dateStr: string) {
    const r = dispMap[dateStr]
    setEditDay(dateStr)
    setFBloq(r ? r.bloqueado : false)
    setFPreco(r?.preco != null ? String(r.preco) : '')
    setFMin(r?.min_horas != null ? String(r.min_horas) : '')
  }

  async function salvar() {
    if (!editDay || selProp === '') return
    setSaving(true)
    const row: Disp = {
      prop_id: selProp as number,
      data: editDay,
      bloqueado: fBloq,
      preco: !fBloq && fPreco ? Number(fPreco) : null,
      min_horas: !fBloq && fMin ? Number(fMin) : null,
      motivo: fBloq ? 'Bloqueado pelo anfitrião' : null,
    }
    const { error } = await supabaseAny.from('disponibilidade').upsert(row, { onConflict: 'prop_id,data' })
    setSaving(false)
    if (!error) { setDispMap((m) => ({ ...m, [editDay]: row })); setEditDay(null) }
  }

  async function limpar() {
    if (!editDay || selProp === '') return
    setSaving(true)
    await supabaseAny.from('disponibilidade').delete().eq('prop_id', selProp).eq('data', editDay)
    setSaving(false)
    setDispMap((m) => { const n = { ...m }; delete n[editDay]; return n })
    setEditDay(null)
  }

  const dataLonga = editDay
    ? new Date(editDay + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })
    : ''

  return (
    <>
      <Header />
      <main className="max-w-3xl mx-auto px-5 pt-28 pb-20">
        <div className="flex items-center justify-between gap-3 mb-8 flex-wrap">
          <div>
            <h1 className="font-display text-3xl md:text-4xl font-black text-ink tracking-tight">Calendário</h1>
            <p className="text-ink-muted mt-1">Bloqueie datas, defina preço especial e mínimo de horas por dia.</p>
          </div>
          <Link href="/reservas" className="bg-ink hover:bg-ink-soft text-white font-bold text-sm rounded-xl px-5 py-2.5 transition-colors">Ver reservas →</Link>
        </div>

        {!authChecked || loading ? (
          <p className="text-ink-muted py-10 text-center">Carregando...</p>
        ) : !userId ? (
          <div className="rounded-2xl border border-gray-200 bg-white shadow-card p-8 text-center">
            <p className="text-ink-soft mb-4">Entre na sua conta para gerenciar o calendário.</p>
            <Link href="/login" className="inline-block bg-brand hover:bg-brand-600 text-white font-bold rounded-xl px-6 py-3 transition-colors">Entrar</Link>
          </div>
        ) : props.length === 0 ? (
          <div className="rounded-2xl border border-gray-200 bg-white shadow-card p-8 text-center">
            <p className="text-ink-soft mb-4">Cadastre um espaço para gerenciar a disponibilidade.</p>
            <Link href="/anunciar" className="inline-block bg-brand hover:bg-brand-600 text-white font-bold rounded-xl px-6 py-3 transition-colors">Anunciar meu espaço</Link>
          </div>
        ) : (
          <>
            {/* Seletor de espaço */}
            <div className="mb-5">
              <label className="block text-sm font-semibold text-ink-soft mb-1.5">Espaço</label>
              <select
                value={selProp}
                onChange={(e) => setSelProp(Number(e.target.value))}
                className="w-full sm:w-auto border border-gray-300 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
              >
                {props.map((p) => <option key={p.id} value={p.id}>{p.nome || `Espaço #${p.id}`}</option>)}
              </select>
              {precoBase > 0 && <span className="ml-3 text-sm text-ink-muted">Preço base: <strong className="text-ink-soft">{brl(precoBase)}{precoLabel}</strong></span>}
            </div>

            {/* Calendário */}
            <div className="rounded-2xl border border-gray-200 bg-white shadow-card p-5">
              <div className="flex items-center justify-between mb-4">
                <button onClick={() => irMes(-1)} className="w-9 h-9 rounded-full border border-gray-200 hover:bg-gray-50 flex items-center justify-center text-ink-soft">‹</button>
                <h2 className="font-display text-lg font-bold text-ink">{MESES[month]} {year}</h2>
                <button onClick={() => irMes(1)} className="w-9 h-9 rounded-full border border-gray-200 hover:bg-gray-50 flex items-center justify-center text-ink-soft">›</button>
              </div>

              <div className="grid grid-cols-7 gap-1.5 mb-1.5">
                {DIAS.map((d) => <div key={d} className="text-center text-xs font-bold text-ink-muted py-1">{d}</div>)}
              </div>

              <div className="grid grid-cols-7 gap-1.5">
                {cells.map((dateStr, i) => {
                  if (!dateStr) return <div key={`b${i}`} />
                  const r = dispMap[dateStr]
                  const dia = Number(dateStr.slice(-2))
                  const passado = dateStr < todayStr
                  const hoje = dateStr === todayStr
                  let cls = 'bg-white border-gray-200 hover:border-brand hover:bg-brand/5 text-ink'
                  if (passado) cls = 'bg-gray-50 border-gray-100 text-gray-300 cursor-not-allowed'
                  else if (r?.bloqueado) cls = 'bg-red-50 border-red-200 text-red-700 hover:border-red-300'
                  else if (r?.preco != null) cls = 'bg-emerald-50 border-emerald-200 text-emerald-800 hover:border-emerald-300'
                  return (
                    <button
                      key={dateStr}
                      disabled={passado}
                      onClick={() => openDay(dateStr)}
                      className={`relative aspect-square rounded-xl border text-sm font-semibold flex flex-col items-center justify-center transition ${cls} ${hoje ? 'ring-2 ring-brand/40' : ''}`}
                    >
                      <span>{dia}</span>
                      {!passado && r?.bloqueado && <span className="text-[10px] font-bold leading-none mt-0.5">bloq.</span>}
                      {!passado && !r?.bloqueado && r?.preco != null && <span className="text-[10px] font-bold leading-none mt-0.5">{brl(Number(r.preco)).replace(/\s/g, '')}</span>}
                    </button>
                  )
                })}
              </div>

              {/* Legenda */}
              <div className="flex flex-wrap gap-4 mt-5 pt-4 border-t border-gray-100 text-xs text-ink-muted">
                <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-white border border-gray-300" /> Disponível</span>
                <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-red-100 border border-red-300" /> Bloqueado</span>
                <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-emerald-100 border border-emerald-300" /> Preço especial</span>
              </div>
            </div>

            <p className="text-xs text-ink-muted mt-3">Clique em uma data para configurá-la. Datas passadas não podem ser editadas.</p>
          </>
        )}
      </main>
      <Footer />

      {/* Modal de configuração do dia */}
      {editDay && (
        <div className="fixed inset-0 bg-black/50 z-[10000] flex items-start justify-center overflow-y-auto p-4">
          <div className="bg-white rounded-2xl max-w-md w-full my-8 p-6 relative shadow-pop">
            <button onClick={() => setEditDay(null)} className="absolute top-4 right-4 w-9 h-9 rounded-full border border-gray-200 hover:bg-gray-50 flex items-center justify-center text-ink-muted">✕</button>
            <h3 className="font-display text-xl font-bold text-ink mb-1 capitalize">{dataLonga}</h3>
            <p className="text-sm text-ink-muted mb-5">{selPropObj?.nome || `Espaço #${selProp}`}</p>

            <label className="flex items-center gap-3 rounded-xl border border-gray-200 px-4 py-3 cursor-pointer mb-4">
              <input type="checkbox" checked={fBloq} onChange={(e) => setFBloq(e.target.checked)} className="w-4 h-4 accent-[#ff385c]" />
              <span className="text-sm font-semibold text-ink-soft">Bloquear esta data (indisponível)</span>
            </label>

            {!fBloq && (
              <div className="grid grid-cols-2 gap-4 mb-2">
                <div>
                  <label className="block text-sm font-semibold text-ink-soft mb-1.5">Preço neste dia (R$)</label>
                  <input type="number" min={0} value={fPreco} onChange={(e) => setFPreco(e.target.value)} placeholder={precoBase ? String(precoBase) : 'base'} className="w-full border border-gray-300 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-ink-soft mb-1.5">Mín. de horas</label>
                  <input type="number" min={0} value={fMin} onChange={(e) => setFMin(e.target.value)} placeholder="—" className="w-full border border-gray-300 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20" />
                </div>
              </div>
            )}

            <div className="flex items-center gap-3 mt-6">
              <button onClick={salvar} disabled={saving} className="bg-brand hover:bg-brand-600 disabled:opacity-60 text-white font-bold text-sm rounded-xl px-6 py-3 transition-colors">{saving ? 'Salvando...' : 'Salvar'}</button>
              {dispMap[editDay] && (
                <button onClick={limpar} disabled={saving} className="text-sm text-ink-muted hover:text-red-600 font-medium">Limpar dia</button>
              )}
              <button onClick={() => setEditDay(null)} className="text-sm text-ink-muted hover:text-ink font-medium ml-auto">Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
