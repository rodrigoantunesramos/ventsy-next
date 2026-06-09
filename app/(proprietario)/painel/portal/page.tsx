'use client'
// Portal do Cliente — /painel/portal (lado do DONO).
// Configura a área logada que o CONTRATANTE usa para acompanhar o próprio evento:
// liga/desliga o portal, escolhe a cor + mensagem de boas-vindas, define quais
// módulos ficam visíveis (global e por evento) e convida cada contratante por
// e-mail (link com token). Os dados vêm de portal_config/portal_acessos/convidados
// (escopados por usuario_id) e as operações passam por /api/portal. Sem "R$"
// hardcoded — moeda via lib/format.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabaseAny as sb } from '@/lib/supabase'
import { formatMoney, formatDate } from '@/lib/format'
import { useToast } from '@/components/Toast'
import { MODULOS_PORTAL, modulosVisiveis, isMissingTable, type ModulosMap } from '@/lib/portal'
import {
  portalApi, linkConvite, STATUS_LABEL, STATUS_CHIP,
  type PortalConfig, type Acesso, type EventoRow, type ConvidadoRow,
} from './_lib'

const inp = 'w-full rounded-xl border border-black/10 bg-white px-3.5 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20'
const btnPri = 'inline-flex items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50'
const btnSec = 'inline-flex items-center justify-center gap-2 rounded-xl border border-black/10 bg-white px-3.5 py-2 text-sm font-medium hover:bg-black/[0.03]'

function defaultConfig(uid: string): PortalConfig {
  return { usuario_id: uid, ativo: true, cor: '#ff385c', boas_vindas: '', modulos: {} }
}

export default function PortalDonoPage() {
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [needsSetup, setNeedsSetup] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)

  const [config, setConfig] = useState<PortalConfig | null>(null)
  const [eventos, setEventos] = useState<EventoRow[]>([])
  const [acessos, setAcessos] = useState<Acesso[]>([])
  const [convidados, setConvidados] = useState<ConvidadoRow[]>([])

  const [busca, setBusca] = useState('')
  const [savingCfg, setSavingCfg] = useState(false)
  const [gerenciar, setGerenciar] = useState<EventoRow | null>(null)

  const carregar = useCallback(async (uid: string) => {
    const [cfgRes, evRes, acRes, cvRes] = await Promise.all([
      sb.from('portal_config').select('*').eq('usuario_id', uid).maybeSingle(),
      sb.from('clientes_eventos')
        .select('id,nome_evento,quem_contratou,email,tipo_evento,data_inicio,status,propriedade_id,valor_total_num')
        .eq('usuario_id', uid).order('data_inicio', { ascending: false }),
      sb.from('portal_acessos').select('*').eq('usuario_id', uid),
      sb.from('convidados').select('id,evento_id,status').eq('usuario_id', uid),
    ])
    if (acRes.error && isMissingTable(acRes.error)) { setNeedsSetup(true); return }
    setNeedsSetup(false)
    const c = cfgRes.data as PortalConfig | null
    setConfig(c ? { ...defaultConfig(uid), ...c, modulos: (c.modulos || {}) as ModulosMap } : defaultConfig(uid))
    setEventos((evRes.data || []) as EventoRow[])
    setAcessos((acRes.data || []) as Acesso[])
    setConvidados((cvRes.data || []) as ConvidadoRow[])
  }, [])

  useEffect(() => {
    (async () => {
      const { data: { session } } = await sb.auth.getSession()
      if (!session) { setLoading(false); return }
      setUserId(session.user.id)
      await carregar(session.user.id)
      setLoading(false)
    })()
  }, [carregar])

  const acessosByEvento = useMemo(() => {
    const m = new Map<string, Acesso[]>()
    for (const a of acessos) {
      const arr = m.get(a.evento_id) || []
      arr.push(a)
      m.set(a.evento_id, arr)
    }
    return m
  }, [acessos])

  const convidadosByEvento = useMemo(() => {
    const m = new Map<string, ConvidadoRow[]>()
    for (const c of convidados) {
      const arr = m.get(c.evento_id) || []
      arr.push(c)
      m.set(c.evento_id, arr)
    }
    return m
  }, [convidados])

  const kpis = useMemo(() => {
    const comAcesso = eventos.filter((e) => (acessosByEvento.get(e.id) || []).some((a) => a.status !== 'revogado')).length
    const ativos = acessos.filter((a) => a.status === 'ativo').length
    const pendentes = acessos.filter((a) => a.status === 'convidado').length
    const confirmados = convidados.filter((c) => ['confirmado', 'checkin'].includes(String(c.status))).length
    return { comAcesso, ativos, pendentes, confirmados }
  }, [eventos, acessos, convidados, acessosByEvento])

  const eventosFiltrados = useMemo(() => {
    const q = busca.trim().toLowerCase()
    if (!q) return eventos
    return eventos.filter((e) =>
      `${e.nome_evento || ''} ${e.quem_contratou || ''} ${e.email || ''}`.toLowerCase().includes(q),
    )
  }, [eventos, busca])

  async function salvarConfig(patch: Partial<PortalConfig>) {
    if (!config) return
    const novo = { ...config, ...patch }
    setConfig(novo)
    setSavingCfg(true)
    try {
      await portalApi('salvar_config', {
        ativo: novo.ativo, cor: novo.cor, boas_vindas: novo.boas_vindas, modulos: novo.modulos,
      })
      toast.success('Configuração salva.')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao salvar.')
    } finally {
      setSavingCfg(false)
    }
  }

  function toggleModuloGlobal(key: string) {
    if (!config) return
    const atual = config.modulos[key as keyof ModulosMap]
    const visivelAgora = atual !== false
    const modulos = { ...config.modulos, [key]: !visivelAgora }
    salvarConfig({ modulos })
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl space-y-4">
        <div className="h-[72px] animate-pulse rounded-2xl bg-black/[0.05]" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[0, 1, 2, 3].map((i) => <div key={i} className="h-24 animate-pulse rounded-2xl bg-black/[0.05]" />)}
        </div>
        <div className="h-64 animate-pulse rounded-2xl bg-black/[0.05]" />
      </div>
    )
  }

  if (needsSetup) {
    return (
      <div className="mx-auto max-w-3xl">
        <Header />
        <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-2xl">🔌</div>
          <h3 className="text-base font-bold text-ink">Ative o Portal do Cliente</h3>
          <p className="mx-auto mt-1 max-w-lg text-sm text-ink-muted">
            Rode <code className="rounded bg-black/[0.06] px-1.5 py-0.5 text-xs">docs/sql/portal.sql</code> no Supabase
            para criar as tabelas <code className="text-xs">portal_config</code>, <code className="text-xs">portal_acessos</code> e <code className="text-xs">convidados</code>. Depois recarregue.
          </p>
        </div>
      </div>
    )
  }

  const cfg = config!

  return (
    <div className="mx-auto max-w-6xl">
      <Header />

      {/* KPIs */}
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi label="Eventos" value={eventos.length} hint="no seu CRM" />
        <Kpi label="Com acesso" value={kpis.comAcesso} hint="portal liberado" />
        <Kpi label="Convites pendentes" value={kpis.pendentes} hint="aguardando o cliente" />
        <Kpi label="Convidados confirmados" value={kpis.confirmados} hint="RSVP dos eventos" />
      </div>

      {/* Configuração global */}
      <section className="mt-6 rounded-2xl border border-black/[0.06] bg-white p-5 shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-ink">Configuração do portal</h2>
            <p className="mt-0.5 text-sm text-ink-muted">Vale para todos os eventos — você pode personalizar caso a caso ao gerenciar cada acesso.</p>
          </div>
          <label className="inline-flex cursor-pointer items-center gap-2">
            <span className="text-sm font-medium text-ink-soft">{cfg.ativo ? 'Ativo' : 'Desativado'}</span>
            <button
              type="button"
              role="switch"
              aria-checked={cfg.ativo}
              onClick={() => salvarConfig({ ativo: !cfg.ativo })}
              disabled={savingCfg}
              className={`relative h-6 w-11 rounded-full transition-colors ${cfg.ativo ? 'bg-brand' : 'bg-black/15'}`}
            >
              <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${cfg.ativo ? 'left-[22px]' : 'left-0.5'}`} />
            </button>
          </label>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-semibold text-ink-soft">Mensagem de boas-vindas</label>
            <textarea
              className={inp}
              rows={3}
              placeholder="Ex.: Que alegria ter você por aqui! Acompanhe tudo do seu evento neste portal."
              value={cfg.boas_vindas || ''}
              onChange={(e) => setConfig({ ...cfg, boas_vindas: e.target.value })}
              onBlur={(e) => { if ((config?.boas_vindas || '') !== e.target.value) salvarConfig({ boas_vindas: e.target.value }) }}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-ink-soft">Cor de destaque</label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                aria-label="Cor de destaque do portal"
                value={cfg.cor || '#ff385c'}
                onChange={(e) => setConfig({ ...cfg, cor: e.target.value })}
                onBlur={(e) => { if ((config?.cor || '') !== e.target.value) salvarConfig({ cor: e.target.value }) }}
                className="h-10 w-14 cursor-pointer rounded-lg border border-black/10 bg-white p-1"
              />
              <span className="text-sm text-ink-muted">{cfg.cor}</span>
            </div>
            <div className="mt-4">
              <div className="mb-1.5 text-xs font-semibold text-ink-soft">Módulos visíveis por padrão</div>
              <div className="flex flex-wrap gap-2">
                {MODULOS_PORTAL.map((m) => {
                  const visivel = m.fixo || cfg.modulos[m.key] !== false
                  return (
                    <button
                      key={m.key}
                      type="button"
                      disabled={m.fixo || savingCfg}
                      onClick={() => toggleModuloGlobal(m.key)}
                      title={m.fixo ? 'Sempre visível' : m.descricao}
                      className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                        visivel ? 'border-brand/30 bg-brand-50 text-brand' : 'border-black/10 bg-white text-ink-muted'
                      } ${m.fixo ? 'cursor-default opacity-80' : ''}`}
                    >
                      {visivel ? '✓ ' : ''}{m.label}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Eventos */}
      <section className="mt-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-bold text-ink">Acesso por evento</h2>
          <input className={`${inp} max-w-xs`} placeholder="Buscar evento ou contratante…" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>

        {eventos.length === 0 ? (
          <div className="rounded-2xl border border-black/[0.06] bg-white p-10 text-center shadow-card">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-2xl">🎉</div>
            <h3 className="text-base font-bold text-ink">Nenhum evento ainda</h3>
            <p className="mx-auto mt-1 max-w-md text-sm text-ink-muted">
              Cadastre eventos em <span className="font-medium text-ink-soft">Clientes</span> ou <span className="font-medium text-ink-soft">Propostas</span> e eles aparecerão aqui para você liberar o portal ao contratante.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {eventosFiltrados.map((ev) => {
              const evAcessos = (acessosByEvento.get(ev.id) || []).filter((a) => a.status !== 'revogado')
              const principal = evAcessos[0]
              const nConvidados = (convidadosByEvento.get(ev.id) || []).length
              return (
                <div key={ev.id} className="rounded-2xl border border-black/[0.06] bg-white p-4 shadow-card">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate text-sm font-bold text-ink">{ev.nome_evento || 'Evento sem nome'}</h3>
                        {ev.tipo_evento && <span className="rounded-full bg-black/[0.04] px-2 py-0.5 text-[0.68rem] font-medium text-ink-muted">{ev.tipo_evento}</span>}
                      </div>
                      <div className="mt-0.5 text-xs text-ink-muted">
                        {ev.quem_contratou || 'Contratante não informado'}
                        {ev.email ? ` · ${ev.email}` : ''}
                        {ev.data_inicio ? ` · ${formatDate(ev.data_inicio)}` : ''}
                        {ev.valor_total_num ? ` · ${formatMoney(ev.valor_total_num)}` : ''}
                        {nConvidados > 0 ? ` · ${nConvidados} convidado(s)` : ''}
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        {evAcessos.length === 0 ? (
                          <span className="text-xs text-ink-muted/80">Nenhum convite enviado.</span>
                        ) : (
                          evAcessos.map((a) => (
                            <span key={a.id} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.7rem] font-medium ${STATUS_CHIP[a.status]}`}>
                              {a.email} · {STATUS_LABEL[a.status]}
                            </span>
                          ))
                        )}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {principal && (
                        <button className={btnSec} onClick={() => copiar(linkConvite(principal.token), toast)} title="Copiar link de acesso">
                          <IcoLink /> Link
                        </button>
                      )}
                      <button className={btnPri} onClick={() => setGerenciar(ev)}>
                        {evAcessos.length ? 'Gerenciar' : 'Convidar'}
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {gerenciar && (
        <GerenciarModal
          evento={gerenciar}
          config={cfg}
          acessos={acessosByEvento.get(gerenciar.id) || []}
          onClose={() => setGerenciar(null)}
          onChanged={() => userId && carregar(userId)}
        />
      )}
    </div>
  )
}

// ── Header ───────────────────────────────────────────────────────────────────
function Header() {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="text-xl font-bold text-ink sm:text-2xl">Portal do Cliente</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Dê ao contratante uma área para acompanhar o próprio evento — contrato, pagamentos, convidados e mensagens — e reduza o seu trabalho.
        </p>
      </div>
    </div>
  )
}

function Kpi({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="rounded-2xl border border-black/[0.06] bg-white p-4 shadow-card">
      <div className="text-2xl font-bold text-ink">{value}</div>
      <div className="mt-0.5 text-xs font-medium text-ink-soft">{label}</div>
      {hint && <div className="text-[0.68rem] text-ink-muted">{hint}</div>}
    </div>
  )
}

// ── Modal: gerenciar acesso de um evento ──────────────────────────────────────
function GerenciarModal({
  evento, config, acessos, onClose, onChanged,
}: {
  evento: EventoRow
  config: PortalConfig
  acessos: Acesso[]
  onClose: () => void
  onChanged: () => void
}) {
  const toast = useToast()
  const ativos = acessos.filter((a) => a.status !== 'revogado')
  const [email, setEmail] = useState(ativos.length ? '' : (evento.email || ''))
  const [busy, setBusy] = useState(false)

  // Override por evento (aplicado a todos os acessos do evento).
  const baseAcesso = ativos[0] || null
  const [personalizar, setPersonalizar] = useState(!!baseAcesso?.modulos)
  const [modulos, setModulos] = useState<ModulosMap>(() => {
    const vis = modulosVisiveis(config, baseAcesso ? { modulos: baseAcesso.modulos } : null)
    const m: ModulosMap = {}
    for (const md of MODULOS_PORTAL) if (!md.fixo) m[md.key] = vis[md.key]
    return m
  })
  const [boasVindas, setBoasVindas] = useState(baseAcesso?.boas_vindas || '')

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  async function run(fn: () => Promise<unknown>, okMsg?: string) {
    setBusy(true)
    try { await fn(); if (okMsg) toast.success(okMsg); onChanged() }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Falha na operação.') }
    finally { setBusy(false) }
  }

  async function convidar() {
    const e = email.trim().toLowerCase()
    if (!e) { toast.error('Informe um e-mail.'); return }
    await run(async () => {
      const r = await portalApi('convidar', { evento_id: evento.id, email: e })
      setEmail('')
      toast.success((r as { email_enviado?: boolean }).email_enviado ? 'Convite enviado por e-mail!' : 'Convite criado — copie o link para enviar ao cliente.')
    })
  }

  async function aplicarConfig() {
    const payload = { modulos: personalizar ? modulos : null, boas_vindas: boasVindas.trim() || null }
    await run(async () => {
      await Promise.all(ativos.map((a) => portalApi('config_evento', { acesso_id: a.id, ...payload })))
    }, 'Preferências deste evento salvas.')
  }

  return (
    <div className="fixed inset-0 z-[300] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-5 shadow-pop sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-ink">{evento.nome_evento || 'Evento'}</h3>
            <p className="text-xs text-ink-muted">Gerencie quem acessa e o que aparece no portal deste evento.</p>
          </div>
          <button onClick={onClose} aria-label="Fechar" className="rounded-lg p-1.5 text-ink-muted hover:bg-black/[0.04]">✕</button>
        </div>

        {/* Acessos existentes */}
        <div className="mt-4">
          <div className="text-xs font-semibold text-ink-soft">Contratantes com acesso</div>
          {ativos.length === 0 && acessos.length === 0 && (
            <p className="mt-1 text-sm text-ink-muted">Ninguém ainda. Convide abaixo.</p>
          )}
          <div className="mt-2 space-y-2">
            {acessos.map((a) => (
              <div key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-black/[0.06] bg-[#fafafa] p-2.5">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-ink">{a.email}</div>
                  <div className="text-[0.7rem] text-ink-muted">
                    <span className={`mr-1 rounded-full px-1.5 py-0.5 ${STATUS_CHIP[a.status]}`}>{STATUS_LABEL[a.status]}</span>
                    {a.ultimo_acesso_em ? `Último acesso ${formatDate(a.ultimo_acesso_em)}` : (a.aceito_em ? `Aceito ${formatDate(a.aceito_em)}` : 'Aguardando primeiro acesso')}
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button className={btnSec} disabled={busy} onClick={() => copiar(linkConvite(a.token), toast)} title="Copiar link"><IcoLink /></button>
                  {a.status !== 'revogado' && (
                    <button className={btnSec} disabled={busy} onClick={() => run(() => portalApi('reenviar', { acesso_id: a.id }), 'Convite reenviado.')} title="Reenviar e-mail"><IcoMail /></button>
                  )}
                  {a.status === 'revogado'
                    ? <button className={btnSec} disabled={busy} onClick={() => run(() => portalApi('reativar', { acesso_id: a.id }), 'Acesso reativado.')}>Reativar</button>
                    : <button className={`${btnSec} text-red-600`} disabled={busy} onClick={() => run(() => portalApi('revogar', { acesso_id: a.id }), 'Acesso revogado.')}>Revogar</button>}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Convidar */}
        <div className="mt-4 rounded-xl border border-black/[0.06] p-3">
          <label className="mb-1 block text-xs font-semibold text-ink-soft">Convidar contratante por e-mail</label>
          <div className="flex gap-2">
            <input className={inp} type="email" placeholder="email@exemplo.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            <button className={btnPri} disabled={busy} onClick={convidar}>Convidar</button>
          </div>
          <p className="mt-1 text-[0.7rem] text-ink-muted">O cliente entra fazendo login (ou cadastro) com este e-mail. Se o e-mail não estiver configurado, copie o link e envie você mesmo.</p>
        </div>

        {/* Preferências do evento */}
        <div className="mt-4 rounded-xl border border-black/[0.06] p-3">
          <div className="text-xs font-semibold text-ink-soft">Preferências deste evento</div>
          <label className="mt-2 flex items-center gap-2 text-sm text-ink-soft">
            <input type="checkbox" checked={personalizar} onChange={(e) => setPersonalizar(e.target.checked)} className="h-4 w-4 rounded border-black/20 text-brand focus:ring-brand/30" />
            Personalizar os módulos visíveis (senão herda o padrão global)
          </label>
          {personalizar && (
            <div className="mt-2 flex flex-wrap gap-2">
              {MODULOS_PORTAL.filter((m) => !m.fixo).map((m) => {
                const on = modulos[m.key] !== false
                return (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => setModulos({ ...modulos, [m.key]: !on })}
                    className={`rounded-full border px-3 py-1 text-xs font-medium ${on ? 'border-brand/30 bg-brand-50 text-brand' : 'border-black/10 bg-white text-ink-muted'}`}
                  >
                    {on ? '✓ ' : ''}{m.label}
                  </button>
                )
              })}
            </div>
          )}
          <label className="mb-1 mt-3 block text-xs font-semibold text-ink-soft">Boas-vindas só deste evento (opcional)</label>
          <textarea className={inp} rows={2} value={boasVindas} onChange={(e) => setBoasVindas(e.target.value)} placeholder="Deixe vazio para usar a mensagem padrão." />
          <div className="mt-2 flex justify-end">
            <button className={btnPri} disabled={busy || ativos.length === 0} onClick={aplicarConfig} title={ativos.length === 0 ? 'Convide alguém primeiro' : ''}>Salvar preferências</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Util ───────────────────────────────────────────────────────────────────────
function copiar(text: string, toast: ReturnType<typeof useToast>) {
  navigator.clipboard?.writeText(text).then(
    () => toast.success('Link copiado!'),
    () => toast.error('Não foi possível copiar.'),
  )
}

function IcoLink() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" />
    </svg>
  )
}
function IcoMail() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Zm0 1 8 7 8-7" />
    </svg>
  )
}
