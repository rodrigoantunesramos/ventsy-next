'use client'

// Indique & Ganhe (cliente) — /client/indique. Código + link de convite,
// compartilhamento (WhatsApp/e-mail/copiar), KPIs, como funciona, convite por
// e-mail (registra pendência) e histórico. Backend: /api/client/indicacoes +
// (conversão automática via gatilho ao 1º evento do indicado).

import { useEffect, useMemo, useState } from 'react'
import { supabase, authHeaders } from '@/lib/supabase'
import { waShareLink } from '@/lib/waLink'
import { formatMoney, formatDate } from '@/lib/format'
import { linkIndicacao, kpisIndicacoes, mensagemConvite, assuntoConvite, statusIndicacaoLabel, type IndicacaoCliente } from '@/lib/indique'
import { useToast } from '@/components/Toast'
import { PageHeader, Card, Kpi, Section, Badge, Modal, EmptyState, Skeleton, btnPrimary, btnGhost, inputCls, Icon } from '../_ui'

export default function IndiquePage() {
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [codigo, setCodigo] = useState('')
  const [origin, setOrigin] = useState('')
  const [lista, setLista] = useState<IndicacaoCliente[]>([])
  const [copied, setCopied] = useState<'codigo' | 'link' | null>(null)
  const [modal, setModal] = useState(false)

  async function carregar() {
    const r = await fetch('/api/client/indicacoes', { headers: await authHeaders() }).then((x) => x.json()).catch(() => ({}))
    setCodigo(r?.codigo || '')
    setLista((r?.indicacoes || []) as IndicacaoCliente[])
  }

  useEffect(() => {
    setOrigin(window.location.origin)
    ;(async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setLoading(false); return }
      await carregar()
      setLoading(false)
    })()
  }, [])

  const link = useMemo(() => linkIndicacao(origin, codigo), [origin, codigo])
  const kpis = useMemo(() => kpisIndicacoes(lista), [lista])
  const msg = useMemo(() => mensagemConvite(link), [link])

  function copiar(tipo: 'codigo' | 'link', texto: string) {
    if (!texto) return
    navigator.clipboard.writeText(texto).then(() => { setCopied(tipo); setTimeout(() => setCopied(null), 2000) })
  }

  if (loading) return <div className="space-y-4"><Skeleton className="h-12 w-64" /><Skeleton className="h-48" /><div className="grid grid-cols-3 gap-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-24" />)}</div></div>

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Recompensas" title="Indique & Ganhe"
        subtitle="Convide amigos para a Ventsy. Quando eles começam a usar, você ganha créditos — e eles recebem um cupom de boas-vindas."
        actions={<button onClick={() => setModal(true)} className={btnGhost}><Icon name="user" size={16} /> Convidar por e-mail</button>} />

      {/* Hero código/link */}
      <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-brand to-brand-700 p-6 text-white shadow-card sm:p-8">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-white/70">Seu código</div>
            <div className="mt-1.5 flex items-center gap-3">
              <span className="font-display text-3xl font-black tracking-wider">{codigo || '—'}</span>
              <button onClick={() => copiar('codigo', codigo)} className="rounded-full bg-white/20 px-3 py-1 text-xs font-semibold backdrop-blur transition hover:bg-white/30">{copied === 'codigo' ? '✓ Copiado' : 'Copiar'}</button>
            </div>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-white/70">Seu link de convite</div>
            <div className="mt-1.5 flex items-center gap-2">
              <input readOnly value={link} className="min-w-0 flex-1 rounded-lg bg-white/15 px-3 py-2 text-sm text-white backdrop-blur" />
              <button onClick={() => copiar('link', link)} className="shrink-0 rounded-lg bg-white px-3 py-2 text-xs font-bold text-brand transition hover:bg-white/90">{copied === 'link' ? '✓' : 'Copiar'}</button>
            </div>
          </div>
        </div>
        <div className="mt-6 flex flex-wrap gap-2">
          <a href={waShareLink(msg)} target="_blank" rel="noreferrer" className="rounded-full bg-white/20 px-4 py-2 text-sm font-semibold backdrop-blur transition hover:bg-white/30">📱 WhatsApp</a>
          <a href={`mailto:?subject=${encodeURIComponent(assuntoConvite())}&body=${encodeURIComponent(msg)}`} className="rounded-full bg-white/20 px-4 py-2 text-sm font-semibold backdrop-blur transition hover:bg-white/30">✉️ E-mail</a>
          <button onClick={() => copiar('link', link)} className="rounded-full bg-white/20 px-4 py-2 text-sm font-semibold backdrop-blur transition hover:bg-white/30">🔗 Copiar link</button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Convidados" value={kpis.indicados} tone="ink" icon="gift" />
        <Kpi label="Cadastraram" value={kpis.cadastrados} tone="azul" icon="user" />
        <Kpi label="Viraram clientes" value={kpis.convertidos} tone="verde" icon="sparkle" />
        <Kpi label="Créditos ganhos" value={formatMoney(kpis.creditosGanhos)} tone="brand" icon="wallet" destaque />
      </div>

      {/* Como funciona */}
      <Section title="Como funciona">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[
            { n: '1', t: 'Compartilhe seu link', d: 'Envie por WhatsApp, e-mail ou redes para amigos que vão dar uma festa ou evento.' },
            { n: '2', t: 'Seu amigo entra e reserva', d: 'Ele ganha um cupom de boas-vindas e faz a primeira reserva pela Ventsy.' },
            { n: '3', t: 'Você ganha créditos', d: 'A recompensa cai automaticamente na sua carteira para usar em reservas.' },
          ].map((p) => (
            <Card key={p.n}>
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-50 text-sm font-bold text-brand">{p.n}</div>
              <div className="mt-3 font-bold text-ink">{p.t}</div>
              <div className="mt-1 text-sm text-ink-muted">{p.d}</div>
            </Card>
          ))}
        </div>
      </Section>

      {/* Histórico */}
      <Section title="Suas indicações">
        {lista.length === 0 ? (
          <EmptyState icon="gift" title="Nenhuma indicação ainda" text="Compartilhe seu link e comece a ganhar créditos a cada amigo que entrar."
            action={<a href={waShareLink(msg)} target="_blank" rel="noreferrer" className={btnPrimary}>Compartilhar no WhatsApp</a>} />
        ) : (
          <Card className="p-0">
            <div className="divide-y divide-line">
              {lista.map((i, idx) => {
                const s = String(i.status ?? 'pendente')
                const tone = s === 'convertido' ? 'verde' : s === 'cadastrado' ? 'azul' : 'cinza'
                return (
                  <div key={i.id ?? idx} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <div className="truncate text-[.9rem] font-semibold text-ink">{i.indicado_nome || i.indicado_email || 'Convite enviado'}</div>
                      <div className="text-[.74rem] text-ink-muted">{i.criado_em ? formatDate(i.criado_em) : ''}{i.convertido_em ? ` · ativou em ${formatDate(i.convertido_em)}` : ''}</div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {i.status === 'convertido' && i.recompensa_paga ? <span className="text-[.82rem] font-semibold text-emerald-600">+{formatMoney(i.recompensa_creditos || 0)}</span> : null}
                      <Badge tone={tone}>{statusIndicacaoLabel(i.status)}</Badge>
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>
        )}
      </Section>

      {modal && <ConviteModal onClose={() => setModal(false)} onSent={() => { setModal(false); toast.success('Convite registrado! Compartilhe seu link com o amigo.'); carregar() }} />}
    </div>
  )
}

function ConviteModal({ onClose, onSent }: { onClose: () => void; onSent: () => void }) {
  const toast = useToast()
  const [email, setEmail] = useState('')
  const [nome, setNome] = useState('')
  const [busy, setBusy] = useState(false)

  async function enviar() {
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { toast.error('Informe um e-mail válido.'); return }
    setBusy(true)
    try {
      const r = await fetch('/api/client/indicacoes', {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
        body: JSON.stringify({ action: 'convidar', email, nome }),
      }).then((x) => x.json())
      if (r?.error) throw new Error(r.error)
      onSent()
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Falha ao registrar.'); setBusy(false) }
  }

  return (
    <Modal title="Convidar por e-mail" onClose={onClose}>
      <p className="mb-3 text-sm text-ink-muted">Registre o convite para acompanhar por aqui. Depois é só mandar seu link para o amigo.</p>
      <div className="space-y-2.5">
        <input className={inputCls} placeholder="Nome do amigo (opcional)" value={nome} onChange={(e) => setNome(e.target.value)} />
        <input className={inputCls} placeholder="E-mail do amigo *" value={email} onChange={(e) => setEmail(e.target.value)} />
        <button onClick={enviar} disabled={busy} className={`${btnPrimary} w-full`}>{busy ? 'Registrando…' : 'Registrar convite'}</button>
      </div>
    </Modal>
  )
}
