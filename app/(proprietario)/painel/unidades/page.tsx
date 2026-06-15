'use client'

// Multi-unidades / Franquias — /painel/unidades  (Ultra).
// Para quem opera VÁRIAS unidades (rede/franquia/parque): visão CONSOLIDADA,
// COMPARATIVO/benchmark lado a lado, TROCA DE CONTEXTO (todas / unidade X) e
// camada de FRANQUIA (royalties/taxas por unidade). Cada unidade é uma
// `propriedade`; a consolidação agrega lancamentos (prop_id) e clientes_eventos
// (propriedade_id) — toda a matemática vem da engine pura lib/unidades.ts.
// Sem "R$" hardcoded: toda formatação passa por lib/format.

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { supabase as sb } from '@/lib/supabase'
import type { TablesInsert } from '@/types/supabase'
import { formatMoney, formatMoneyShort, formatNumber, formatPercent } from '@/lib/format'
import { useToast } from '@/components/Toast'
import { getUnidadeCtx, setUnidadeCtx, onUnidadeCtx } from '@/lib/unidadeCtx'
import {
  todayYMD, janelaPreset, montarUnidades, nomeUnidade, metricasTodas, consolidar,
  ranking, benchmark, valorMetrica, naoAtribuidos,
  PERIODOS, METRICAS_COMPARE, TIPOS_GRUPO, tipoGrupoMeta,
  type PeriodoPreset, type MetricaKey, type Unidade, type MetricasUnidade,
  type GrupoUnidade, type UnidadeConfig, type UnidadeAcesso,
} from '@/lib/unidades'
import { carregarUnidades, isUltra, type DadosUnidades } from './_lib'
import {
  Section, Kpi, StatBar, Gauge, SetupNotice, EmptyState, PremiumOverlayUltra,
  IcoUnits, IcoTrophy, IcoStore, IcoCoins, IcoStar, IcoCal, IcoChart, IcoUsers,
  IcoPlus, IcoEdit, IcoTrash, IcoCheck, IcoX, IcoLayers, IcoDownload,
} from './_components/ui'

type AbaId = 'visao' | 'comparativo' | 'franquia' | 'acesso'
const ABAS: [AbaId, string][] = [['visao', 'Visão consolidada'], ['comparativo', 'Comparativo'], ['franquia', 'Franquia'], ['acesso', 'Acessos']]

const inp = 'w-full rounded-xl border border-black/10 px-3.5 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20'
const btnPri = 'inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50'
const btnSec = 'inline-flex items-center gap-2 rounded-xl border border-black/10 bg-white px-3.5 py-2 text-sm font-medium hover:bg-black/[0.03]'

// Paleta para unidades sem cor de grupo (ciclo determinístico).
const PALETTE = ['#ff385c', '#0ea5e9', '#10b981', '#f59e0b', '#8b5cf6', '#14b8a6', '#ef4444', '#6366f1', '#f97316', '#22c55e']

export default function UnidadesPage() {
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [ultra, setUltra] = useState(true)
  const [dados, setDados] = useState<DadosUnidades | null>(null)

  const [aba, setAba] = useState<AbaId>('visao')
  const [periodo, setPeriodo] = useState<PeriodoPreset>('12m')
  const [ctxPid, setCtxPid] = useState<number | null>(null)
  const [compareKey, setCompareKey] = useState<MetricaKey>('receita')

  // Modais
  const [editUni, setEditUni] = useState<Unidade | null>(null)
  const [gruposOpen, setGruposOpen] = useState(false)

  const recarregar = useCallback(async () => {
    if (!userId) return
    setDados(await carregarUnidades(userId))
  }, [userId])

  useEffect(() => {
    (async () => {
      const { data: { session } } = await sb.auth.getSession()
      if (!session) { setLoading(false); return }
      setUserId(session.user.id)
      try {
        const { data: a } = await sb.from('assinaturas').select('plano_ativo').eq('usuario_id', session.user.id).maybeSingle()
        setUltra(isUltra(a?.plano_ativo))
      } catch { setUltra(false) }
      setDados(await carregarUnidades(session.user.id))
      setLoading(false)
    })()
  }, [])

  // Contexto de unidade (compartilhado com o resto do painel via lib/unidadeCtx).
  useEffect(() => {
    setCtxPid(getUnidadeCtx())
    return onUnidadeCtx(setCtxPid)
  }, [])

  // Aba via hash (#comparativo etc.)
  useEffect(() => {
    const h = window.location.hash.replace('#', '') as AbaId
    if (ABAS.some(([id]) => id === h)) setAba(h)
  }, [])
  function trocarAba(id: AbaId) { setAba(id); if (typeof window !== 'undefined') window.history.replaceState(null, '', `#${id}`) }

  function trocarContexto(pid: number | null) { setUnidadeCtx(pid); setCtxPid(pid) }

  // ── Derivados (engine) ──────────────────────────────────────────────────────
  const hoje = useMemo(() => todayYMD(), [])
  const janela = useMemo(() => janelaPreset(periodo, hoje), [periodo, hoje])
  const unidades = useMemo<Unidade[]>(() => montarUnidades(dados?.props || [], dados?.configs || []), [dados])
  const ativas = useMemo(() => unidades.filter((u) => u.cfg.ativo), [unidades])
  const inativas = useMemo(() => unidades.filter((u) => !u.cfg.ativo), [unidades])

  const metricsMap = useMemo(
    () => metricasTodas(unidades, dados?.lancamentos || [], dados?.eventos || [], janela),
    [unidades, dados, janela],
  )
  const metricsAtivas = useMemo(() => ativas.map((u) => metricsMap.get(u.prop.id)!).filter(Boolean), [ativas, metricsMap])
  const consolidado = useMemo(() => consolidar(metricsAtivas), [metricsAtivas])
  const naoAtrib = useMemo(() => naoAtribuidos(dados?.lancamentos || [], janela), [dados, janela])

  // Mapas auxiliares
  const grupoById = useMemo(() => new Map((dados?.grupos || []).map((g) => [g.id, g])), [dados])
  const uniById = useMemo(() => new Map(unidades.map((u) => [u.prop.id, u])), [unidades])
  const corDaUnidade = useCallback((u: Unidade, i: number): string => {
    const g = u.cfg.grupo_id != null ? grupoById.get(u.cfg.grupo_id) : null
    return (g?.cor || tipoGrupoMeta(g?.tipo).cor) || PALETTE[i % PALETTE.length]
  }, [grupoById])

  const rankAtual = useMemo(() => ranking(metricsAtivas, compareKey), [metricsAtivas, compareKey])
  const compareMeta = METRICAS_COMPARE.find((m) => m.key === compareKey)!
  const maxCompare = useMemo(() => Math.max(1, ...metricsAtivas.map((m) => valorMetrica(m, compareKey))), [metricsAtivas, compareKey])

  // Unidade em foco (troca de contexto) e sua métrica.
  const focoUni = ctxPid != null ? uniById.get(ctxPid) || null : null
  const focoMetrics = ctxPid != null ? metricsMap.get(ctxPid) || null : null

  // Total de royalties (franquia) entre as unidades ativas.
  const totalRoyalties = useMemo(() => metricsAtivas.reduce((s, m) => s + m.royalties, 0), [metricsAtivas])

  // ── Handlers de escrita (CRUD via RLS) ──────────────────────────────────────
  async function salvarConfig(payload: Partial<UnidadeConfig> & { propriedade_id: number }) {
    if (!userId) return
    try {
      const { error } = await sb.from('unidades_config').upsert(
        { usuario_id: userId, ...payload } as TablesInsert<'unidades_config'>, { onConflict: 'usuario_id,propriedade_id' },
      )
      if (error) throw error
      toast.success('Unidade atualizada.')
      setEditUni(null)
      await recarregar()
    } catch {
      toast.error('Não foi possível salvar. Rode docs/sql/unidades.sql se ainda não rodou.')
    }
  }

  async function salvarGrupo(g: { id?: number; nome: string; tipo: string; cor: string | null }) {
    if (!userId) return
    try {
      if (g.id) {
        const { error } = await sb.from('unidades_grupos').update({ nome: g.nome, tipo: g.tipo, cor: g.cor }).eq('id', g.id).eq('usuario_id', userId)
        if (error) throw error
      } else {
        const { error } = await sb.from('unidades_grupos').insert({ usuario_id: userId, nome: g.nome, tipo: g.tipo, cor: g.cor })
        if (error) throw error
      }
      toast.success('Grupo salvo.')
      await recarregar()
    } catch { toast.error('Não foi possível salvar o grupo.') }
  }

  async function excluirGrupo(id: number) {
    if (!userId) return
    try {
      // Desvincula as unidades antes (defensivo, caso a FK set-null não exista).
      await sb.from('unidades_config').update({ grupo_id: null }).eq('grupo_id', id).eq('usuario_id', userId)
      const { error } = await sb.from('unidades_grupos').delete().eq('id', id).eq('usuario_id', userId)
      if (error) throw error
      toast.success('Grupo removido.')
      await recarregar()
    } catch { toast.error('Não foi possível remover o grupo.') }
  }

  async function toggleAcesso(membroId: number, propId: number, on: boolean) {
    if (!userId) return
    try {
      if (on) {
        const { error } = await sb.from('unidades_acesso').insert({ usuario_id: userId, membro_id: membroId, propriedade_id: propId })
        if (error && error.code !== '23505') throw error // ignora duplicata
      } else {
        const { error } = await sb.from('unidades_acesso').delete().eq('usuario_id', userId).eq('membro_id', membroId).eq('propriedade_id', propId)
        if (error) throw error
      }
      await recarregar()
    } catch { toast.error('Não foi possível atualizar o acesso.') }
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  if (loading) return <Skeleton />

  const podeMostrar = ultra && !dados?.needsSetup && (dados?.props.length || 0) > 0
  const fmt = (key: MetricaKey, v: number) => fmtMetric(key, v)

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      {/* Cabeçalho ──────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink sm:text-2xl">Unidades</h1>
          <p className="mt-1 text-sm text-ink-muted">Gestão consolidada da sua rede: compare unidades, troque de contexto e acompanhe franquias.</p>
        </div>
        {podeMostrar && (
          <div className="flex flex-wrap items-center gap-2">
            <ContextoSelector unidades={unidades} ctxPid={ctxPid} onChange={trocarContexto} />
            <PeriodoSelector periodo={periodo} onChange={setPeriodo} />
          </div>
        )}
      </div>

      {/* Gate Ultra ──────────────────────────────────────────────────────────── */}
      {!ultra ? (
        <div className="relative min-h-[360px]">
          <div aria-hidden className="pointer-events-none select-none space-y-4 blur-sm">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <div key={i} className="h-24 rounded-2xl bg-black/[0.05]" />)}</div>
            <div className="h-64 rounded-2xl bg-black/[0.05]" />
          </div>
          <PremiumOverlayUltra />
        </div>
      ) : dados?.needsSetup ? (
        <SetupNotice />
      ) : (dados?.props.length || 0) === 0 ? (
        <Section>
          <EmptyState
            icon={<IcoStore />}
            title="Cadastre suas propriedades"
            msg="Cada unidade da sua rede é uma propriedade. Cadastre seus espaços para ver o consolidado e comparar unidades aqui."
            action={<Link href="/painel/meus-espacos" className={btnPri}><IcoPlus /> Adicionar propriedade</Link>}
          />
        </Section>
      ) : (
        <>
          {/* Degrade gracioso: 1 unidade só */}
          {unidades.length <= 1 && (
            <div className="flex items-start gap-2.5 rounded-xl border border-sky-100 bg-sky-50/60 p-3 text-sm text-sky-900">
              <span className="text-base leading-none">💡</span>
              <span className="leading-snug">Multi-unidades fica mais útil com 2 ou mais unidades. Você tem {unidades.length}. Cadastre outra propriedade para comparar lado a lado.</span>
            </div>
          )}

          {/* Tabs */}
          <div className="flex flex-wrap gap-1 rounded-xl bg-black/[0.04] p-1 text-sm font-semibold">
            {ABAS.map(([id, label]) => (
              <button
                key={id}
                onClick={() => trocarAba(id)}
                className={`rounded-lg px-3.5 py-1.5 transition ${aba === id ? 'bg-white text-ink shadow-sm' : 'text-ink-muted hover:text-ink'}`}
              >{label}</button>
            ))}
          </div>

          {aba === 'visao' && (
            <VisaoTab
              foco={focoUni} focoMetrics={focoMetrics} consolidado={consolidado}
              ativas={ativas} inativas={inativas} metricsMap={metricsMap}
              rank={rankAtual} compareKey={compareKey} setCompareKey={setCompareKey}
              maxCompare={maxCompare} corDaUnidade={corDaUnidade} grupoById={grupoById}
              janela={janela} naoAtrib={naoAtrib} onEdit={setEditUni} onFoco={trocarContexto} fmt={fmt}
            />
          )}

          {aba === 'comparativo' && (
            <ComparativoTab
              ativas={ativas} metricsMap={metricsMap} corDaUnidade={corDaUnidade}
              compareKey={compareKey} setCompareKey={setCompareKey} grupoById={grupoById}
              onEdit={setEditUni}
            />
          )}

          {aba === 'franquia' && (
            <FranquiaTab
              unidades={unidades} metricsMap={metricsMap} grupos={dados?.grupos || []}
              grupoById={grupoById} totalRoyalties={totalRoyalties} onEdit={setEditUni}
              onGrupos={() => setGruposOpen(true)}
            />
          )}

          {aba === 'acesso' && (
            <AcessoTab
              unidades={unidades} membros={dados?.membros || []} acessos={dados?.acessos || []}
              onToggle={toggleAcesso}
            />
          )}
        </>
      )}

      {/* Modais */}
      {editUni && (
        <ConfigModal
          unidade={editUni} grupos={dados?.grupos || []}
          onClose={() => setEditUni(null)} onSave={salvarConfig} onGrupos={() => { setEditUni(null); setGruposOpen(true) }}
        />
      )}
      {gruposOpen && (
        <GruposModal
          grupos={dados?.grupos || []} unidades={unidades}
          onClose={() => setGruposOpen(false)} onSave={salvarGrupo} onDelete={excluirGrupo}
        />
      )}
    </div>
  )
}

// ── Formatação de métrica (sem "R$" hardcoded — via lib/format) ───────────────
function fmtMetric(key: MetricaKey, value: number): string {
  const meta = METRICAS_COMPARE.find((m) => m.key === key)
  if (!meta) return formatNumber(value)
  if (meta.tipo === 'moeda') return formatMoneyShort(value)
  if (meta.tipo === 'percent') return formatPercent(value)
  if (meta.tipo === 'nota') return value > 0 ? formatNumber(value, { maximumFractionDigits: 1 }) : '—'
  return formatNumber(value)
}

// ── Seletores do cabeçalho ────────────────────────────────────────────────────
function PeriodoSelector({ periodo, onChange }: { periodo: PeriodoPreset; onChange: (p: PeriodoPreset) => void }) {
  return (
    <div className="flex gap-1 rounded-full border border-black/10 bg-white p-1 text-sm">
      {PERIODOS.map((p) => (
        <button
          key={p.v}
          onClick={() => onChange(p.v)}
          className={`rounded-full px-3 py-1.5 font-semibold transition ${periodo === p.v ? 'bg-ink text-white' : 'text-ink-muted hover:text-ink'}`}
        >{p.label}</button>
      ))}
    </div>
  )
}

function ContextoSelector({ unidades, ctxPid, onChange }: { unidades: Unidade[]; ctxPid: number | null; onChange: (pid: number | null) => void }) {
  return (
    <label className="flex items-center gap-2 rounded-full border border-black/10 bg-white py-1 pl-3 pr-1 text-sm">
      <span className="text-ink-muted">Contexto</span>
      <select
        value={ctxPid ?? ''}
        onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
        className="max-w-[180px] truncate rounded-full bg-black/[0.04] px-3 py-1.5 font-semibold text-ink focus:outline-none"
      >
        <option value="">Todas as unidades</option>
        {unidades.map((u) => <option key={u.prop.id} value={u.prop.id}>{nomeUnidade(u)}</option>)}
      </select>
    </label>
  )
}

// ── Aba: Visão consolidada ────────────────────────────────────────────────────
type VisaoProps = {
  foco: Unidade | null; focoMetrics: MetricasUnidade | null; consolidado: ReturnType<typeof consolidar>
  ativas: Unidade[]; inativas: Unidade[]; metricsMap: Map<number, MetricasUnidade>
  rank: MetricasUnidade[]; compareKey: MetricaKey; setCompareKey: (k: MetricaKey) => void
  maxCompare: number; corDaUnidade: (u: Unidade, i: number) => string; grupoById: Map<number, GrupoUnidade>
  janela: { de: string; ate: string; dias: number }; naoAtrib: { receita: number; despesa: number }
  onEdit: (u: Unidade) => void; onFoco: (pid: number | null) => void; fmt: (k: MetricaKey, v: number) => string
}
function VisaoTab(p: VisaoProps) {
  const c = p.consolidado
  const uniById = new Map(p.ativas.concat(p.inativas).map((u) => [u.prop.id, u]))

  // Foco numa unidade: spotlight com deltas vs média da rede.
  if (p.foco && p.focoMetrics) {
    const m = p.focoMetrics
    const media = c.unidades > 0 ? c : null
    const delta = (val: number, avg: number | null) => (avg == null || avg === 0 ? null : (val - avg) / avg)
    return (
      <div className="space-y-5">
        <Section className="border-l-4 border-l-brand">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand"><IcoStore /></span>
              <div>
                <h3 className="text-base font-bold text-ink">{nomeUnidade(p.foco)}</h3>
                <p className="text-xs text-ink-muted">{[p.foco.prop.cidade, p.foco.prop.estado].filter(Boolean).join(' · ') || 'Unidade em foco'}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => p.onEdit(p.foco!)} className={btnSec}><IcoEdit /> Editar</button>
              <button onClick={() => p.onFoco(null)} className={btnSec}>Ver todas</button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <SpotKpi label="Receita" value={formatMoneyShort(m.receita)} d={delta(m.receita, media?.receita ?? null)} />
            <SpotKpi label="Margem" value={formatMoneyShort(m.margem)} sub={m.margemPct != null ? formatPercent(m.margemPct) : undefined} d={delta(m.margem, media?.margem ?? null)} />
            <SpotKpi label="Eventos" value={formatNumber(m.eventos)} d={delta(m.eventos, media?.eventos ?? null)} />
            <SpotKpi label="Ocupação" value={m.ocupacao != null ? formatPercent(m.ocupacao) : '—'} d={delta(m.ocupacao ?? 0, media?.ocupacao ?? null)} />
            <SpotKpi label="Ticket médio" value={formatMoneyShort(m.ticket)} d={delta(m.ticket, media?.ticket ?? null)} />
            <SpotKpi label="Pipeline" value={formatMoneyShort(m.pipeline)} d={delta(m.pipeline, media?.pipeline ?? null)} />
            <SpotKpi label="Avaliação" value={m.avaliacao != null ? formatNumber(m.avaliacao, { maximumFractionDigits: 1 }) : '—'} d={delta(m.avaliacao ?? 0, media?.avaliacao ?? null)} />
            <SpotKpi label="Royalties" value={formatMoneyShort(m.royalties)} />
          </div>
          {m.metaReceita != null && (
            <div className="mt-4 rounded-xl bg-black/[0.02] p-3">
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="font-semibold text-ink-soft">Meta de receita</span>
                <span className="tabular-nums text-ink-muted">{formatMoneyShort(m.receita)} / {formatMoneyShort(m.metaReceita)} {m.atingimento != null && <strong className="text-ink">({formatPercent(m.atingimento)})</strong>}</span>
              </div>
              <Gauge pct={m.atingimento ?? 0} cor={(m.atingimento ?? 0) >= 1 ? '#16a34a' : '#f59e0b'} />
            </div>
          )}
        </Section>
        <p className="text-center text-xs text-ink-muted">Comparando <strong>{nomeUnidade(p.foco)}</strong> com a média das {c.unidades} unidades ativas no período. <button onClick={() => p.onFoco(null)} className="font-semibold text-brand underline">Ver consolidado</button>.</p>
      </div>
    )
  }

  // Consolidado de toda a rede.
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Receita consolidada" value={formatMoneyShort(c.receita)} sub={`${c.unidades} unidade${c.unidades === 1 ? '' : 's'} ativa${c.unidades === 1 ? '' : 's'}`} tone="verde" icon={<IcoCoins />} />
        <Kpi label="Margem" value={formatMoneyShort(c.margem)} sub={c.margemPct != null ? `${formatPercent(c.margemPct)} da receita` : undefined} tone={c.margem >= 0 ? 'verde' : 'vermelho'} icon={<IcoChart />} />
        <Kpi label="Eventos" value={formatNumber(c.eventos)} sub={`ticket ${formatMoneyShort(c.ticket)}`} tone="azul" icon={<IcoCal />} />
        <Kpi label="Ocupação média" value={c.ocupacao != null ? formatPercent(c.ocupacao) : '—'} sub={`${formatNumber(c.diasOcupados)} de ${formatNumber(c.diasDisponiveis)} dias·unidade`} tone="brand" icon={<IcoUnits />} />
        <Kpi label="Pipeline" value={formatMoneyShort(c.pipeline)} sub="em negociação" tone="gold" icon={<IcoChart />} />
        <Kpi label="Avaliação média" value={c.avaliacao != null ? formatNumber(c.avaliacao, { maximumFractionDigits: 1 }) : '—'} sub="satisfação (NPS proxy)" tone="gold" icon={<IcoStar />} />
        <Kpi label="Royalties" value={formatMoneyShort(c.royalties)} sub="repasse de franquia" tone="ink" icon={<IcoCoins />} />
        <Kpi label="Meta consolidada" value={c.metaReceita > 0 ? formatMoneyShort(c.metaReceita) : '—'} sub={c.atingimento != null ? `${formatPercent(c.atingimento)} atingido` : 'defina metas por unidade'} tone={c.atingimento != null && c.atingimento >= 1 ? 'verde' : 'ink'} icon={<IcoTrophy />} />
      </div>

      {(p.naoAtrib.receita > 0 || p.naoAtrib.despesa > 0) && (
        <p className="text-xs text-ink-muted">
          ⚠️ {formatMoney(p.naoAtrib.receita)} de receita e {formatMoney(p.naoAtrib.despesa)} de despesa sem unidade vinculada (não entram no consolidado por unidade). Vincule os lançamentos a uma propriedade no <Link href="/painel/financeiro" className="font-semibold text-brand underline">Financeiro</Link>.
        </p>
      )}

      {/* Ranking */}
      <Section
        title="Ranking de unidades"
        hint="Unidades ativas no período, da melhor para a pior."
        action={<MetricaSelect value={p.compareKey} onChange={p.setCompareKey} />}
      >
        {p.rank.length === 0 ? (
          <p className="py-6 text-center text-sm text-ink-muted">Sem dados no período.</p>
        ) : (
          <div className="space-y-3">
            {p.rank.map((m, i) => {
              const u = uniById.get(m.propriedade_id)
              if (!u) return null
              return (
                <StatBar
                  key={m.propriedade_id}
                  rank={i + 1}
                  label={nomeUnidade(u)}
                  right={p.fmt(p.compareKey, valorMetrica(m, p.compareKey))}
                  valor={valorMetrica(m, p.compareKey)}
                  max={p.maxCompare}
                  cor={p.corDaUnidade(u, i)}
                  sub={[u.prop.cidade, u.prop.estado].filter(Boolean).join(' · ') || undefined}
                />
              )
            })}
          </div>
        )}
      </Section>

      {/* Cards por unidade */}
      <Section title="Unidades" hint="Resumo do período por unidade.">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {p.ativas.map((u, i) => (
            <UnidadeCard key={u.prop.id} u={u} m={p.metricsMap.get(u.prop.id)!} cor={p.corDaUnidade(u, i)} grupo={u.cfg.grupo_id != null ? p.grupoById.get(u.cfg.grupo_id) : undefined} onEdit={() => p.onEdit(u)} onFoco={() => p.onFoco(u.prop.id)} />
          ))}
        </div>
        {p.inativas.length > 0 && (
          <div className="mt-4 border-t border-black/[0.06] pt-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">Inativas ({p.inativas.length})</p>
            <div className="flex flex-wrap gap-2">
              {p.inativas.map((u) => (
                <button key={u.prop.id} onClick={() => p.onEdit(u)} className="inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-black/[0.02] px-3 py-1.5 text-xs text-ink-muted hover:text-ink">
                  {nomeUnidade(u)} <IcoEdit />
                </button>
              ))}
            </div>
          </div>
        )}
      </Section>
    </div>
  )
}

function SpotKpi({ label, value, sub, d }: { label: string; value: string; sub?: string; d?: number | null }) {
  return (
    <div className="rounded-2xl border border-black/[0.06] p-4">
      <div className="text-xs text-ink-muted">{label}</div>
      <div className="mt-1.5 flex items-end justify-between gap-2">
        <span className="text-xl font-bold text-ink">{value}</span>
        {d != null && Math.abs(d) >= 0.005 && (
          <span className={`mb-0.5 shrink-0 rounded-full px-2 py-0.5 text-[0.62rem] font-bold ${d > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
            {d > 0 ? '↑' : '↓'} {formatPercent(Math.abs(d))}
          </span>
        )}
      </div>
      {sub && <div className="mt-1 text-[0.68rem] text-ink-muted">{sub}</div>}
    </div>
  )
}

function UnidadeCard({ u, m, cor, grupo, onEdit, onFoco }: { u: Unidade; m: MetricasUnidade; cor: string; grupo?: GrupoUnidade; onEdit: () => void; onFoco: () => void }) {
  return (
    <div className="group rounded-2xl border border-black/[0.06] p-4 transition hover:border-brand/30 hover:shadow-card">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="h-9 w-1.5 shrink-0 rounded-full" style={{ background: cor }} />
          <div className="min-w-0">
            <button onClick={onFoco} className="block truncate text-left text-sm font-bold text-ink hover:text-brand">{nomeUnidade(u)}</button>
            <div className="truncate text-[0.7rem] text-ink-muted">{[u.prop.cidade, u.prop.estado].filter(Boolean).join(' · ') || '—'}</div>
          </div>
        </div>
        <button onClick={onEdit} aria-label="Editar unidade" className="shrink-0 rounded-lg p-1.5 text-ink-muted opacity-0 transition hover:bg-black/[0.04] hover:text-ink group-hover:opacity-100"><IcoEdit /></button>
      </div>
      {grupo && <span className={`mt-2 inline-flex rounded-full px-2 py-0.5 text-[0.62rem] font-semibold ${tipoGrupoMeta(grupo.tipo).chip}`}>{grupo.nome}</span>}
      <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
        <Mini label="Receita" value={formatMoneyShort(m.receita)} />
        <Mini label="Margem" value={formatMoneyShort(m.margem)} tone={m.margem >= 0 ? 'verde' : 'vermelho'} />
        <Mini label="Eventos" value={formatNumber(m.eventos)} />
        <Mini label="Ocupação" value={m.ocupacao != null ? formatPercent(m.ocupacao) : '—'} />
      </div>
      {m.metaReceita != null && (
        <div className="mt-3">
          <Gauge pct={m.atingimento ?? 0} cor={(m.atingimento ?? 0) >= 1 ? '#16a34a' : '#f59e0b'} />
          <div className="mt-1 text-[0.62rem] text-ink-muted">{m.atingimento != null ? formatPercent(m.atingimento) : '0%'} da meta</div>
        </div>
      )}
    </div>
  )
}

function Mini({ label, value, tone = 'ink' }: { label: string; value: string; tone?: 'ink' | 'verde' | 'vermelho' }) {
  const c = { ink: 'text-ink', verde: 'text-emerald-600', vermelho: 'text-red-600' }[tone]
  return (
    <div>
      <div className="text-[0.62rem] uppercase tracking-wide text-ink-muted/80">{label}</div>
      <div className={`font-bold ${c}`}>{value}</div>
    </div>
  )
}

function MetricaSelect({ value, onChange }: { value: MetricaKey; onChange: (k: MetricaKey) => void }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value as MetricaKey)} className="rounded-xl border border-black/10 bg-white px-3 py-1.5 text-sm font-semibold focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20">
      {METRICAS_COMPARE.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
    </select>
  )
}

// ── Aba: Comparativo / benchmark ──────────────────────────────────────────────
function ComparativoTab({ ativas, metricsMap, corDaUnidade, compareKey, setCompareKey, grupoById, onEdit }: {
  ativas: Unidade[]; metricsMap: Map<number, MetricasUnidade>; corDaUnidade: (u: Unidade, i: number) => string
  compareKey: MetricaKey; setCompareKey: (k: MetricaKey) => void; grupoById: Map<number, GrupoUnidade>; onEdit: (u: Unidade) => void
}) {
  const ms = ativas.map((u) => metricsMap.get(u.prop.id)!).filter(Boolean)
  const bench = benchmark(ms, compareKey)
  const meta = METRICAS_COMPARE.find((m) => m.key === compareKey)!

  function exportCSV() {
    const head = ['Unidade', 'Cidade', 'UF', 'Grupo', 'Receita', 'Despesa', 'Margem', 'Margem%', 'Eventos', 'Ocupacao%', 'Ticket', 'Pipeline', 'Avaliacao', 'Royalties', 'Meta', 'Atingimento%']
    const rows = ativas.map((u) => {
      const m = metricsMap.get(u.prop.id)!
      const g = u.cfg.grupo_id != null ? grupoById.get(u.cfg.grupo_id) : null
      return [
        nomeUnidade(u), u.prop.cidade || '', u.prop.estado || '', g?.nome || '',
        m.receita, m.despesa, m.margem, m.margemPct != null ? (m.margemPct * 100).toFixed(1) : '',
        m.eventos, m.ocupacao != null ? (m.ocupacao * 100).toFixed(1) : '', m.ticket, m.pipeline,
        m.avaliacao ?? '', m.royalties, m.metaReceita ?? '', m.atingimento != null ? (m.atingimento * 100).toFixed(1) : '',
      ].map((v) => (typeof v === 'string' && v.includes(',') ? `"${v}"` : String(v))).join(',')
    })
    const csv = [head.join(','), ...rows].join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
    const a = document.createElement('a'); a.href = url; a.download = 'unidades-comparativo.csv'; a.click(); URL.revokeObjectURL(url)
  }

  if (!ms.length) return <Section><p className="py-6 text-center text-sm text-ink-muted">Nenhuma unidade ativa para comparar.</p></Section>

  const max = Math.max(1, ...ms.map((m) => valorMetrica(m, compareKey)))
  const rankByKey = ranking(ms, compareKey)
  const uniById = new Map(ativas.map((u) => [u.prop.id, u]))

  return (
    <div className="space-y-5">
      <Section
        title="Comparativo entre unidades"
        hint={`${meta.label}: melhor × média × pior da rede.`}
        action={
          <div className="flex items-center gap-2">
            <MetricaSelect value={compareKey} onChange={setCompareKey} />
            <button onClick={exportCSV} className={btnSec}><IcoDownload /> CSV</button>
          </div>
        }
      >
        <div className="mb-5 grid grid-cols-3 gap-3">
          <BenchCard label="Melhor" value={fmtMetric(compareKey, bench.max)} nome={bench.melhorId != null ? nomeUnidade(uniById.get(bench.melhorId)!) : '—'} tone="verde" />
          <BenchCard label="Média" value={fmtMetric(compareKey, bench.media)} nome={`${ms.length} unidades`} tone="ink" />
          <BenchCard label="Pior" value={fmtMetric(compareKey, bench.min)} nome={bench.piorId != null ? nomeUnidade(uniById.get(bench.piorId)!) : '—'} tone="vermelho" />
        </div>
        <div className="space-y-3">
          {rankByKey.map((m, i) => {
            const u = uniById.get(m.propriedade_id)!
            const v = valorMetrica(m, compareKey)
            const acima = v >= bench.media
            return (
              <StatBar
                key={m.propriedade_id}
                rank={i + 1}
                label={nomeUnidade(u)}
                right={fmtMetric(compareKey, v)}
                valor={v}
                max={max}
                cor={corDaUnidade(u, i)}
                sub={acima ? 'acima da média' : 'abaixo da média'}
              />
            )
          })}
        </div>
      </Section>

      {/* Matriz completa */}
      <Section title="Todos os indicadores" hint="Período selecionado, por unidade.">
        <div className="-mx-5 overflow-x-auto px-5">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-black/[0.06] text-left text-xs text-ink-muted">
                <th className="py-2 pr-3 font-semibold">Unidade</th>
                <th className="px-2 py-2 text-right font-semibold">Receita</th>
                <th className="px-2 py-2 text-right font-semibold">Margem</th>
                <th className="px-2 py-2 text-right font-semibold">Eventos</th>
                <th className="px-2 py-2 text-right font-semibold">Ocupação</th>
                <th className="px-2 py-2 text-right font-semibold">Ticket</th>
                <th className="px-2 py-2 text-right font-semibold">Avaliação</th>
                <th className="py-2 pl-2 text-right font-semibold"></th>
              </tr>
            </thead>
            <tbody>
              {ativas.map((u) => {
                const m = metricsMap.get(u.prop.id)!
                return (
                  <tr key={u.prop.id} className="border-b border-black/[0.04] last:border-0">
                    <td className="py-2.5 pr-3 font-semibold text-ink">{nomeUnidade(u)}</td>
                    <td className="px-2 py-2.5 text-right tabular-nums">{formatMoneyShort(m.receita)}</td>
                    <td className={`px-2 py-2.5 text-right tabular-nums ${m.margem >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{formatMoneyShort(m.margem)}</td>
                    <td className="px-2 py-2.5 text-right tabular-nums">{formatNumber(m.eventos)}</td>
                    <td className="px-2 py-2.5 text-right tabular-nums">{m.ocupacao != null ? formatPercent(m.ocupacao) : '—'}</td>
                    <td className="px-2 py-2.5 text-right tabular-nums">{formatMoneyShort(m.ticket)}</td>
                    <td className="px-2 py-2.5 text-right tabular-nums">{m.avaliacao != null ? formatNumber(m.avaliacao, { maximumFractionDigits: 1 }) : '—'}</td>
                    <td className="py-2.5 pl-2 text-right"><button onClick={() => onEdit(u)} aria-label="Editar" className="rounded-lg p-1.5 text-ink-muted hover:bg-black/[0.04] hover:text-ink"><IcoEdit /></button></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  )
}

function BenchCard({ label, value, nome, tone }: { label: string; value: string; nome: string; tone: 'verde' | 'ink' | 'vermelho' }) {
  const c = { verde: 'text-emerald-600', ink: 'text-ink', vermelho: 'text-red-600' }[tone]
  return (
    <div className="rounded-2xl border border-black/[0.06] p-4 text-center">
      <div className="text-[0.68rem] font-bold uppercase tracking-wide text-ink-muted/80">{label}</div>
      <div className={`mt-1.5 text-lg font-bold ${c}`}>{value}</div>
      <div className="mt-0.5 truncate text-[0.68rem] text-ink-muted">{nome}</div>
    </div>
  )
}

// ── Aba: Franquia ─────────────────────────────────────────────────────────────
function FranquiaTab({ unidades, metricsMap, grupos, grupoById, totalRoyalties, onEdit, onGrupos }: {
  unidades: Unidade[]; metricsMap: Map<number, MetricasUnidade>; grupos: GrupoUnidade[]
  grupoById: Map<number, GrupoUnidade>; totalRoyalties: number; onEdit: (u: Unidade) => void; onGrupos: () => void
}) {
  const comFranquia = unidades.filter((u) => (u.cfg.royalties_pct ?? 0) > 0 || (u.cfg.taxa_fixa_num ?? 0) > 0)
  const franquiaGrupos = grupos.filter((g) => g.tipo === 'franquia')

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Kpi label="Royalties no período" value={formatMoneyShort(totalRoyalties)} sub="repasse total estimado" tone="brand" icon={<IcoCoins />} />
        <Kpi label="Unidades com franquia" value={formatNumber(comFranquia.length)} sub={`de ${unidades.length} unidades`} tone="ink" icon={<IcoStore />} />
        <Kpi label="Grupos de franquia" value={formatNumber(franquiaGrupos.length)} sub="redes/marcas" tone="azul" icon={<IcoLayers />} />
      </div>

      <Section
        title="Repasses por unidade"
        hint="Royalty = receita × % + taxa fixa. Configure por unidade."
        action={<button onClick={onGrupos} className={btnSec}><IcoLayers /> Grupos</button>}
      >
        {comFranquia.length === 0 ? (
          <EmptyState
            icon={<IcoCoins />}
            title="Nenhuma unidade com franquia configurada"
            msg="Defina um percentual de royalties e/ou taxa fixa numa unidade para acompanhar os repasses da sua rede de franquias."
          />
        ) : (
          <div className="-mx-5 overflow-x-auto px-5">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-black/[0.06] text-left text-xs text-ink-muted">
                  <th className="py-2 pr-3 font-semibold">Unidade</th>
                  <th className="px-2 py-2 font-semibold">Grupo</th>
                  <th className="px-2 py-2 text-right font-semibold">Receita</th>
                  <th className="px-2 py-2 text-right font-semibold">%</th>
                  <th className="px-2 py-2 text-right font-semibold">Taxa fixa</th>
                  <th className="px-2 py-2 text-right font-semibold">Repasse</th>
                  <th className="py-2 pl-2 text-right"></th>
                </tr>
              </thead>
              <tbody>
                {comFranquia.map((u) => {
                  const m = metricsMap.get(u.prop.id)!
                  const g = u.cfg.grupo_id != null ? grupoById.get(u.cfg.grupo_id) : null
                  return (
                    <tr key={u.prop.id} className="border-b border-black/[0.04] last:border-0">
                      <td className="py-2.5 pr-3 font-semibold text-ink">{nomeUnidade(u)}</td>
                      <td className="px-2 py-2.5">{g ? <span className={`rounded-full px-2 py-0.5 text-[0.62rem] font-semibold ${tipoGrupoMeta(g.tipo).chip}`}>{g.nome}</span> : <span className="text-ink-muted">—</span>}</td>
                      <td className="px-2 py-2.5 text-right tabular-nums">{formatMoneyShort(m.receita)}</td>
                      <td className="px-2 py-2.5 text-right tabular-nums">{u.cfg.royalties_pct != null ? formatPercent((u.cfg.royalties_pct || 0) / 100) : '—'}</td>
                      <td className="px-2 py-2.5 text-right tabular-nums">{u.cfg.taxa_fixa_num != null ? formatMoneyShort(u.cfg.taxa_fixa_num) : '—'}</td>
                      <td className="px-2 py-2.5 text-right font-bold tabular-nums text-brand">{formatMoneyShort(m.royalties)}</td>
                      <td className="py-2.5 pl-2 text-right"><button onClick={() => onEdit(u)} aria-label="Editar" className="rounded-lg p-1.5 text-ink-muted hover:bg-black/[0.04] hover:text-ink"><IcoEdit /></button></td>
                    </tr>
                  )
                })}
                <tr className="border-t-2 border-black/10 font-bold">
                  <td className="py-2.5 pr-3" colSpan={5}>Total</td>
                  <td className="px-2 py-2.5 text-right tabular-nums text-brand">{formatMoneyShort(totalRoyalties)}</td>
                  <td />
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section title="Padronização" hint="Distribua preços, contratos e cardápios às unidades da rede.">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <PadraoLink href="/painel/precificacao" titulo="Tabela de preços" desc="Padrão de precificação da rede." />
          <PadraoLink href="/painel/contratos" titulo="Modelos de contrato" desc="Minutas padronizadas." />
          <PadraoLink href="/painel/catering" titulo="Cardápios" desc="Cardápios e fichas técnicas." />
        </div>
        <p className="mt-3 text-xs text-ink-muted">A distribuição centralizada de templates entre unidades evolui junto com cada módulo. Por ora, gerencie os padrões nos módulos de origem e replique nas unidades.</p>
      </Section>
    </div>
  )
}

function PadraoLink({ href, titulo, desc }: { href: string; titulo: string; desc: string }) {
  return (
    <Link href={href} className="rounded-xl border border-black/[0.06] p-4 transition hover:border-brand/30 hover:shadow-card">
      <div className="text-sm font-bold text-ink">{titulo}</div>
      <div className="mt-0.5 text-xs text-ink-muted">{desc}</div>
    </Link>
  )
}

// ── Aba: Acessos por unidade ──────────────────────────────────────────────────
function AcessoTab({ unidades, membros, acessos, onToggle }: {
  unidades: Unidade[]; membros: { id: number; nome: string; cargo: string | null }[]
  acessos: UnidadeAcesso[]; onToggle: (membroId: number, propId: number, on: boolean) => void
}) {
  const porMembro = useMemo(() => {
    const m = new Map<number, Set<number>>()
    for (const a of acessos) {
      const s = m.get(a.membro_id) || new Set<number>()
      s.add(a.propriedade_id); m.set(a.membro_id, s)
    }
    return m
  }, [acessos])

  if (!membros.length) {
    return (
      <Section>
        <EmptyState
          icon={<IcoUsers />}
          title="Sem membros na equipe"
          msg="Cadastre membros para controlar quais unidades cada um pode acessar. As permissões por módulo ficam em Configurações."
          action={<Link href="/painel/equipe" className={btnPri}><IcoPlus /> Gerenciar equipe</Link>}
        />
      </Section>
    )
  }

  return (
    <Section title="Acesso por unidade" hint="Marque as unidades de cada membro. Sem nenhuma marcada = acesso a todas (restrição é opt-in).">
      <div className="space-y-4">
        {membros.map((mem) => {
          const set = porMembro.get(mem.id)
          const restrito = !!set && set.size > 0
          return (
            <div key={mem.id} className="rounded-xl border border-black/[0.06] p-3.5">
              <div className="mb-2.5 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-50 text-xs font-bold text-brand">{(mem.nome || '?').slice(0, 1).toUpperCase()}</span>
                  <div>
                    <div className="text-sm font-bold text-ink">{mem.nome}</div>
                    {mem.cargo && <div className="text-[0.7rem] text-ink-muted">{mem.cargo}</div>}
                  </div>
                </div>
                <span className={`rounded-full px-2.5 py-0.5 text-[0.62rem] font-semibold ${restrito ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>
                  {restrito ? `${set!.size} unidade${set!.size === 1 ? '' : 's'}` : 'Todas as unidades'}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {unidades.map((u) => {
                  const on = !!set?.has(u.prop.id)
                  return (
                    <button
                      key={u.prop.id}
                      onClick={() => onToggle(mem.id, u.prop.id, !on)}
                      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition ${on ? 'border-brand bg-brand-50 text-brand' : 'border-black/10 bg-white text-ink-muted hover:text-ink'}`}
                    >
                      {on && <IcoCheck />} {nomeUnidade(u)}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
      <p className="mt-4 text-xs text-ink-muted">As permissões por módulo (financeiro, comercial…) ficam em <Link href="/painel/configuracoes" className="font-semibold text-brand underline">Configurações → Equipe & Permissões</Link>. Aqui você restringe POR UNIDADE.</p>
    </Section>
  )
}

// ── Modal: configuração da unidade ────────────────────────────────────────────
function ConfigModal({ unidade, grupos, onClose, onSave, onGrupos }: {
  unidade: Unidade; grupos: GrupoUnidade[]
  onClose: () => void; onSave: (p: Partial<UnidadeConfig> & { propriedade_id: number }) => void; onGrupos: () => void
}) {
  const c = unidade.cfg
  const [apelido, setApelido] = useState(c.apelido || '')
  const [grupoId, setGrupoId] = useState<string>(c.grupo_id != null ? String(c.grupo_id) : '')
  const [ativo, setAtivo] = useState(c.ativo)
  const [ordem, setOrdem] = useState<string>(c.ordem != null ? String(c.ordem) : '')
  const [meta, setMeta] = useState<string>(c.meta_receita_num != null ? String(c.meta_receita_num) : '')
  const [pct, setPct] = useState<string>(c.royalties_pct != null ? String(c.royalties_pct) : '')
  const [taxa, setTaxa] = useState<string>(c.taxa_fixa_num != null ? String(c.taxa_fixa_num) : '')
  const [obs, setObs] = useState(c.obs || '')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const numOrNull = (s: string) => { const n = parseFloat(s.replace(',', '.')); return s.trim() === '' || Number.isNaN(n) ? null : n }

  async function submit() {
    setSaving(true)
    await onSave({
      propriedade_id: unidade.prop.id,
      apelido: apelido.trim() || null,
      grupo_id: grupoId ? Number(grupoId) : null,
      ativo,
      ordem: numOrNull(ordem) != null ? Math.round(numOrNull(ordem)!) : null,
      meta_receita_num: numOrNull(meta),
      royalties_pct: numOrNull(pct),
      taxa_fixa_num: numOrNull(taxa),
      obs: obs.trim() || null,
    })
    setSaving(false)
  }

  return (
    <Backdrop onClose={onClose}>
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-pop">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-ink">Configurar unidade</h3>
            <p className="text-xs text-ink-muted">{unidade.prop.nome || `Unidade #${unidade.prop.id}`}</p>
          </div>
          <button onClick={onClose} aria-label="Fechar" className="rounded-lg p-1.5 text-ink-muted hover:bg-black/[0.04]"><IcoX /></button>
        </div>

        <div className="space-y-3.5">
          <Field label="Apelido de exibição">
            <input value={apelido} onChange={(e) => setApelido(e.target.value)} placeholder={unidade.prop.nome || ''} className={inp} />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Grupo / rede">
              <select value={grupoId} onChange={(e) => setGrupoId(e.target.value)} className={inp}>
                <option value="">Sem grupo</option>
                {grupos.map((g) => <option key={g.id} value={g.id}>{g.nome}</option>)}
              </select>
            </Field>
            <Field label="Ordem">
              <input value={ordem} onChange={(e) => setOrdem(e.target.value)} inputMode="numeric" placeholder="—" className={inp} />
            </Field>
          </div>
          <button onClick={onGrupos} className="text-xs font-semibold text-brand hover:underline">+ Gerenciar grupos</button>

          <Field label="Meta de receita (período)" hint="Sem símbolo de moeda — só o número.">
            <input value={meta} onChange={(e) => setMeta(e.target.value)} inputMode="decimal" placeholder="0" className={inp} />
          </Field>

          <div className="rounded-xl bg-black/[0.02] p-3.5">
            <p className="mb-2.5 text-xs font-bold uppercase tracking-wide text-ink-muted">Franquia (opcional)</p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Royalties (%)">
                <input value={pct} onChange={(e) => setPct(e.target.value)} inputMode="decimal" placeholder="0" className={inp} />
              </Field>
              <Field label="Taxa fixa">
                <input value={taxa} onChange={(e) => setTaxa(e.target.value)} inputMode="decimal" placeholder="0" className={inp} />
              </Field>
            </div>
            <p className="mt-2 text-[0.68rem] text-ink-muted">Repasse = receita × % + taxa fixa.</p>
          </div>

          <Field label="Observações">
            <textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={2} className={inp} />
          </Field>

          <label className="flex items-center gap-2.5 rounded-xl border border-black/10 px-3.5 py-2.5 text-sm">
            <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} className="h-4 w-4 accent-brand" />
            <span className="font-medium text-ink">Unidade ativa</span>
            <span className="text-xs text-ink-muted">(entra no consolidado e nos rankings)</span>
          </label>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className={btnSec}>Cancelar</button>
          <button onClick={submit} disabled={saving} className={btnPri}>{saving ? 'Salvando…' : <><IcoCheck /> Salvar</>}</button>
        </div>
      </div>
    </Backdrop>
  )
}

// ── Modal: grupos (rede/franquia/região/marca) ────────────────────────────────
function GruposModal({ grupos, unidades, onClose, onSave, onDelete }: {
  grupos: GrupoUnidade[]; unidades: Unidade[]
  onClose: () => void; onSave: (g: { id?: number; nome: string; tipo: string; cor: string | null }) => void; onDelete: (id: number) => void
}) {
  const [nome, setNome] = useState('')
  const [tipo, setTipo] = useState<string>('rede')
  const [cor, setCor] = useState<string>(TIPOS_GRUPO[0].cor)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const contagem = useMemo(() => {
    const m = new Map<number, number>()
    for (const u of unidades) if (u.cfg.grupo_id != null) m.set(u.cfg.grupo_id, (m.get(u.cfg.grupo_id) || 0) + 1)
    return m
  }, [unidades])

  function add() {
    if (!nome.trim()) return
    onSave({ nome: nome.trim(), tipo, cor })
    setNome('')
  }

  return (
    <Backdrop onClose={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-pop">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-ink">Grupos de unidades</h3>
            <p className="text-xs text-ink-muted">Organize por rede, franquia, região ou marca.</p>
          </div>
          <button onClick={onClose} aria-label="Fechar" className="rounded-lg p-1.5 text-ink-muted hover:bg-black/[0.04]"><IcoX /></button>
        </div>

        <div className="space-y-2">
          {grupos.length === 0 && <p className="py-3 text-center text-sm text-ink-muted">Nenhum grupo ainda.</p>}
          {grupos.map((g) => (
            <div key={g.id} className="flex items-center justify-between gap-2 rounded-xl border border-black/[0.06] px-3 py-2.5">
              <div className="flex items-center gap-2.5">
                <span className="h-6 w-1.5 rounded-full" style={{ background: g.cor || tipoGrupoMeta(g.tipo).cor }} />
                <div>
                  <div className="text-sm font-bold text-ink">{g.nome}</div>
                  <div className="text-[0.68rem] text-ink-muted">{tipoGrupoMeta(g.tipo).label} · {contagem.get(g.id) || 0} unidade{(contagem.get(g.id) || 0) === 1 ? '' : 's'}</div>
                </div>
              </div>
              <button onClick={() => onDelete(g.id)} aria-label="Remover grupo" className="rounded-lg p-1.5 text-ink-muted hover:bg-red-50 hover:text-red-600"><IcoTrash /></button>
            </div>
          ))}
        </div>

        <div className="mt-4 rounded-xl bg-black/[0.02] p-3.5">
          <p className="mb-2.5 text-xs font-bold uppercase tracking-wide text-ink-muted">Novo grupo</p>
          <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome do grupo" className={`${inp} mb-2.5`} />
          <div className="mb-2.5 flex flex-wrap gap-1.5">
            {TIPOS_GRUPO.map((t) => (
              <button
                key={t.v}
                onClick={() => { setTipo(t.v); setCor(t.cor) }}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${tipo === t.v ? t.chip : 'bg-black/[0.04] text-ink-muted hover:text-ink'}`}
              >{t.label}</button>
            ))}
          </div>
          <div className="flex items-center justify-between gap-2">
            <label className="flex items-center gap-2 text-xs text-ink-muted">
              Cor <input type="color" value={cor} onChange={(e) => setCor(e.target.value)} className="h-7 w-9 cursor-pointer rounded border border-black/10" />
            </label>
            <button onClick={add} disabled={!nome.trim()} className={btnPri}><IcoPlus /> Adicionar</button>
          </div>
        </div>
      </div>
    </Backdrop>
  )
}

// ── Primitivos de modal/form ──────────────────────────────────────────────────
function Backdrop({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[300] flex items-end justify-center overflow-y-auto bg-black/40 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full sm:w-auto">{children}</div>
    </div>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-ink-soft">{label}{hint && <span className="ml-1 font-normal text-ink-muted">· {hint}</span>}</span>
      {children}
    </label>
  )
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
function Skeleton() {
  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="h-[72px] animate-pulse rounded-2xl bg-black/[0.05]" />
      <div className="h-[44px] animate-pulse rounded-2xl bg-black/[0.05]" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <div key={i} className="h-24 animate-pulse rounded-2xl bg-black/[0.05]" />)}</div>
      <div className="h-64 animate-pulse rounded-2xl bg-black/[0.05]" />
    </div>
  )
}
