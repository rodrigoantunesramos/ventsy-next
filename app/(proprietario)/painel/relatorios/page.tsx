'use client'

// Relatórios & BI — /painel/relatorios.
// Central de inteligência que cruza TODOS os módulos (comercial, financeiro,
// operações, ocupação, clientes) com indicadores próprios de locação de eventos
// (ocupação, RevPAS, receita por m²/evento). Três modos: Dashboards prontos,
// Construtor de relatórios e Exportação agendada. Cálculo na engine pura
// lib/bi.ts (testada); gráficos em SVG puro; i18n via lib/format (sem "R$"
// hardcoded). Carga única + filtros globais (período/propriedade/tipo) → números
// consistentes entre os dashboards e batendo com os módulos-fonte.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase as sb, authHeaders } from '@/lib/supabase'
import { formatDate } from '@/lib/format'
import { useToast } from '@/components/Toast'
import {
  type Range, type Dimensao, todayYMD, periodoRange, periodoAnterior, periodoLabel,
  inicioMes, fimMes, addDiasYMD,
} from '@/lib/bi'
import {
  type DadosBI, type RelatorioSalvo, type RelatorioAgendado, type ConstrutorConfig, type RelatorioExport,
  DADOS_VAZIO, carregarBI, checarSetup, isPremium, filtrarDados, tiposDeEvento,
  resumoExecutivoKPIs, eventosTabela, exportarCSV, exportarExcel, exportarPDF,
  nomePropriedade, rotuloMes,
} from './_lib'
import { DASHBOARDS, type DashKey } from './_components/dashboards'
import { Construtor } from './_components/construtor'
import { Agendados, type NovoAgendado } from './_components/agendados'
import { SetupNotice, EmptyState, IcoDownload, IcoSpark, IcoChart } from './_components/ui'

type Tab = 'dashboards' | 'construtor' | 'agendados'
type Preset = 'mes' | 'trimestre' | 'ano' | '12meses' | 'personalizado'

const PRESETS: { v: Preset; label: string }[] = [
  { v: 'mes', label: 'Mês' }, { v: 'trimestre', label: 'Trimestre' }, { v: 'ano', label: 'Ano' },
  { v: '12meses', label: '12 meses' }, { v: 'personalizado', label: 'Personalizado' },
]

export default function RelatoriosPage() {
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [premium, setPremium] = useState(false)
  const [needsSetup, setNeedsSetup] = useState(false)
  const [dados, setDados] = useState<DadosBI>(DADOS_VAZIO)
  const [salvos, setSalvos] = useState<RelatorioSalvo[]>([])
  const [agendados, setAgendados] = useState<RelatorioAgendado[]>([])

  const [tab, setTab] = useState<Tab>('dashboards')
  const [dashKey, setDashKey] = useState<DashKey>('comercial')
  const [preset, setPreset] = useState<Preset>('12meses')
  const [custom, setCustom] = useState<{ ini: string; fim: string }>({ ini: '', fim: '' })
  const [propFiltro, setPropFiltro] = useState<number | null>(null)
  const [tipoFiltro, setTipoFiltro] = useState<string | null>(null)

  const [aiOpen, setAiOpen] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiTexto, setAiTexto] = useState('')

  const hoje = todayYMD()
  const range: Range = useMemo(() => periodoRange(preset, hoje, custom), [preset, hoje, custom])
  const rangePrev = useMemo(() => periodoAnterior(range), [range])
  const range12: Range = useMemo(() => ({ ini: inicioMes(addDiasYMD(fimMes(range.fim), -334)), fim: fimMes(range.fim) }), [range.fim])

  // ── Carga ──────────────────────────────────────────────────────────────────
  const recarregarListas = useCallback(async () => {
    try {
      const r = await fetch('/api/relatorios', { headers: { ...(await authHeaders()) } })
      if (r.ok) { const j = await r.json(); setSalvos(j.salvos || []); setAgendados(j.agendados || []) }
    } catch { /* listas opcionais */ }
  }, [])

  useEffect(() => {
    (async () => {
      const { data: { session } } = await sb.auth.getSession()
      if (!session) { setLoading(false); return }
      setUserId(session.user.id)
      setEmail(session.user.email || '')
      try {
        const { data: a } = await sb.from('assinaturas').select('plano_ativo').eq('usuario_id', session.user.id).maybeSingle()
        setPremium(isPremium(a?.plano_ativo))
      } catch { /* plano opcional */ }
      const [d, setup] = await Promise.all([carregarBI(session.user.id), checarSetup()])
      setDados(d); setNeedsSetup(setup)
      if (!setup) await recarregarListas()
      setLoading(false)
    })()
  }, [recarregarListas])

  // ── Derivados ──────────────────────────────────────────────────────────────
  const scoped = useMemo(() => filtrarDados(dados, propFiltro, tipoFiltro), [dados, propFiltro, tipoFiltro])
  const tipos = useMemo(() => tiposDeEvento(dados), [dados])
  const eventosPeriodo = useMemo(
    () => scoped.eventos.filter((e) => { const d = (e.data_inicio || e.criado_em || '').slice(0, 10); return d >= range.ini && d <= range.fim }),
    [scoped.eventos, range],
  )

  const rotuloChave = useCallback((dim: Dimensao, chave: string): string => {
    if (dim === 'mes') return rotuloMes(chave)
    if (dim === 'propriedade') return chave.startsWith('sem') ? 'Sem propriedade' : nomePropriedade(dados, Number(chave))
    return chave
  }, [dados])

  const dashLabel = DASHBOARDS.find((d) => d.key === dashKey)!.label
  const subtitulo = `${periodoLabel(preset)} · ${formatDate(range.ini, { style: 'short' })}–${formatDate(range.fim, { style: 'short' })}${propFiltro != null ? ` · ${nomePropriedade(dados, propFiltro)}` : ''}${tipoFiltro ? ` · ${tipoFiltro}` : ''}`

  function montarExport(): RelatorioExport {
    const tabela = eventosTabela(scoped, range)
    return { titulo: `Relatório ${dashLabel}`, subtitulo, kpis: resumoExecutivoKPIs(scoped, range, hoje), colunas: tabela.colunas, linhas: tabela.linhas }
  }

  // ── Handlers de relatórios salvos / agendados ──────────────────────────────
  async function api(op: string, payload: Record<string, unknown>) {
    const r = await fetch('/api/relatorios', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(await authHeaders()) }, body: JSON.stringify({ op, ...payload }) })
    if (!r.ok) { const j = await r.json().catch(() => ({})); throw new Error(j.error || 'Falha na operação') }
    return r.json()
  }
  const salvarRelatorio = async (nome: string, config: ConstrutorConfig) => {
    try { await api('salvar_relatorio', { nome, config: { ...config, periodo: preset, prop: propFiltro, tipo: tipoFiltro } }); toast.success('Relatório salvo!'); await recarregarListas() }
    catch (e) { toast.error((e as Error).message) }
  }
  const excluirRelatorio = async (id: string) => { try { await api('excluir_relatorio', { id }); await recarregarListas() } catch (e) { toast.error((e as Error).message) } }
  const criarAgendado = async (a: NovoAgendado) => { try { await api('criar_agendado', a); toast.success('Envio agendado!'); await recarregarListas() } catch (e) { toast.error((e as Error).message) } }
  const toggleAgendado = async (id: string, ativo: boolean) => { try { await api('toggle_agendado', { id, ativo }); await recarregarListas() } catch (e) { toast.error((e as Error).message) } }
  const excluirAgendado = async (id: string) => { try { await api('excluir_agendado', { id }); await recarregarListas() } catch (e) { toast.error((e as Error).message) } }

  // ── IA: explicar o resultado ───────────────────────────────────────────────
  async function explicarIA() {
    setAiOpen(true); setAiLoading(true); setAiTexto('')
    try {
      const r = await fetch('/api/relatorios/ai', {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
        body: JSON.stringify({ dashboard: dashLabel, periodo: subtitulo, kpis: resumoExecutivoKPIs(scoped, range, hoje) }),
      })
      const j = await r.json()
      if (j.code === 'NO_KEY') setAiTexto('A IA ainda não está configurada neste ambiente (defina AI_GATEWAY_API_KEY). Mesmo assim, os números acima já resumem o período.')
      else if (j.code === 'NEED_PRO') setAiTexto('A explicação por IA faz parte dos planos Pro e Ultra.')
      else if (j.text) setAiTexto(j.text)
      else setAiTexto(j.error || 'Não foi possível gerar a explicação agora.')
    } catch { setAiTexto('Falha ao consultar a IA. Tente novamente.') }
    finally { setAiLoading(false) }
  }

  if (loading) return <Skeleton />

  const semNada = dados.eventos.length === 0 && dados.lancamentos.length === 0 && dados.reservas.length === 0 && dados.propriedades.length === 0

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      {/* Cabeçalho */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink sm:text-2xl">Relatórios & BI</h1>
          <p className="mt-1 text-sm text-ink-muted">Inteligência do negócio de eventos — ocupação, RevPAS, receita por m²/evento, funil, margem e satisfação, cruzando todos os módulos.</p>
        </div>
        <div className="flex items-center gap-2">
          {tab === 'dashboards' && (
            <>
              <button onClick={explicarIA} className="inline-flex items-center gap-1.5 rounded-xl border border-black/10 bg-white px-3 py-2 text-xs font-semibold text-ink-soft transition hover:border-brand hover:text-brand" title="Explicar este resultado com IA"><IcoSpark /> Explicar</button>
              <ExportMenu onCSV={() => exportarCSV(montarExport())} onExcel={() => exportarExcel(montarExport())} onPDF={() => exportarPDF(montarExport())} />
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 rounded-full border border-black/10 bg-white p-1 text-sm">
        {([['dashboards', 'Dashboards'], ['construtor', 'Construtor'], ['agendados', 'Exportação agendada']] as [Tab, string][]).map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)} className={`rounded-full px-4 py-1.5 font-semibold transition ${tab === t ? 'bg-ink text-white' : 'text-ink-muted hover:text-ink'}`}>{label}</button>
        ))}
      </div>

      {/* Filtros globais */}
      <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-white p-3 shadow-card">
        <div className="flex flex-wrap gap-1 rounded-full bg-black/[0.04] p-0.5">
          {PRESETS.map((p) => <button key={p.v} onClick={() => setPreset(p.v)} className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${preset === p.v ? 'bg-white text-ink shadow-sm' : 'text-ink-muted hover:text-ink'}`}>{p.label}</button>)}
        </div>
        {preset === 'personalizado' && (
          <div className="flex items-center gap-1.5 text-xs">
            <input type="date" value={custom.ini} onChange={(e) => setCustom((c) => ({ ...c, ini: e.target.value }))} className="rounded-lg border border-black/10 px-2 py-1.5 focus:border-brand focus:outline-none" />
            <span className="text-ink-muted">até</span>
            <input type="date" value={custom.fim} onChange={(e) => setCustom((c) => ({ ...c, fim: e.target.value }))} className="rounded-lg border border-black/10 px-2 py-1.5 focus:border-brand focus:outline-none" />
          </div>
        )}
        {dados.propriedades.length > 1 && (
          <select value={propFiltro ?? ''} onChange={(e) => setPropFiltro(e.target.value ? Number(e.target.value) : null)} className="rounded-xl border border-black/10 bg-white px-3 py-2 text-xs focus:border-brand focus:outline-none">
            <option value="">Todas as propriedades</option>
            {dados.propriedades.map((p) => <option key={p.id} value={p.id}>{p.nome || `Espaço #${p.id}`}</option>)}
          </select>
        )}
        {tipos.length > 0 && (
          <select value={tipoFiltro ?? ''} onChange={(e) => setTipoFiltro(e.target.value || null)} className="rounded-xl border border-black/10 bg-white px-3 py-2 text-xs focus:border-brand focus:outline-none">
            <option value="">Todos os tipos</option>
            {tipos.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        )}
        <span className="ml-auto text-xs text-ink-muted">{subtitulo}</span>
      </div>

      {needsSetup && <SetupNotice />}

      {semNada ? (
        <EmptyState
          icon={<IcoChart />}
          titulo="Sem dados para analisar ainda"
          texto="Cadastre propriedades, eventos (CRM), lançamentos financeiros e reservas. Conforme os módulos são usados, os indicadores de BI aparecem aqui."
        />
      ) : tab === 'dashboards' ? (
        <>
          {/* Seletor de dashboard */}
          <div className="flex flex-wrap gap-1.5">
            {DASHBOARDS.map((d) => (
              <button key={d.key} onClick={() => setDashKey(d.key)} className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition ${dashKey === d.key ? 'bg-brand text-white' : 'border border-black/10 bg-white text-ink-soft hover:border-brand/40 hover:text-brand'}`}>{d.label}</button>
            ))}
          </div>
          {(() => { const Comp = DASHBOARDS.find((d) => d.key === dashKey)!.Comp; return <Comp dados={scoped} range={range} rangePrev={rangePrev} range12={range12} hojeYMD={hoje} /> })()}
        </>
      ) : tab === 'construtor' ? (
        <Construtor
          eventos={eventosPeriodo}
          rotuloChave={rotuloChave}
          salvos={salvos}
          premium={premium}
          subtitulo={subtitulo}
          onSalvar={salvarRelatorio}
          onExcluir={excluirRelatorio}
          onAplicar={() => toast.success('Relatório aberto.')}
        />
      ) : (
        <div className="relative">
          <Agendados
            agendados={agendados}
            salvos={salvos}
            premium={premium}
            emailPadrao={email}
            onCriar={criarAgendado}
            onToggle={toggleAgendado}
            onExcluir={excluirAgendado}
          />
        </div>
      )}

      {/* Modal IA */}
      {aiOpen && (
        <div className="fixed inset-0 z-[10000] flex items-start justify-center overflow-y-auto bg-black/50 p-4" onClick={() => setAiOpen(false)}>
          <div className="relative my-12 w-full max-w-lg rounded-2xl bg-white p-6 shadow-pop" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setAiOpen(false)} className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full border border-black/10 text-ink-muted hover:bg-black/[0.03]">✕</button>
            <div className="mb-4 flex items-center gap-2"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-brand text-white"><IcoSpark /></span><h3 className="font-display text-lg font-bold text-ink">Explicação do resultado</h3></div>
            <p className="mb-3 text-xs text-ink-muted">{dashLabel} · {subtitulo}</p>
            {aiLoading ? (
              <div className="flex items-center gap-2 py-8 text-sm text-ink-muted"><span className="h-4 w-4 animate-spin rounded-full border-2 border-brand border-t-transparent" /> Analisando os números…</div>
            ) : (
              <div className="whitespace-pre-wrap text-sm leading-relaxed text-ink-soft">{aiTexto}</div>
            )}
            {!premium && !aiLoading && <p className="mt-4 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">A explicação por IA é um recurso Pro+.</p>}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Sub-componentes ──────────────────────────────────────────────────────────
function ExportMenu({ onCSV, onExcel, onPDF }: { onCSV: () => void; onExcel: () => void; onPDF: () => void }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <button onClick={() => setOpen((v) => !v)} onBlur={() => setTimeout(() => setOpen(false), 150)} className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-3.5 py-2 text-xs font-semibold text-white hover:bg-brand-600"><IcoDownload /> Exportar</button>
      {open && (
        <div className="absolute right-0 top-[42px] z-50 w-36 overflow-hidden rounded-xl border border-black/[0.06] bg-white py-1 shadow-pop">
          {([['PDF', onPDF], ['Excel', onExcel], ['CSV', onCSV]] as [string, () => void][]).map(([l, fn]) => (
            <button key={l} onMouseDown={fn} className="block w-full px-4 py-2 text-left text-sm hover:bg-black/[0.03]">{l}</button>
          ))}
        </div>
      )}
    </div>
  )
}

function Skeleton() {
  return (
    <div className="mx-auto max-w-6xl animate-pulse space-y-5">
      <div className="h-12 rounded-2xl bg-black/[0.05]" />
      <div className="h-10 rounded-full bg-black/[0.05]" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <div key={i} className="h-24 rounded-2xl bg-black/[0.05]" />)}</div>
      <div className="h-56 rounded-2xl bg-black/[0.05]" />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2"><div className="h-56 rounded-2xl bg-black/[0.05]" /><div className="h-56 rounded-2xl bg-black/[0.05]" /></div>
    </div>
  )
}
