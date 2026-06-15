'use client'

// Auditoria & Logs — /painel/auditoria (grupo Conta · Pro+).
// Trilha de "quem fez o quê, quando e de onde": criação/edição/exclusão em
// entidades sensíveis (financeiro, contratos, preços, permissões), logins
// (sucesso/falha), exportações e pagamentos. Quatro abas:
//   • Linha do tempo — todos os eventos, filtros e diff antes→depois.
//   • Sensíveis      — destaques (exclusões, preços, permissões, exportações…).
//   • Segurança      — logins, dispositivos e acessos incomuns.
//   • Exportar       — trilha por período (CSV) + retenção/expurgo.
// Fonte: tabela `auditoria_log` (RLS dono; docs/sql/auditoria.sql). A escrita é
// feita pela service-role (lib/auditServer) nas rotas sensíveis e no login; a
// matemática (filtros, diff, sensibilidade, agregação, CSV) vive em lib/audit
// (motor puro, testado). Esta página é só-leitura sobre a trilha.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase as sb } from '@/lib/supabase'
import { formatNumber } from '@/lib/format'
import { resumoAuditoria, atividadePorDia } from '@/lib/audit'
import {
  carregarAuditoria, isPremium, hojeYmd,
  type AuditBag, type AuditLog, type Ator,
} from './_lib'
import {
  KpiCard, Section, Sparkline, SetupNotice, PremiumGate,
  IcoList, IcoAlert, IcoShield, IcoExport, IcoUser, IcoBolt,
} from './_components/ui'
import Timeline from './_components/Timeline'
import Seguranca from './_components/Seguranca'
import Exportar from './_components/Exportar'

type Tab = 'timeline' | 'sensiveis' | 'seguranca' | 'exportar'
const TABS: { v: Tab; label: string; icon: () => JSX.Element }[] = [
  { v: 'timeline', label: 'Linha do tempo', icon: IcoList },
  { v: 'sensiveis', label: 'Sensíveis', icon: IcoAlert },
  { v: 'seguranca', label: 'Segurança', icon: IcoShield },
  { v: 'exportar', label: 'Exportar & retenção', icon: IcoExport },
]

export default function AuditoriaPage() {
  const [loading, setLoading] = useState(true)
  const [premium, setPremium] = useState(true)
  const [needsSetup, setNeedsSetup] = useState(false)
  const [userId, setUserId] = useState('')
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [tab, setTab] = useState<Tab>('timeline')

  const carregar = useCallback(async (uid: string) => {
    const r = await carregarAuditoria(uid)
    setNeedsSetup(r.needsSetup)
    setLogs(r.logs)
  }, [])

  useEffect(() => {
    (async () => {
      const { data: { session } } = await sb.auth.getSession()
      if (!session) { window.location.href = '/login'; return }
      const uid = session.user.id
      setUserId(uid)

      try {
        const { data: a } = await sb.from('assinaturas').select('plano_ativo').eq('usuario_id', uid).maybeSingle()
        const plano = (a?.plano_ativo || 'basico') as string
        setPremium(isPremium(plano))
        if (isPremium(plano)) await carregar(uid)
      } catch {
        setPremium(false)
      }

      const t = new URLSearchParams(window.location.search).get('tab') as Tab | null
      if (t && TABS.some((x) => x.v === t)) setTab(t)
      setLoading(false)
    })()
  }, [carregar])

  const recarregar = useCallback(async () => { if (userId) await carregar(userId) }, [userId, carregar])

  const atores = useMemo<Ator[]>(() => {
    const m = new Map<string, Ator>()
    for (const l of logs) if (l.ator_id && !m.has(l.ator_id)) m.set(l.ator_id, { id: l.ator_id, nome: l.ator_nome || '', email: l.ator_email || '' })
    return Array.from(m.values()).sort((a, b) => (a.nome || a.email).localeCompare(b.nome || b.email))
  }, [logs])

  const entidades = useMemo(
    () => Array.from(new Set(logs.map((l) => l.entidade).filter((x): x is string => !!x))).sort(),
    [logs],
  )

  const resumo = useMemo(() => resumoAuditoria(logs), [logs])
  const serie = useMemo(() => atividadePorDia(logs, hojeYmd(), 30), [logs])

  const bag: AuditBag = useMemo(
    () => ({ userId, hoje: hojeYmd(), logs, atores, entidades, recarregar }),
    [userId, logs, atores, entidades, recarregar],
  )

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl space-y-4">
        <div className="h-8 w-56 animate-pulse rounded-lg bg-black/[0.06]" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          {[0, 1, 2, 3, 4].map((i) => <div key={i} className="h-24 animate-pulse rounded-2xl bg-black/[0.05]" />)}
        </div>
        <div className="h-[260px] animate-pulse rounded-2xl bg-black/[0.05]" />
      </div>
    )
  }

  if (!premium) return <PremiumGate />

  if (needsSetup) {
    return (
      <div className="mx-auto max-w-5xl">
        <Header tab={tab} setTab={setTab} hideTabs />
        <SetupNotice />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl">
      <Header tab={tab} setTab={setTab} />

      {/* KPIs */}
      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <KpiCard label="Eventos" value={formatNumber(resumo.total)} sub={`${atores.length} ator(es)`} icon={<IcoList />} />
        <KpiCard label="Sensíveis" value={formatNumber(resumo.sensiveis)} tone={resumo.sensiveis > 0 ? 'gold' : 'ink'} icon={<IcoAlert />} />
        <KpiCard label="Exclusões" value={formatNumber(resumo.exclusoes)} tone={resumo.exclusoes > 0 ? 'vermelho' : 'ink'} icon={<IcoBolt />} />
        <KpiCard label="Exportações" value={formatNumber(resumo.exportacoes)} tone="roxo" icon={<IcoExport />} />
        <KpiCard label="Logins" value={formatNumber(resumo.logins)} sub={resumo.loginsFalha > 0 ? `${resumo.loginsFalha} falha(s)` : 'sem falhas'} tone={resumo.loginsFalha > 0 ? 'vermelho' : 'verde'} icon={<IcoUser />} />
      </div>

      {/* Atividade */}
      <div className="mt-3">
        <Section title="Atividade (últimos 30 dias)" hint="Volume diário de eventos registrados.">
          <Sparkline serie={serie} />
        </Section>
      </div>

      <div className="mt-4">
        {tab === 'timeline' && <Timeline bag={bag} />}
        {tab === 'sensiveis' && <Timeline bag={bag} soSensiveis />}
        {tab === 'seguranca' && <Seguranca bag={bag} />}
        {tab === 'exportar' && <Exportar bag={bag} />}
      </div>
    </div>
  )
}

function Header({ tab, setTab, hideTabs }: { tab: Tab; setTab: (t: Tab) => void; hideTabs?: boolean }) {
  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink sm:text-2xl">Auditoria & Logs</h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-muted">Quem fez o quê, quando e de onde — em entidades sensíveis, logins e exportações. A trilha é imutável e só-leitura.</p>
        </div>
      </div>
      {!hideTabs && (
        <div className="mt-4 flex flex-wrap gap-1.5 overflow-x-auto border-b border-black/[0.06] pb-px">
          {TABS.map(({ v, label, icon: Ico }) => (
            <button key={v} onClick={() => setTab(v)}
              className={`inline-flex shrink-0 items-center gap-2 rounded-t-xl px-3.5 py-2.5 text-sm font-semibold transition ${tab === v ? 'border-b-2 border-brand text-brand' : 'text-ink-muted hover:text-ink-soft'}`}>
              <Ico /> {label}
            </button>
          ))}
        </div>
      )}
    </>
  )
}
