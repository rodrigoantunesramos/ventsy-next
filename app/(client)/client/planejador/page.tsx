'use client'

// Planejador de Evento — /client/planejador. Checklist + orçamento por evento
// selecionado (ou "Geral"). Persistência direta via RLS (supabase.from) nas
// tabelas planejador_tarefas / planejador_orcamento; motor puro em lib/planejador.

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { formatMoney, formatDate } from '@/lib/format'
import { useToast } from '@/components/Toast'
import { portalClienteApi } from '../eventos/_lib'
import {
  gerarChecklist, progressoChecklist, progressoPorCategoria, resumoOrcamento,
  CATEGORIAS_PLANEJADOR, categoriaLabel, categoriaEmoji,
  type CategoriaPlanejador,
} from '@/lib/planejador'
import {
  PageHeader, Card, Section, Kpi, Tabs, Badge, ProgressBar, Modal, EmptyState,
  Skeleton, SetupBanner, btnPrimary, btnGhost, inputCls,
} from '../_ui'
import { Icon } from '../_nav'

// ── Tipos das linhas (tabelas novas, fora dos tipos gerados) ──────────────────
type Tarefa = {
  id: string
  user_id: string
  evento_id: string | null
  titulo: string
  categoria: string
  concluida: boolean
  prazo: string | null
  ordem: number | null
  origem: string | null
  criado_em: string | null
}
type ItemOrc = {
  id: string
  user_id: string
  evento_id: string | null
  descricao: string
  categoria: string
  valor_previsto: number | null
  valor_real: number | null
  pago: boolean
  criado_em: string | null
}
type EventoOpt = {
  evento_id: string
  nome_evento: string | null
  tipo_evento: string | null
  data_inicio: string | null
  dias_ate: number | null
}

// supabase é tipado; as tabelas novas não estão nos tipos gerados → cast leve.
const db = supabase as any

function isMissingTable(err: { code?: string; message?: string } | null | undefined): boolean {
  if (!err) return false
  const code = err.code || ''
  const msg = (err.message || '').toLowerCase()
  return code === 'PGRST205' || code === '42P01' || msg.includes('does not exist')
}

export default function PlanejadorPage() {
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [setup, setSetup] = useState(false)
  const [uid, setUid] = useState<string | null>(null)

  const [eventos, setEventos] = useState<EventoOpt[]>([])
  const [eventoId, setEventoId] = useState<string>('') // '' = Geral (evento_id null)

  const [aba, setAba] = useState<'checklist' | 'orcamento'>('checklist')
  const [tarefas, setTarefas] = useState<Tarefa[]>([])
  const [itens, setItens] = useState<ItemOrc[]>([])
  const [carregandoDados, setCarregandoDados] = useState(false)
  const [gerando, setGerando] = useState(false)
  const [modalItem, setModalItem] = useState(false)

  const eventoAtual = useMemo(() => eventos.find((e) => e.evento_id === eventoId) || null, [eventos, eventoId])

  // ── Carga inicial: sessão + lista de eventos ────────────────────────────────
  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setLoading(false); return }
      setUid(session.user.id)
      try {
        const r = await portalClienteApi('resumo')
        const evs = ((r.eventos as EventoOpt[]) || []).map((e) => ({
          evento_id: e.evento_id,
          nome_evento: e.nome_evento,
          tipo_evento: e.tipo_evento,
          data_inicio: e.data_inicio,
          dias_ate: e.dias_ate,
        }))
        setEventos(evs)
        // Padrão: evento futuro mais próximo (lista já vem ordenada), senão Geral.
        const futuro = evs.find((e) => e.dias_ate != null && e.dias_ate >= 0)
        setEventoId(futuro ? futuro.evento_id : '')
      } catch {
        // Sem acesso a eventos: segue só com "Geral".
        setEventoId('')
      }
      setLoading(false)
    })()
  }, [])

  // ── Recarrega tarefas + itens quando muda o evento selecionado ──────────────
  async function carregarDados(currentUid: string, ev: string) {
    setCarregandoDados(true)
    const tq = db.from('planejador_tarefas').select('*').eq('user_id', currentUid)
    const oq = db.from('planejador_orcamento').select('*').eq('user_id', currentUid)
    if (ev) { tq.eq('evento_id', ev); oq.eq('evento_id', ev) }
    else { tq.is('evento_id', null); oq.is('evento_id', null) }

    const [{ data: td, error: te }, { data: od, error: oe }] = await Promise.all([
      tq.order('ordem', { ascending: true }).order('criado_em', { ascending: true }),
      oq.order('criado_em', { ascending: true }),
    ])

    if (isMissingTable(te) || isMissingTable(oe)) {
      setSetup(true); setTarefas([]); setItens([]); setCarregandoDados(false); return
    }
    setSetup(false)
    setTarefas((td as Tarefa[]) || [])
    setItens((od as ItemOrc[]) || [])
    setCarregandoDados(false)
  }

  useEffect(() => {
    if (!uid || loading) return
    carregarDados(uid, eventoId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, eventoId, loading])

  // ── Derivados ───────────────────────────────────────────────────────────────
  const prog = useMemo(() => progressoChecklist(tarefas), [tarefas])
  const progCat = useMemo(() => progressoPorCategoria(tarefas), [tarefas])
  const orc = useMemo(() => resumoOrcamento(itens), [itens])

  // ── Mutations: tarefas ──────────────────────────────────────────────────────
  async function gerarChecklistAuto() {
    if (!uid) return
    setGerando(true)
    const seeds = gerarChecklist(eventoAtual?.tipo_evento)
    const rows = seeds.map((s, i) => ({
      user_id: uid,
      evento_id: eventoId || null,
      titulo: s.titulo,
      categoria: s.categoria,
      concluida: false,
      ordem: i,
      origem: 'template',
    }))
    const { error } = await db.from('planejador_tarefas').insert(rows)
    if (error) {
      if (isMissingTable(error)) setSetup(true)
      toast.error('Não foi possível gerar a checklist.')
    } else {
      toast.success('Checklist criada!')
      await carregarDados(uid, eventoId)
    }
    setGerando(false)
  }

  async function adicionarTarefa(titulo: string, categoria: CategoriaPlanejador) {
    const t = titulo.trim()
    if (!t || !uid) return
    const ordem = tarefas.reduce((m, x) => Math.max(m, x.ordem ?? 0), 0) + 1
    const { data, error } = await db.from('planejador_tarefas').insert({
      user_id: uid,
      evento_id: eventoId || null,
      titulo: t,
      categoria,
      concluida: false,
      ordem,
      origem: 'manual',
    }).select('*').single()
    if (error || !data) { toast.error('Não foi possível adicionar a tarefa.'); return }
    setTarefas((prev) => [...prev, data as Tarefa])
  }

  async function alternarTarefa(id: string, concluida: boolean) {
    // Otimista.
    setTarefas((prev) => prev.map((t) => (t.id === id ? { ...t, concluida } : t)))
    const { error } = await db.from('planejador_tarefas').update({ concluida }).eq('id', id)
    if (error) {
      setTarefas((prev) => prev.map((t) => (t.id === id ? { ...t, concluida: !concluida } : t)))
      toast.error('Não foi possível atualizar.')
    }
  }

  async function removerTarefa(id: string) {
    const antes = tarefas
    setTarefas((prev) => prev.filter((t) => t.id !== id))
    const { error } = await db.from('planejador_tarefas').delete().eq('id', id)
    if (error) { setTarefas(antes); toast.error('Não foi possível remover.') }
  }

  // ── Mutations: orçamento ────────────────────────────────────────────────────
  async function adicionarItem(payload: {
    descricao: string; categoria: CategoriaPlanejador; valor_previsto: number; valor_real: number | null; pago: boolean
  }) {
    if (!uid) return false
    const { data, error } = await db.from('planejador_orcamento').insert({
      user_id: uid,
      evento_id: eventoId || null,
      descricao: payload.descricao.trim(),
      categoria: payload.categoria,
      valor_previsto: payload.valor_previsto,
      valor_real: payload.valor_real,
      pago: payload.pago,
    }).select('*').single()
    if (error || !data) {
      if (isMissingTable(error)) setSetup(true)
      toast.error('Não foi possível adicionar o item.')
      return false
    }
    setItens((prev) => [...prev, data as ItemOrc])
    return true
  }

  async function alternarPago(id: string, pago: boolean) {
    setItens((prev) => prev.map((i) => (i.id === id ? { ...i, pago } : i)))
    const { error } = await db.from('planejador_orcamento').update({ pago }).eq('id', id)
    if (error) {
      setItens((prev) => prev.map((i) => (i.id === id ? { ...i, pago: !pago } : i)))
      toast.error('Não foi possível atualizar.')
    }
  }

  async function salvarValorReal(id: string, valor_real: number | null) {
    const antes = itens
    setItens((prev) => prev.map((i) => (i.id === id ? { ...i, valor_real } : i)))
    const { error } = await db.from('planejador_orcamento').update({ valor_real }).eq('id', id)
    if (error) { setItens(antes); toast.error('Não foi possível salvar o valor.') }
  }

  async function removerItem(id: string) {
    const antes = itens
    setItens((prev) => prev.filter((i) => i.id !== id))
    const { error } = await db.from('planejador_orcamento').delete().eq('id', id)
    if (error) { setItens(antes); toast.error('Não foi possível remover.') }
  }

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-56" />
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-40 w-full" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Planejamento" title="Planejador"
        subtitle="Organize cada detalhe do seu evento: uma checklist completa e o controle do orçamento, do previsto ao pago." />

      {setup && <SetupBanner>O planejador ainda não foi ativado no banco.</SetupBanner>}

      {/* Seletor de evento */}
      <Card>
        <label htmlFor="ev-sel" className="mb-1.5 block text-[.8rem] font-semibold text-ink-muted">Planejando:</label>
        <select id="ev-sel" value={eventoId} onChange={(e) => setEventoId(e.target.value)} className={inputCls}>
          <option value="">Geral (sem evento)</option>
          {eventos.map((e) => (
            <option key={e.evento_id} value={e.evento_id}>
              {(e.nome_evento || 'Evento')}{e.data_inicio ? ` — ${formatDate(e.data_inicio)}` : ''}
            </option>
          ))}
        </select>
        {eventoAtual && (
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[.75rem] text-ink-muted">
            {eventoAtual.tipo_evento && <Badge tone="brand">{eventoAtual.tipo_evento}</Badge>}
            {eventoAtual.dias_ate != null && (
              <Badge tone={eventoAtual.dias_ate >= 0 ? 'azul' : 'cinza'}>
                {eventoAtual.dias_ate > 0 ? `Faltam ${eventoAtual.dias_ate} dias`
                  : eventoAtual.dias_ate === 0 ? 'É hoje!' : 'Evento realizado'}
              </Badge>
            )}
          </div>
        )}
      </Card>

      {/* Hero de progresso: checklist + orçamento */}
      <Card>
        <div className="grid gap-6 sm:grid-cols-2 sm:divide-x sm:divide-line">
          <div className="sm:pr-6">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Progresso do checklist</span>
              <span className="font-display text-2xl font-black text-brand">{Math.round(prog.fracao * 100)}%</span>
            </div>
            <ProgressBar value={prog.fracao} className="mt-3" />
            <div className="mt-2 text-sm text-ink-muted">
              <span className="font-semibold text-ink">{prog.concluidas}</span> de {prog.total} tarefas concluídas
              {prog.pendentes > 0 && ` · ${prog.pendentes} pendentes`}
            </div>
          </div>
          <div className="sm:pl-6">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Orçamento</span>
              <Badge tone={orc.saldo >= 0 ? 'verde' : 'vermelho'}>
                {orc.saldo >= 0 ? `${formatMoney(orc.saldo)} de folga` : `${formatMoney(Math.abs(orc.saldo))} acima`}
              </Badge>
            </div>
            <div className="mt-3 flex items-end gap-4">
              <div>
                <div className="text-[.7rem] text-ink-muted">Previsto</div>
                <div className="font-display text-xl font-extrabold text-ink">{formatMoney(orc.previsto)}</div>
              </div>
              <div>
                <div className="text-[.7rem] text-ink-muted">Real</div>
                <div className="font-display text-xl font-extrabold text-brand">{formatMoney(orc.real)}</div>
              </div>
            </div>
            <ProgressBar value={orc.previsto > 0 ? orc.pago / orc.previsto : 0} tone="verde" className="mt-3" />
            <div className="mt-1.5 text-[.72rem] text-ink-muted">{formatMoney(orc.pago)} já pagos do previsto</div>
          </div>
        </div>
      </Card>

      <Tabs
        tabs={[
          { key: 'checklist', label: 'Checklist', count: tarefas.length },
          { key: 'orcamento', label: 'Orçamento', count: itens.length },
        ]}
        active={aba} onChange={setAba}
      />

      {carregandoDados ? (
        <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-24 w-full" />)}</div>
      ) : aba === 'checklist' ? (
        <ChecklistTab
          tarefas={tarefas}
          progCat={progCat}
          gerando={gerando}
          podeGerar={!setup}
          onGerar={gerarChecklistAuto}
          onAdd={adicionarTarefa}
          onToggle={alternarTarefa}
          onRemove={removerTarefa}
        />
      ) : (
        <OrcamentoTab
          itens={itens}
          orc={orc}
          onAddClick={() => setModalItem(true)}
          onTogglePago={alternarPago}
          onSalvarReal={salvarValorReal}
          onRemove={removerItem}
        />
      )}

      {modalItem && (
        <ItemModal
          onClose={() => setModalItem(false)}
          onSave={async (p) => { const ok = await adicionarItem(p); if (ok) setModalItem(false) }}
        />
      )}
    </div>
  )
}

// ════════════════════════════════════ CHECKLIST ═══════════════════════════════
function ChecklistTab({
  tarefas, progCat, gerando, podeGerar, onGerar, onAdd, onToggle, onRemove,
}: {
  tarefas: Tarefa[]
  progCat: Record<string, { fracao: number; concluidas: number; total: number }>
  gerando: boolean
  podeGerar: boolean
  onGerar: () => void
  onAdd: (titulo: string, cat: CategoriaPlanejador) => void
  onToggle: (id: string, concluida: boolean) => void
  onRemove: (id: string) => void
}) {
  const [novo, setNovo] = useState('')
  const [cat, setCat] = useState<CategoriaPlanejador>('geral')

  if (tarefas.length === 0) {
    return (
      <EmptyState
        icon="clipboard"
        title="Nenhuma tarefa ainda"
        text="Comece com uma checklist pronta para o seu tipo de evento e ajuste o que quiser — ou adicione tarefas manualmente."
        action={
          <>
            <button onClick={onGerar} disabled={gerando || !podeGerar} className={btnPrimary}>
              <Icon name="sparkle" size={16} /> {gerando ? 'Gerando…' : 'Gerar checklist automática'}
            </button>
          </>
        }
      />
    )
  }

  // Agrupa por categoria, na ordem canônica do motor.
  const porCat = new Map<string, Tarefa[]>()
  for (const t of tarefas) {
    const c = String(t.categoria || 'geral')
    if (!porCat.has(c)) porCat.set(c, [])
    porCat.get(c)!.push(t)
  }
  // Categorias conhecidas na ordem oficial + eventuais desconhecidas ao fim.
  const ordemCats = CATEGORIAS_PLANEJADOR.map((c) => c.key as string)
  const cats = [
    ...ordemCats.filter((c) => porCat.has(c)),
    ...[...porCat.keys()].filter((c) => !ordemCats.includes(c)),
  ]

  return (
    <div className="space-y-4">
      {/* Adicionar manual */}
      <Card>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            value={novo}
            onChange={(e) => setNovo(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && novo.trim()) { onAdd(novo, cat); setNovo('') } }}
            placeholder="Nova tarefa…"
            className={inputCls}
          />
          <select value={cat} onChange={(e) => setCat(e.target.value as CategoriaPlanejador)} className={`${inputCls} sm:w-52`}>
            {CATEGORIAS_PLANEJADOR.map((c) => (
              <option key={c.key} value={c.key}>{c.emoji} {c.label}</option>
            ))}
          </select>
          <button
            onClick={() => { if (novo.trim()) { onAdd(novo, cat); setNovo('') } }}
            disabled={!novo.trim()}
            className={`${btnPrimary} sm:w-auto`}
          >
            Adicionar
          </button>
        </div>
      </Card>

      {/* Grupos por categoria */}
      {cats.map((c) => {
        const lista = porCat.get(c)!
        const p = progCat[c] || { fracao: 0, concluidas: 0, total: lista.length }
        return (
          <Section
            key={c}
            title={<span className="flex items-center gap-2"><span aria-hidden>{categoriaEmoji(c)}</span>{categoriaLabel(c)}</span>}
            action={<span className="text-[.72rem] font-semibold text-ink-muted">{p.concluidas}/{p.total}</span>}
          >
            <ProgressBar value={p.fracao} className="mb-3" />
            <Card className="p-0">
              <div className="divide-y divide-line">
                {lista.map((t) => (
                  <TarefaRow key={t.id} t={t} onToggle={onToggle} onRemove={onRemove} />
                ))}
              </div>
            </Card>
          </Section>
        )
      })}
    </div>
  )
}

function TarefaRow({ t, onToggle, onRemove }: { t: Tarefa; onToggle: (id: string, c: boolean) => void; onRemove: (id: string) => void }) {
  return (
    <div className="group flex items-center gap-3 px-4 py-3">
      <button
        onClick={() => onToggle(t.id, !t.concluida)}
        aria-label={t.concluida ? 'Marcar como pendente' : 'Concluir tarefa'}
        aria-pressed={t.concluida}
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border transition ${
          t.concluida ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-line bg-surface text-transparent hover:border-brand/50'
        }`}
      >
        <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4L19 7" /></svg>
      </button>
      <div className="min-w-0 flex-1">
        <div className={`truncate text-[.9rem] font-medium ${t.concluida ? 'text-ink-muted line-through' : 'text-ink'}`}>{t.titulo}</div>
        {t.prazo && <div className="text-[.72rem] text-ink-muted">Prazo: {formatDate(t.prazo)}</div>}
      </div>
      <button
        onClick={() => onRemove(t.id)}
        aria-label="Remover tarefa"
        className="shrink-0 rounded-lg px-2 py-1 text-ink-muted opacity-0 transition hover:bg-red-50 hover:text-red-600 group-hover:opacity-100 focus:opacity-100"
      >
        ✕
      </button>
    </div>
  )
}

// ════════════════════════════════════ ORÇAMENTO ═══════════════════════════════
function OrcamentoTab({
  itens, orc, onAddClick, onTogglePago, onSalvarReal, onRemove,
}: {
  itens: ItemOrc[]
  orc: { previsto: number; real: number; pago: number; aPagar: number; saldo: number }
  onAddClick: () => void
  onTogglePago: (id: string, pago: boolean) => void
  onSalvarReal: (id: string, valor: number | null) => void
  onRemove: (id: string) => void
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Previsto" value={formatMoney(orc.previsto)} tone="ink" icon="wallet" />
        <Kpi label="Real" value={formatMoney(orc.real)} tone="brand" icon="card" />
        <Kpi label="Pago" value={formatMoney(orc.pago)} tone="verde" icon="shield" />
        <Kpi label="A pagar" value={formatMoney(orc.aPagar)} tone="gold" icon="bell" />
      </div>

      <Card>
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Pago do previsto</span>
          <span className="text-[.78rem] font-semibold text-ink-muted">{orc.previsto > 0 ? Math.round((orc.pago / orc.previsto) * 100) : 0}%</span>
        </div>
        <ProgressBar value={orc.previsto > 0 ? orc.pago / orc.previsto : 0} tone="verde" />
      </Card>

      <Section
        title="Itens do orçamento"
        action={<button onClick={onAddClick} className={btnGhost}><Icon name="sparkle" size={15} /> Adicionar item</button>}
      >
        {itens.length === 0 ? (
          <EmptyState
            icon="card"
            title="Orçamento vazio"
            text="Adicione os custos do seu evento — buffet, decoração, fornecedores — e acompanhe o previsto × real."
            action={<button onClick={onAddClick} className={btnPrimary}><Icon name="sparkle" size={16} /> Adicionar item</button>}
          />
        ) : (
          <Card className="p-0">
            <div className="divide-y divide-line">
              {itens.map((i) => (
                <ItemRow key={i.id} i={i} onTogglePago={onTogglePago} onSalvarReal={onSalvarReal} onRemove={onRemove} />
              ))}
            </div>
          </Card>
        )}
      </Section>
    </div>
  )
}

function ItemRow({
  i, onTogglePago, onSalvarReal, onRemove,
}: {
  i: ItemOrc
  onTogglePago: (id: string, pago: boolean) => void
  onSalvarReal: (id: string, valor: number | null) => void
  onRemove: (id: string) => void
}) {
  const [editReal, setEditReal] = useState(false)
  const [valor, setValor] = useState<string>(i.valor_real == null ? '' : String(i.valor_real))

  function commit() {
    setEditReal(false)
    const trimmed = valor.trim()
    const novo = trimmed === '' ? null : Number(trimmed)
    if (novo != null && Number.isNaN(novo)) { setValor(i.valor_real == null ? '' : String(i.valor_real)); return }
    if (novo !== (i.valor_real ?? null)) onSalvarReal(i.id, novo)
  }

  return (
    <div className="group flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="truncate text-[.9rem] font-semibold text-ink">{i.descricao}</div>
        <div className="mt-1 flex items-center gap-2">
          <Badge tone="cinza">{categoriaEmoji(i.categoria)} {categoriaLabel(i.categoria)}</Badge>
          <span className="text-[.72rem] text-ink-muted">Previsto: {formatMoney(i.valor_previsto || 0)}</span>
        </div>
      </div>

      {/* Valor real (editável inline) */}
      <div className="text-right">
        <div className="text-[.66rem] uppercase tracking-wide text-ink-muted">Real</div>
        {editReal ? (
          <input
            autoFocus
            type="number"
            min={0}
            step="0.01"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setEditReal(false); setValor(i.valor_real == null ? '' : String(i.valor_real)) } }}
            className={`${inputCls} w-28 px-2 py-1 text-right`}
          />
        ) : (
          <button onClick={() => setEditReal(true)} className="text-[.92rem] font-bold text-ink hover:text-brand">
            {i.valor_real == null ? <span className="text-ink-muted">—</span> : formatMoney(i.valor_real)}
          </button>
        )}
      </div>

      {/* Pago toggle */}
      <button
        onClick={() => onTogglePago(i.id, !i.pago)}
        aria-pressed={i.pago}
        className={`shrink-0 rounded-full px-2.5 py-1 text-[.72rem] font-semibold transition ${
          i.pago ? 'bg-emerald-50 text-emerald-700' : 'bg-black/[0.05] text-ink-muted hover:text-ink'
        }`}
      >
        {i.pago ? '✓ Pago' : 'A pagar'}
      </button>

      <button
        onClick={() => onRemove(i.id)}
        aria-label="Remover item"
        className="shrink-0 rounded-lg px-2 py-1 text-ink-muted opacity-0 transition hover:bg-red-50 hover:text-red-600 group-hover:opacity-100 focus:opacity-100"
      >
        ✕
      </button>
    </div>
  )
}

function ItemModal({
  onClose, onSave,
}: {
  onClose: () => void
  onSave: (p: { descricao: string; categoria: CategoriaPlanejador; valor_previsto: number; valor_real: number | null; pago: boolean }) => void
}) {
  const [descricao, setDescricao] = useState('')
  const [categoria, setCategoria] = useState<CategoriaPlanejador>('geral')
  const [previsto, setPrevisto] = useState('')
  const [real, setReal] = useState('')
  const [pago, setPago] = useState(false)
  const [busy, setBusy] = useState(false)

  const valido = descricao.trim().length > 0 && Number(previsto) >= 0 && previsto.trim() !== ''

  async function salvar() {
    if (!valido) return
    setBusy(true)
    await onSave({
      descricao,
      categoria,
      valor_previsto: Number(previsto) || 0,
      valor_real: real.trim() === '' ? null : Number(real) || 0,
      pago,
    })
    setBusy(false)
  }

  return (
    <Modal title="Adicionar item ao orçamento" onClose={onClose}>
      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-[.8rem] font-semibold text-ink">Descrição</label>
          <input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex.: Buffet completo" className={inputCls} autoFocus />
        </div>
        <div>
          <label className="mb-1 block text-[.8rem] font-semibold text-ink">Categoria</label>
          <select value={categoria} onChange={(e) => setCategoria(e.target.value as CategoriaPlanejador)} className={inputCls}>
            {CATEGORIAS_PLANEJADOR.map((c) => (
              <option key={c.key} value={c.key}>{c.emoji} {c.label}</option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-[.8rem] font-semibold text-ink">Valor previsto</label>
            <input type="number" min={0} step="0.01" value={previsto} onChange={(e) => setPrevisto(e.target.value)} placeholder="0,00" className={inputCls} />
          </div>
          <div>
            <label className="mb-1 block text-[.8rem] font-semibold text-ink">Valor real <span className="font-normal text-ink-muted">(opcional)</span></label>
            <input type="number" min={0} step="0.01" value={real} onChange={(e) => setReal(e.target.value)} placeholder="0,00" className={inputCls} />
          </div>
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-ink">
          <input type="checkbox" checked={pago} onChange={(e) => setPago(e.target.checked)} className="h-4 w-4 rounded border-line text-brand focus:ring-brand/30" />
          Já está pago
        </label>
      </div>
      <div className="mt-5 flex gap-2">
        <button onClick={onClose} className={`${btnGhost} flex-1`}>Cancelar</button>
        <button onClick={salvar} disabled={!valido || busy} className={`${btnPrimary} flex-1`}>{busy ? 'Salvando…' : 'Adicionar'}</button>
      </div>
    </Modal>
  )
}
