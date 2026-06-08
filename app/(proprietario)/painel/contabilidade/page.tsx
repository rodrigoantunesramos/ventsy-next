'use client'

// Contabilidade completa — /painel/contabilidade  (camada contábil Pro+).
// Sobre o caixa do app (lancamentos) e o a-receber (parcelas), SEM duplicar o
// cockpit de /painel/financeiro: aqui mora o plano de contas, DRE gerencial
// (caixa × competência), balancete/razão, fluxo de caixa por conta bancária,
// conciliação OFX/CSV, fechamento mensal (trava retroativa) e impostos.
// Toda a matemática vem da engine pura lib/contabilidade.ts (testada).

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabaseAny as sb } from '@/lib/supabase'
import { formatMonth } from '@/lib/format'
import { useToast } from '@/components/Toast'
import {
  carregarContabilidade, isPremium, periodoAnterior, periodoRange, ymd,
  type DadosContabilidade, type PeriodoTipo, type Regime,
} from './_lib'
import { PremiumOverlay, SetupNotice } from './_components/ui'
import VisaoGeral from './_components/VisaoGeral'
import PlanoContas from './_components/PlanoContas'
import DRE from './_components/DRE'
import Balancete from './_components/Balancete'
import FluxoCaixa from './_components/FluxoCaixa'
import Conciliacao from './_components/Conciliacao'
import Fechamento from './_components/Fechamento'
import Impostos from './_components/Impostos'

type AbaId = 'visao' | 'plano' | 'dre' | 'balancete' | 'fluxo' | 'conciliacao' | 'fechamento' | 'impostos'
const ABAS: [AbaId, string][] = [
  ['visao', 'Visão geral'], ['plano', 'Plano de contas'], ['dre', 'DRE'], ['balancete', 'Balancete'],
  ['fluxo', 'Fluxo de caixa'], ['conciliacao', 'Conciliação'], ['fechamento', 'Fechamento'], ['impostos', 'Impostos'],
]

export default function ContabilidadePage() {
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [premium, setPremium] = useState(true)
  const [dados, setDados] = useState<DadosContabilidade | null>(null)

  const [aba, setAba] = useState<AbaId>('visao')
  const [regime, setRegime] = useState<Regime>('competencia')
  const [periodoTipo, setPeriodoTipo] = useState<PeriodoTipo>('mes')
  const [anchor, setAnchor] = useState<Date>(() => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), 1) })
  const [centro, setCentro] = useState<string>('all') // 'all' | tipo de evento (segmenta DRE/Balancete)

  const hojeMes = useMemo(() => ymd(new Date()).slice(0, 7), [])
  const atual = useMemo(() => periodoRange(periodoTipo, anchor), [periodoTipo, anchor])
  const anterior = useMemo(() => periodoAnterior(periodoTipo, anchor), [periodoTipo, anchor])
  const periodoLabel = useMemo(() => {
    if (periodoTipo === 'ano') return String(anchor.getFullYear())
    if (periodoTipo === 'trimestre') return `T${Math.floor(anchor.getMonth() / 3) + 1} ${anchor.getFullYear()}`
    return formatMonth(ymd(anchor).slice(0, 7))
  }, [periodoTipo, anchor])

  const recarregar = useCallback(async () => {
    if (!userId) return
    setDados(await carregarContabilidade(userId))
  }, [userId])

  useEffect(() => {
    (async () => {
      const { data: { session } } = await sb.auth.getSession()
      if (!session) { setLoading(false); return }
      setUserId(session.user.id)
      try {
        const { data: a } = await sb.from('assinaturas').select('plano_ativo').eq('usuario_id', session.user.id).maybeSingle()
        setPremium(isPremium(a?.plano_ativo))
      } catch { setPremium(false) }
      setDados(await carregarContabilidade(session.user.id))
      setLoading(false)
    })()
  }, [])

  useEffect(() => {
    const h = window.location.hash.replace('#', '') as AbaId
    if (ABAS.some(([id]) => id === h)) setAba(h)
  }, [])

  function trocarAba(id: AbaId) { setAba(id); if (typeof window !== 'undefined') window.history.replaceState(null, '', `#${id}`) }
  function navega(dir: -1 | 1) {
    const step = periodoTipo === 'ano' ? 12 : periodoTipo === 'trimestre' ? 3 : 1
    setAnchor((a) => new Date(a.getFullYear(), a.getMonth() + dir * step, 1))
  }

  // Centros de custo = segmentação por tipo de evento (dimensão já preenchida no
  // Financeiro). lancamentos.centro_custo_id fica disponível p/ uso avançado.
  const tiposEvento = useMemo(() => {
    if (!dados) return []
    return [...new Set(dados.lancamentos.map((l) => l.tipo_evento).filter((x): x is string => !!x))].sort()
  }, [dados])
  const lancSeg = useMemo(() => {
    if (!dados) return []
    return centro === 'all' ? dados.lancamentos : dados.lancamentos.filter((l) => (l.tipo_evento || '') === centro)
  }, [dados, centro])

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl space-y-4">
        <div className="h-[72px] animate-pulse rounded-2xl bg-black/[0.05]" />
        <div className="h-[44px] animate-pulse rounded-2xl bg-black/[0.05]" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <div key={i} className="h-[104px] animate-pulse rounded-2xl bg-black/[0.05]" />)}</div>
        <div className="h-[260px] animate-pulse rounded-2xl bg-black/[0.05]" />
      </div>
    )
  }

  const segActive = aba === 'dre' || aba === 'balancete'

  const header = (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-xl font-bold text-ink sm:text-2xl">Contabilidade</h1>
        <p className="mt-1 text-sm text-ink-muted">Camada contábil sobre o caixa. O dia a dia de receitas e despesas continua no <Link href="/painel/financeiro" className="font-semibold text-brand underline">Financeiro</Link>.</p>
      </div>
      {dados && !dados.needsSetup && premium && (
        <div className="flex flex-wrap items-center gap-2">
          {/* Regime */}
          <div className="flex rounded-xl bg-black/[0.04] p-0.5 text-xs font-semibold">
            {(['competencia', 'caixa'] as Regime[]).map((r) => (
              <button key={r} onClick={() => setRegime(r)} className={`rounded-lg px-3 py-1.5 transition ${regime === r ? 'bg-white text-ink shadow-sm' : 'text-ink-muted'}`}>{r === 'competencia' ? 'Competência' : 'Caixa'}</button>
            ))}
          </div>
          {/* Centro de custo (só DRE/Balancete) */}
          {segActive && tiposEvento.length > 0 && (
            <select value={centro} onChange={(e) => setCentro(e.target.value)} className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm focus:border-brand focus:outline-none">
              <option value="all">Toda a operação</option>
              {tiposEvento.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          )}
          {/* Período */}
          <select value={periodoTipo} onChange={(e) => setPeriodoTipo(e.target.value as PeriodoTipo)} className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm focus:border-brand focus:outline-none">
            <option value="mes">Mês</option><option value="trimestre">Trimestre</option><option value="ano">Ano</option>
          </select>
          <div className="flex items-center gap-1 rounded-xl border border-black/10 bg-white px-1">
            <button onClick={() => navega(-1)} aria-label="Período anterior" className="px-2 py-1.5 text-ink-muted hover:text-brand">◀</button>
            <span className="min-w-[88px] text-center text-sm font-semibold capitalize text-ink-soft">{periodoLabel}</span>
            <button onClick={() => navega(1)} aria-label="Próximo período" className="px-2 py-1.5 text-ink-muted hover:text-brand">▶</button>
          </div>
        </div>
      )}
    </div>
  )

  // Premium gate (Pro+)
  if (!premium) {
    return (
      <div className="mx-auto max-w-6xl space-y-5">
        {header}
        <div className="relative">
          <div className="pointer-events-none select-none blur-sm">
            {dados && !dados.needsSetup
              ? <VisaoGeral dados={dados} regime={regime} atual={atual} anterior={anterior} periodoLabel={periodoLabel} hojeMes={hojeMes} goTo={() => {}} />
              : <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <div key={i} className="h-[104px] rounded-2xl bg-black/[0.05]" />)}</div>}
          </div>
          <PremiumOverlay />
        </div>
      </div>
    )
  }

  if (!dados || dados.needsSetup) {
    return <div className="mx-auto max-w-6xl space-y-5">{header}<SetupNotice /></div>
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      {header}

      {/* Abas */}
      <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
        {ABAS.map(([id, label]) => (
          <button key={id} onClick={() => trocarAba(id)} className={`shrink-0 rounded-xl px-3.5 py-2 text-sm font-semibold transition ${aba === id ? 'bg-ink text-white' : 'bg-white text-ink-muted shadow-card hover:text-ink'}`}>{label}</button>
        ))}
      </div>

      {aba === 'visao' && <VisaoGeral dados={dados} regime={regime} atual={atual} anterior={anterior} periodoLabel={periodoLabel} hojeMes={hojeMes} goTo={(a) => trocarAba(a as AbaId)} />}
      {aba === 'plano' && <PlanoContas userId={userId!} contas={dados.contas} lancamentos={dados.lancamentos} recarregar={recarregar} />}
      {aba === 'dre' && <DRE lancamentos={lancSeg} contas={dados.contas} regime={regime} atual={atual} anterior={anterior} periodoLabel={`${periodoLabel}${centro !== 'all' ? ` · ${centro}` : ''}`} centroCustoId={null} />}
      {aba === 'balancete' && <Balancete lancamentos={lancSeg} contas={dados.contas} regime={regime} atual={atual} periodoLabel={`${periodoLabel}${centro !== 'all' ? ` · ${centro}` : ''}`} />}
      {aba === 'fluxo' && <FluxoCaixa userId={userId!} lancamentos={dados.lancamentos} parcelas={dados.parcelas} bancos={dados.bancos} hojeMes={hojeMes} recarregar={recarregar} />}
      {aba === 'conciliacao' && <Conciliacao userId={userId!} lancamentos={dados.lancamentos} bancos={dados.bancos} extrato={dados.extrato} recarregar={recarregar} />}
      {aba === 'fechamento' && <Fechamento userId={userId!} fechamentos={dados.fechamentos} lancamentos={dados.lancamentos} contas={dados.contas} regime={regime} hojeMes={hojeMes} empresaNome={dados.empresaNome} recarregar={recarregar} />}
      {aba === 'impostos' && <Impostos userId={userId!} configImpostos={dados.configImpostos} lancamentos={dados.lancamentos} contas={dados.contas} regime={regime} atual={atual} periodoLabel={periodoLabel} recarregar={recarregar} />}

      <p className="px-1 pb-2 text-center text-[0.7rem] text-ink-muted">Relatórios gerenciais — confirme valores fiscais com seu contador.</p>
    </div>
  )
}
