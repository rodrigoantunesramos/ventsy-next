'use client'

// Carteira do cliente — /client/carteira. Saldo de créditos, extrato, resgate
// (créditos → cupom) e central de cupons. Backend: /api/client/carteira.

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase, authHeaders } from '@/lib/supabase'
import { formatMoney, formatDate, formatDateTime } from '@/lib/format'
import { tipoCreditoLabel, type LancamentoCredito } from '@/lib/creditos'
import { useToast } from '@/components/Toast'
import { PageHeader, Card, Kpi, Tabs, Badge, Modal, EmptyState, Skeleton, SetupBanner, btnPrimary, btnGhost, inputCls, Icon } from '../_ui'

type Cupom = {
  id: string; codigo: string; descricao: string | null; tipo: string; valor: number
  origem: string; status: string; validade: string | null; usado_em: string | null; criado_em: string
}
type Resumo = { saldo: number; totalGanho: number; totalUsado: number; aExpirar: number }

export default function CarteiraPage() {
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [setup, setSetup] = useState(false)
  const [aba, setAba] = useState<'creditos' | 'cupons'>('creditos')
  const [extrato, setExtrato] = useState<LancamentoCredito[]>([])
  const [cupons, setCupons] = useState<Cupom[]>([])
  const [resumo, setResumo] = useState<Resumo>({ saldo: 0, totalGanho: 0, totalUsado: 0, aExpirar: 0 })
  const [modal, setModal] = useState(false)

  async function carregar() {
    const r = await fetch('/api/client/carteira', { headers: await authHeaders() }).then((x) => x.json()).catch(() => null)
    if (!r) return
    setExtrato((r.extrato || []) as LancamentoCredito[])
    setCupons((r.cupons || []) as Cupom[])
    setResumo(r.resumo || { saldo: 0, totalGanho: 0, totalUsado: 0, aExpirar: 0 })
    setSetup(!!r.needsSetup)
  }

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setLoading(false); return }
      await carregar()
      setLoading(false)
    })()
  }, [])

  const cuponsDisponiveis = cupons.filter((c) => c.status === 'disponivel').length

  if (loading) return <div className="space-y-4"><Skeleton className="h-12 w-56" /><div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}</div><Skeleton className="h-64" /></div>

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Recompensas" title="Carteira"
        subtitle="Seus créditos Ventsy e cupons de desconto. Use nos seus eventos e reservas."
        actions={<button onClick={() => setModal(true)} disabled={resumo.saldo < 10} className={btnPrimary}><Icon name="sparkle" size={16} /> Resgatar créditos</button>} />

      {setup && <SetupBanner>A carteira ainda não foi ativada no banco.</SetupBanner>}

      {/* Saldo destaque */}
      <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-500 to-emerald-700 p-6 text-white shadow-card sm:p-8">
        <div className="text-xs font-semibold uppercase tracking-wide text-white/80">Saldo disponível</div>
        <div className="mt-1 font-display text-4xl font-black sm:text-5xl">{formatMoney(resumo.saldo)}</div>
        <div className="mt-2 text-sm text-white/85">{resumo.aExpirar > 0 ? `${formatMoney(resumo.aExpirar)} expiram em breve` : 'Use seus créditos como desconto nas reservas'}</div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Total ganho" value={formatMoney(resumo.totalGanho)} tone="verde" icon="wallet" />
        <Kpi label="Já usado" value={formatMoney(resumo.totalUsado)} tone="ink" icon="card" />
        <Kpi label="Cupons ativos" value={cuponsDisponiveis} tone="brand" icon="gift" />
        <Kpi label="A expirar (30d)" value={formatMoney(resumo.aExpirar)} tone="gold" icon="bell" />
      </div>

      <Tabs tabs={[{ key: 'creditos', label: 'Créditos', count: extrato.length }, { key: 'cupons', label: 'Cupons', count: cupons.length }]} active={aba} onChange={setAba} />

      {aba === 'creditos' ? (
        extrato.length === 0 ? (
          <EmptyState icon="wallet" title="Sua carteira está vazia" text="Ganhe créditos indicando amigos — eles caem aqui automaticamente."
            action={<Link href="/client/indique" className={btnPrimary}><Icon name="gift" size={16} /> Indicar amigos</Link>} />
        ) : (
          <Card className="p-0">
            <div className="divide-y divide-line">
              {extrato.map((l, idx) => {
                const v = Number(l.valor) || 0
                return (
                  <div key={l.id ?? idx} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${v >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-black/[0.05] text-ink-muted'}`}><Icon name={v >= 0 ? 'wallet' : 'card'} size={16} /></span>
                      <div className="min-w-0">
                        <div className="truncate text-[.88rem] font-semibold text-ink">{l.descricao || tipoCreditoLabel(l.tipo)}</div>
                        <div className="text-[.72rem] text-ink-muted">{tipoCreditoLabel(l.tipo)}{l.criado_em ? ` · ${formatDate(l.criado_em)}` : ''}{l.expira_em ? ` · expira ${formatDate(l.expira_em)}` : ''}</div>
                      </div>
                    </div>
                    <div className={`shrink-0 text-[.95rem] font-bold ${v >= 0 ? 'text-emerald-600' : 'text-ink'}`}>{v >= 0 ? '+' : '−'}{formatMoney(Math.abs(v))}</div>
                  </div>
                )
              })}
            </div>
          </Card>
        )
      ) : (
        cupons.length === 0 ? (
          <EmptyState icon="gift" title="Nenhum cupom ainda" text="Resgate créditos ou indique amigos para ganhar cupons de desconto." />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {cupons.map((c) => <CupomCard key={c.id} c={c} onCopy={() => { navigator.clipboard.writeText(c.codigo); toast.success('Código copiado!') }} />)}
          </div>
        )
      )}

      {modal && <ResgatarModal saldo={resumo.saldo} onClose={() => setModal(false)} onDone={(novo) => { setModal(false); if (novo) carregar(); }} />}
    </div>
  )
}

function CupomCard({ c, onCopy }: { c: Cupom; onCopy: () => void }) {
  const usado = c.status === 'usado'
  const expirado = c.status === 'expirado' || (c.validade && new Date(c.validade) < new Date())
  const ativo = !usado && !expirado
  const valor = c.tipo === 'percentual' ? `${c.valor}% OFF` : `${formatMoney(c.valor)} OFF`
  return (
    <div className={`relative overflow-hidden rounded-2xl border border-dashed p-4 shadow-card ${ativo ? 'border-brand/40 bg-brand-50/40' : 'border-line bg-surface opacity-70'}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-display text-xl font-black text-brand">{valor}</div>
          <div className="mt-0.5 text-[.8rem] text-ink-muted">{c.descricao || 'Cupom de desconto'}</div>
        </div>
        <Badge tone={ativo ? 'verde' : usado ? 'cinza' : 'vermelho'}>{usado ? 'Usado' : expirado ? 'Expirado' : 'Disponível'}</Badge>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <code className="flex-1 rounded-lg border border-line bg-surface px-3 py-2 text-center font-mono text-sm font-bold tracking-wider text-ink">{c.codigo}</code>
        {ativo && <button onClick={onCopy} className="shrink-0 rounded-lg bg-brand px-3 py-2 text-xs font-bold text-white">Copiar</button>}
      </div>
      {c.validade && ativo && <div className="mt-2 text-[.7rem] text-ink-muted">Válido até {formatDate(c.validade)}</div>}
      {usado && c.usado_em && <div className="mt-2 text-[.7rem] text-ink-muted">Usado em {formatDateTime(c.usado_em)}</div>}
    </div>
  )
}

function ResgatarModal({ saldo, onClose, onDone }: { saldo: number; onClose: () => void; onDone: (recarregar: boolean) => void }) {
  const toast = useToast()
  const [valor, setValor] = useState(Math.min(saldo, Math.max(10, Math.floor(saldo))))
  const [busy, setBusy] = useState(false)

  async function resgatar() {
    setBusy(true)
    try {
      const r = await fetch('/api/client/carteira', {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
        body: JSON.stringify({ action: 'resgatar', valor }),
      }).then((x) => x.json())
      if (r?.error) throw new Error(r.error)
      toast.success(`Cupom de ${formatMoney(valor)} criado! Veja na aba Cupons.`)
      onDone(true)
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Falha ao resgatar.'); setBusy(false) }
  }

  return (
    <Modal title="Resgatar créditos" onClose={onClose}>
      <p className="mb-3 text-sm text-ink-muted">Transforme seus créditos num cupom de desconto para usar nos seus eventos. Mínimo de {formatMoney(10)}.</p>
      <label className="mb-1 block text-[.8rem] font-semibold text-ink-soft">Valor a resgatar</label>
      <input type="number" min={10} max={Math.floor(saldo)} step={1} value={valor} onChange={(e) => setValor(Math.floor(Number(e.target.value) || 0))} className={inputCls} />
      <div className="mt-2 flex items-center justify-between text-[.78rem] text-ink-muted"><span>Saldo: {formatMoney(saldo)}</span><button onClick={() => setValor(Math.floor(saldo))} className="font-semibold text-brand">Usar tudo</button></div>
      <div className="mt-4 flex gap-2">
        <button onClick={onClose} className={`${btnGhost} flex-1`}>Cancelar</button>
        <button onClick={resgatar} disabled={busy || valor < 10 || valor > saldo} className={`${btnPrimary} flex-1`}>{busy ? 'Resgatando…' : `Resgatar ${formatMoney(valor)}`}</button>
      </div>
    </Modal>
  )
}
