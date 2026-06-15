'use client';

// Reservas & Agenda multi-espaço — /painel/reservas.
// Três lentes sobre a tabela `reservas` + `espacos`:
//   • Agenda     — todas as reservas/holds/bloqueios dos MEUS espaços (sou
//     anfitrião), com criação conflito-checada (lib/reservas + /api/reservas),
//     confirmação de hold e feed iCal.
//   • Solicitações — inbox de marketplace (aprovar/recusar pedidos do site),
//     minhas solicitações como hóspede e conexão Mercado Pago. (Preservado.)
//   • Espaços    — CRUD dos sub-espaços reserváveis de cada propriedade.
// Sem "R$" hardcoded — tudo via lib/format.

import { useEffect, useMemo, useState, useCallback } from 'react';
import Link from 'next/link';
import { supabase, authHeaders } from '@/lib/supabase';
import { formatMoney, formatDate, formatDateTime } from '@/lib/format';
import { useToast } from '@/components/Toast';
import CheckoutReserva from '@/components/CheckoutReserva';
import { ReservaEditor } from '@/components/ReservaEditor';
import { EspacoEditor } from './_components/EspacoEditor';
import {
  statusMeta, toRange, ocupaSlot, holdExpirado, ESPACO_TIPO_LABEL,
  type Espaco, type Reserva,
} from '@/lib/reservas';

type PropJoin = { id: number; nome: string | null; cidade: string | null; estado: string | null };
type ReservaRow = Reserva & { propriedade?: PropJoin | null; email?: string | null };
type Prop = { id: number; nome: string | null };

type Tab = 'agenda' | 'solicitacoes' | 'espacos';

const OPERACIONAL = new Set(['hold', 'confirmada', 'bloqueio', 'manutencao']);
const MKT_STATUS = ['solicitada', 'aprovada', 'recusada', 'paga', 'realizada', 'avaliada'];

function isMissingTable(err: { code?: string; message?: string } | null | undefined): boolean {
  if (!err) return false;
  return err.code === '42P01' || err.code === 'PGRST205' || err.code === 'PGRST202'
    || /could not find the table|schema cache|does not exist/i.test(err.message || '');
}

function periodoReserva(r: Reserva) {
  if (r.inicio) return `${formatDateTime(r.inicio)}${r.fim ? ' → ' + formatDateTime(r.fim) : ''}`;
  const f = (d: string | null | undefined) => (d ? formatDate(d.slice(0, 10), { style: 'short' }) : '—');
  if (r.modo === 'diaria') return `${f(r.data_inicio)}${r.data_fim ? ' — ' + f(r.data_fim) : ''}`;
  if (r.modo === 'hora') return `${f(r.data_inicio)} · ${r.horas || 0}h`;
  return f(r.data_inicio);
}
function valorLabel(v: number | null | undefined) {
  return v && v > 0 ? formatMoney(v) : 'A combinar';
}

// ── Card de marketplace (host/guest) — preservado do fluxo público ────────────
function MktCard({ r, papel, onStatus, onPagar }: { r: ReservaRow; papel: 'host' | 'guest'; onStatus: (id: string, s: string) => void; onPagar?: (r: ReservaRow) => void }) {
  const meta = statusMeta(r.status);
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Link href={`/propriedade/${r.propriedade_id}`} className="font-display text-lg font-bold text-ink transition-colors hover:text-brand">
            {r.propriedade?.nome || `Espaço #${r.propriedade_id}`}
          </Link>
          <p className="text-sm text-ink-muted">{[r.propriedade?.cidade, r.propriedade?.estado].filter(Boolean).join(', ')}</p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${meta.chip}`}>{meta.label}</span>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
        <div><span className="text-ink-muted">Quando:</span> <span className="font-medium text-ink-soft">{periodoReserva(r)}</span></div>
        <div><span className="text-ink-muted">Pessoas:</span> <span className="font-medium text-ink-soft">{r.pessoas || '—'}</span></div>
        <div><span className="text-ink-muted">Evento:</span> <span className="font-medium text-ink-soft">{r.tipo_evento || '—'}</span></div>
        <div><span className="text-ink-muted">Estimativa:</span> <span className="font-medium text-ink-soft">{valorLabel(r.valor_estimado)}</span></div>
        {papel === 'host' && r.nome && (
          <div className="col-span-2"><span className="text-ink-muted">Solicitante:</span> <span className="font-medium text-ink-soft">{r.nome}</span></div>
        )}
      </div>
      {papel === 'host' && r.status === 'solicitada' && (
        <div className="mt-4 flex gap-2">
          <button onClick={() => onStatus(r.id, 'aprovada')} className="flex-1 rounded-xl bg-brand py-2.5 text-sm font-bold text-white transition-colors hover:bg-brand-600">Aprovar</button>
          <button onClick={() => onStatus(r.id, 'recusada')} className="flex-1 rounded-xl border border-gray-300 bg-white py-2.5 text-sm font-semibold text-ink-soft transition-colors hover:border-gray-400">Recusar</button>
        </div>
      )}
      {papel === 'guest' && r.status === 'aprovada' && onPagar && (
        <button onClick={() => onPagar(r)} className="mt-4 w-full rounded-xl bg-brand py-2.5 text-sm font-bold text-white transition-colors hover:bg-brand-600">Pagar agora</button>
      )}
      {papel === 'guest' && (r.status === 'solicitada' || r.status === 'aprovada') && (
        <div className="mt-3">
          <button onClick={() => onStatus(r.id, 'cancelada')} className="text-sm font-medium text-ink-muted underline transition-colors hover:text-red-600">Cancelar solicitação</button>
        </div>
      )}
    </div>
  );
}

export default function ReservasPage() {
  const toast = useToast();
  const [userId, setUserId] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('agenda');

  const [reservas, setReservas] = useState<ReservaRow[]>([]);
  const [props, setProps] = useState<Prop[]>([]);
  const [espacos, setEspacos] = useState<Espaco[]>([]);
  const [setupPendente, setSetupPendente] = useState(false);

  const [pagar, setPagar] = useState<ReservaRow | null>(null);
  const [userEmail, setUserEmail] = useState('');
  const [mpConectado, setMpConectado] = useState<boolean | null>(null);

  const [editor, setEditor] = useState<{ editing: Reserva | null; defaults?: { propriedade_id?: number; espaco_id?: number | null; inicio?: string; fim?: string; status?: 'confirmada' | 'hold' | 'bloqueio' | 'manutencao' } } | null>(null);
  const [espacoEditor, setEspacoEditor] = useState<{ editing: Espaco | null; defaultPropId?: number } | null>(null);
  const [confirmKey, setConfirmKey] = useState<string | null>(null);

  const [filtroEspaco, setFiltroEspaco] = useState<number | 'all'>('all');
  const [filtroStatus, setFiltroStatus] = useState<string>('all');

  const load = useCallback(async (uid: string) => {
    setLoading(true);
    const [rRes, pRes, eRes] = await Promise.all([
      supabase.from('reservas').select('*, propriedade:propriedades(id,nome,cidade,estado)').order('criado_em', { ascending: false }),
      supabase.from('propriedades').select('id,nome').eq('usuario_id', uid),
      supabase.from('espacos').select('*').eq('usuario_id', uid).order('ordem'),
    ]);
    setReservas((rRes.data || []) as ReservaRow[]);
    setProps((pRes.data || []) as Prop[]);
    if (isMissingTable(eRes.error)) setSetupPendente(true);
    else { setSetupPendente(false); setEspacos((eRes.data || []) as Espaco[]); }
    setLoading(false);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setAuthChecked(true);
      if (session) { setUserId(session.user.id); setUserEmail(session.user.email || ''); load(session.user.id); }
      else setLoading(false);
    });
  }, [load]);

  useEffect(() => {
    if (!userId) return;
    authHeaders().then((h) =>
      fetch('/api/mp/status', { headers: h }).then((r) => r.json()).then((j) => setMpConectado(!!j.conectado)).catch(() => {}),
    );
    const p = new URLSearchParams(window.location.search).get('mp');
    if (p === 'conectado') { toast.success('Mercado Pago conectado! Você já pode receber pagamentos.'); window.history.replaceState({}, '', '/painel/reservas'); }
    else if (p === 'erro') { toast.error('Não foi possível conectar o Mercado Pago. Tente novamente.'); window.history.replaceState({}, '', '/painel/reservas'); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const refetch = useCallback(() => { if (userId) load(userId); }, [userId, load]);

  // ── Recortes ────────────────────────────────────────────────────────────────
  const recebidas = useMemo(() => reservas.filter((r) => r.host_id === userId), [reservas, userId]);
  const minhas = useMemo(() => reservas.filter((r) => r.usuario_id === userId && r.host_id !== userId), [reservas, userId]);
  const solicitacoesRecebidas = useMemo(() => recebidas.filter((r) => MKT_STATUS.includes(r.status)), [recebidas]);
  const pendentes = solicitacoesRecebidas.filter((r) => r.status === 'solicitada').length;

  const espacosByProp = useMemo(() => {
    const m = new Map<number, Espaco[]>();
    for (const e of espacos) { const a = m.get(e.propriedade_id) || []; a.push(e); m.set(e.propriedade_id, a); }
    return m;
  }, [espacos]);

  // Agenda: tudo nos meus espaços, exceto mortos; com filtros de espaço/status.
  const agenda = useMemo(() => {
    const now = Date.now();
    return recebidas
      .filter((r) => r.status !== 'cancelada' && r.status !== 'recusada' && !holdExpirado(r, now))
      .filter((r) => filtroEspaco === 'all' || r.espaco_id == null || r.espaco_id === filtroEspaco)
      .filter((r) => filtroStatus === 'all' || r.status === filtroStatus)
      .sort((a, b) => (toRange(a)?.start || 0) - (toRange(b)?.start || 0));
  }, [recebidas, filtroEspaco, filtroStatus]);

  const kpis = useMemo(() => {
    const now = Date.now();
    const ativos = recebidas.filter((r) => ocupaSlot(r, now));
    const futuras = ativos.filter((r) => (toRange(r)?.end || 0) >= now);
    const holds = recebidas.filter((r) => r.status === 'hold' && !holdExpirado(r, now));
    const confirmadas = recebidas.filter((r) => ['confirmada', 'paga', 'aprovada'].includes(r.status));
    return { futuras: futuras.length, holds: holds.length, confirmadas: confirmadas.length, espacos: espacos.length };
  }, [recebidas, espacos]);

  // ── Ações marketplace (preservadas) ──────────────────────────────────────────
  const onStatus = async (id: string, status: string) => {
    const prev = reservas;
    setReservas((p) => p.map((r) => (r.id === id ? { ...r, status } : r)));
    const { error } = await supabase.from('reservas').update({ status }).eq('id', id);
    if (error) { setReservas(prev); toast.error(error.message || 'Não foi possível atualizar a reserva.'); }
  };

  const conectarMP = async () => {
    const res = await fetch('/api/mp/oauth/start', { headers: await authHeaders() });
    const json = await res.json();
    if (json.url) window.location.href = json.url;
    else toast.error(json.error || 'Não foi possível iniciar a conexão com o Mercado Pago.');
  };

  // ── Ações operacionais (via /api/reservas, conflito-checadas) ─────────────────
  async function confirmarHold(r: Reserva) {
    const res = await fetch('/api/reservas', { method: 'PATCH', headers: { 'Content-Type': 'application/json', ...(await authHeaders()) }, body: JSON.stringify({ id: r.id, status: 'confirmada' }) });
    if (!res.ok) { toast.error('Não foi possível confirmar.'); return; }
    toast.success('Reserva confirmada.'); refetch();
  }
  async function removerReserva(r: Reserva) {
    const key = `resv:${r.id}`;
    if (confirmKey !== key) { setConfirmKey(key); toast.info('Clique novamente para remover.'); setTimeout(() => setConfirmKey((c) => (c === key ? null : c)), 3000); return; }
    setConfirmKey(null);
    const res = await fetch(`/api/reservas?id=${r.id}&hard=1`, { method: 'DELETE', headers: await authHeaders() });
    if (!res.ok) { toast.error('Não foi possível remover.'); return; }
    toast.success('Reserva removida.'); refetch();
  }

  // ── Espaços (CRUD via RLS) ────────────────────────────────────────────────────
  async function removerEspaco(e: Espaco) {
    const key = `esp:${e.id}`;
    if (confirmKey !== key) { setConfirmKey(key); toast.info('Clique novamente para remover o espaço.'); setTimeout(() => setConfirmKey((c) => (c === key ? null : c)), 3000); return; }
    setConfirmKey(null);
    const { error } = await supabase.from('espacos').delete().eq('id', e.id);
    if (error) { toast.error('Não foi possível remover.'); return; }
    setEspacos((a) => a.filter((x) => x.id !== e.id));
    toast.success('Espaço removido.');
  }

  async function exportarIcal(propId: number) {
    try {
      const res = await fetch(`/api/reservas/ical?prop=${propId}`, { headers: await authHeaders() });
      const json = await res.json();
      if (!json.url) { toast.error(json.error || 'Não foi possível gerar o feed.'); return; }
      try { await navigator.clipboard.writeText(json.url); toast.success('Link do feed iCal copiado!'); }
      catch { window.prompt('Copie o link do feed iCal:', json.url); }
    } catch { toast.error('Não foi possível gerar o feed.'); }
  }

  const espacoNome = useCallback((id: number | null) => (id == null ? 'Espaço inteiro' : espacos.find((e) => e.id === id)?.nome || `#${id}`), [espacos]);

  // ── Render ────────────────────────────────────────────────────────────────────
  if (!authChecked || loading) return <p className="py-10 text-center text-ink-muted">Carregando...</p>;
  if (!userId) {
    return (
      <div className="mx-auto max-w-4xl">
        <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-card">
          <p className="mb-4 text-ink-soft">Entre na sua conta para ver suas reservas e a agenda dos seus espaços.</p>
          <Link href="/login" className="inline-block rounded-xl bg-brand px-6 py-3 font-bold text-white transition-colors hover:bg-brand-600">Entrar</Link>
        </div>
      </div>
    );
  }

  const statusFiltros = ['all', 'confirmada', 'hold', 'bloqueio', 'manutencao', 'solicitada', 'paga'];

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-black tracking-tight text-ink sm:text-3xl">Reservas & Agenda</h1>
          <p className="mt-1 text-sm text-ink-muted">A agenda de todos os seus espaços — reservas, holds e bloqueios — com detecção de conflito.</p>
        </div>
        {props.length > 0 && (
          <button onClick={() => setEditor({ editing: null, defaults: { propriedade_id: props[0].id } })} className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-600">
            + Nova reserva
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="mt-5 flex gap-1 overflow-x-auto border-b border-black/[0.06]">
        {([['agenda', 'Agenda'], ['solicitacoes', `Solicitações${pendentes > 0 ? ` (${pendentes})` : ''}`], ['espacos', 'Espaços']] as [Tab, string][]).map(([k, lab]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`shrink-0 border-b-2 px-4 py-2.5 text-sm font-semibold transition ${tab === k ? 'border-brand text-brand' : 'border-transparent text-ink-muted hover:text-ink-soft'}`}
          >
            {lab}
          </button>
        ))}
      </div>

      {/* ───────────────────────── AGENDA ───────────────────────── */}
      {tab === 'agenda' && (
        <div className="mt-5 space-y-5">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi label="Próximas reservas" value={String(kpis.futuras)} tone="azul" />
            <Kpi label="Holds ativos" value={String(kpis.holds)} tone="gold" />
            <Kpi label="Confirmadas" value={String(kpis.confirmadas)} tone="verde" />
            <Kpi label="Sub-espaços" value={String(kpis.espacos)} tone="laranja" />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {espacos.length > 0 && (
              <select value={filtroEspaco} onChange={(e) => setFiltroEspaco(e.target.value === 'all' ? 'all' : Number(e.target.value))} className={selCls}>
                <option value="all">Todos os espaços</option>
                {espacos.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
              </select>
            )}
            <select value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)} className={selCls}>
              {statusFiltros.map((s) => <option key={s} value={s}>{s === 'all' ? 'Todos os status' : statusMeta(s).label}</option>)}
            </select>
            <Link href="/painel/calendario" className="ml-auto inline-flex items-center gap-1.5 rounded-xl border border-black/10 bg-white px-3.5 py-2.5 text-sm font-medium hover:bg-black/[0.03]">
              📅 Ver no calendário
            </Link>
          </div>

          {agenda.length === 0 ? (
            <EmptyCard
              title="Nenhuma reserva na agenda"
              msg="Crie uma reserva, segure uma data (hold) ou bloqueie um período. O conflito por espaço é checado automaticamente."
              cta={props.length > 0 ? { label: '+ Nova reserva', onClick: () => setEditor({ editing: null, defaults: { propriedade_id: props[0].id } }) } : undefined}
            />
          ) : (
            <div className="overflow-hidden rounded-2xl border border-black/[0.06] bg-white shadow-card">
              <table className="w-full text-sm">
                <thead className="hidden border-b border-black/[0.06] bg-black/[0.02] text-left text-xs font-bold uppercase tracking-wide text-ink-muted sm:table-header-group">
                  <tr>
                    <th className="px-4 py-2.5">Quando</th>
                    <th className="px-4 py-2.5">Título</th>
                    <th className="px-4 py-2.5">Espaço</th>
                    <th className="px-4 py-2.5">Status</th>
                    <th className="px-4 py-2.5 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/[0.04]">
                  {agenda.map((r) => {
                    const meta = statusMeta(r.status);
                    const op = OPERACIONAL.has(r.status);
                    return (
                      <tr key={r.id} className="block sm:table-row">
                        <td className="block px-4 pt-3 sm:table-cell sm:py-3">
                          <span className="font-medium text-ink-soft">{periodoReserva(r)}</span>
                          {r.status === 'hold' && r.hold_expira_em && <span className="ml-2 text-[0.65rem] text-amber-700">expira {formatDateTime(r.hold_expira_em)}</span>}
                        </td>
                        <td className="block px-4 sm:table-cell sm:py-3"><span className="text-ink">{r.titulo || r.nome || r.tipo_evento || '—'}</span></td>
                        <td className="block px-4 text-ink-muted sm:table-cell sm:py-3">{espacoNome(r.espaco_id)}{r.propriedade?.nome ? ` · ${r.propriedade.nome}` : ''}</td>
                        <td className="block px-4 pt-1 sm:table-cell sm:py-3"><span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-bold ${meta.chip}`}>{meta.label}</span></td>
                        <td className="block px-4 pb-3 pt-2 sm:table-cell sm:py-3 sm:text-right">
                          <div className="flex flex-wrap gap-1.5 sm:justify-end">
                            {op && r.status === 'hold' && <button onClick={() => confirmarHold(r)} className="rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-bold text-white hover:bg-emerald-700">Confirmar</button>}
                            {op && <button onClick={() => setEditor({ editing: r })} className="rounded-lg border border-black/10 px-2.5 py-1 text-xs font-semibold text-ink-soft hover:border-brand hover:text-brand">Editar</button>}
                            {op && <button onClick={() => removerReserva(r)} className={`rounded-lg border px-2.5 py-1 text-xs font-semibold ${confirmKey === `resv:${r.id}` ? 'border-red-500 bg-red-600 text-white' : 'border-red-200 text-red-600 hover:bg-red-50'}`}>{confirmKey === `resv:${r.id}` ? 'Confirmar?' : 'Remover'}</button>}
                            {!op && <Link href="/painel/leads" className="text-xs font-semibold text-brand hover:underline">Gerenciar</Link>}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ──────────────────────── SOLICITAÇÕES ──────────────────────── */}
      {tab === 'solicitacoes' && (
        <div className="mt-5 space-y-12">
          <section>
            <h2 className="mb-4 flex items-center gap-2 font-display text-xl font-bold text-ink">
              Recebidas (sou anfitrião)
              <span className="font-sans text-base font-normal text-ink-muted">· {solicitacoesRecebidas.length}</span>
              {pendentes > 0 && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-700">{pendentes} pendente{pendentes > 1 ? 's' : ''}</span>}
            </h2>
            {solicitacoesRecebidas.length === 0 ? (
              <p className="text-sm text-ink-muted">Nenhuma solicitação recebida ainda.</p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">{solicitacoesRecebidas.map((r) => <MktCard key={r.id} r={r} papel="host" onStatus={onStatus} />)}</div>
            )}
          </section>

          <section>
            <h2 className="mb-4 font-display text-xl font-bold text-ink">Minhas solicitações (sou hóspede) <span className="font-sans text-base font-normal text-ink-muted">· {minhas.length}</span></h2>
            {minhas.length === 0 ? (
              <p className="text-sm text-ink-muted">Você ainda não solicitou nenhuma reserva. <Link href="/busca" className="font-semibold text-brand underline">Explorar espaços</Link></p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">{minhas.map((r) => <MktCard key={r.id} r={r} papel="guest" onStatus={onStatus} onPagar={setPagar} />)}</div>
            )}
          </section>

          {props.length > 0 && (
            <section>
              <h2 className="mb-1 font-display text-xl font-bold text-ink">Recebimentos</h2>
              <p className="mb-4 text-sm text-ink-muted">Conecte sua conta Mercado Pago para receber os pagamentos direto na sua conta — a Ventsy retém apenas a comissão.</p>
              <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-card">
                {mpConectado === true ? (
                  <span className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-700">✅ Conta Mercado Pago conectada</span>
                ) : (
                  <>
                    <span className="text-sm text-ink-soft">Sua conta ainda não está conectada.</span>
                    <button onClick={conectarMP} className="rounded-xl bg-[#009ee3] px-5 py-2.5 text-sm font-bold text-white transition hover:brightness-95">Conectar Mercado Pago</button>
                  </>
                )}
              </div>
            </section>
          )}
        </div>
      )}

      {/* ───────────────────────── ESPAÇOS ───────────────────────── */}
      {tab === 'espacos' && (
        <div className="mt-5 space-y-5">
          {setupPendente && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Os sub-espaços ainda não foram ativados. Rode a migration <code className="rounded bg-amber-100 px-1 py-0.5">docs/sql/reservas-multiespaco.sql</code> no Supabase para criar a tabela <code className="rounded bg-amber-100 px-1 py-0.5">espacos</code>.
            </div>
          )}
          {props.length === 0 ? (
            <EmptyCard title="Nenhuma propriedade" msg="Cadastre uma propriedade para então dividir em sub-espaços reserváveis." />
          ) : (
            props.map((p) => {
              const subs = espacosByProp.get(p.id) || [];
              return (
                <div key={p.id} className="rounded-2xl border border-black/[0.06] bg-white p-5 shadow-card">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-display text-lg font-bold text-ink">{p.nome || `Espaço #${p.id}`}</h3>
                    <div className="flex gap-2">
                      <button onClick={() => exportarIcal(p.id)} className="rounded-xl border border-black/10 px-3 py-2 text-xs font-medium hover:bg-black/[0.03]">📅 Feed iCal</button>
                      <button onClick={() => setEspacoEditor({ editing: null, defaultPropId: p.id })} disabled={setupPendente} className="rounded-xl bg-brand px-3 py-2 text-xs font-semibold text-white hover:bg-brand-600 disabled:opacity-50">+ Sub-espaço</button>
                    </div>
                  </div>
                  {subs.length === 0 ? (
                    <p className="mt-3 text-sm text-ink-muted">Sem sub-espaços. A propriedade é reservada como um todo. Adicione arena, galpão, camarote… para reservas simultâneas.</p>
                  ) : (
                    <ul className="mt-3 divide-y divide-black/[0.04]">
                      {subs.map((e) => (
                        <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                          <div className="flex items-center gap-2.5">
                            <span className="inline-block h-3 w-3 shrink-0 rounded-full" style={{ background: e.cor || '#ff385c' }} />
                            <div>
                              <div className="text-sm font-semibold text-ink-soft">{e.nome} {!e.ativo && <span className="text-xs font-normal text-ink-muted">(inativo)</span>}</div>
                              <div className="text-xs text-ink-muted">
                                {ESPACO_TIPO_LABEL[e.tipo]}
                                {e.capacidade ? ` · ${e.capacidade} pessoas` : ''}
                                {e.area_m2 ? ` · ${e.area_m2} m²` : ''}
                                {e.buffer_minutos ? ` · buffer ${e.buffer_minutos}min` : ''}
                                {!e.reservavel_isolado ? ' · não isolável' : ''}
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-1.5">
                            <button onClick={() => setEspacoEditor({ editing: e })} className="rounded-lg border border-black/10 px-2.5 py-1 text-xs font-semibold text-ink-soft hover:border-brand hover:text-brand">Editar</button>
                            <button onClick={() => removerEspaco(e)} className={`rounded-lg border px-2.5 py-1 text-xs font-semibold ${confirmKey === `esp:${e.id}` ? 'border-red-500 bg-red-600 text-white' : 'border-red-200 text-red-600 hover:bg-red-50'}`}>{confirmKey === `esp:${e.id}` ? 'Confirmar?' : 'Remover'}</button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Modais */}
      {pagar && (
        <CheckoutReserva
          reservaId={pagar.id}
          valorBase={Number(pagar.valor_estimado) || 0}
          email={userEmail}
          onClose={() => setPagar(null)}
          onPaid={() => { setReservas((prev) => prev.map((r) => (r.id === pagar.id ? { ...r, status: 'paga' } : r))); setPagar(null); toast.success('Pagamento aprovado! Reserva confirmada.'); }}
        />
      )}

      {editor && props.length > 0 && (
        <ReservaEditor
          propriedades={props}
          espacos={espacos}
          reservasContexto={recebidas}
          editing={editor.editing}
          defaults={editor.defaults}
          onClose={() => setEditor(null)}
          onSaved={() => { setEditor(null); refetch(); }}
        />
      )}

      {espacoEditor && userId && (
        <EspacoEditor
          userId={userId}
          propriedades={props}
          editing={espacoEditor.editing}
          defaultPropId={espacoEditor.defaultPropId}
          onClose={() => setEspacoEditor(null)}
          onSaved={(e) => {
            setEspacos((a) => { const i = a.findIndex((x) => x.id === e.id); if (i >= 0) { const n = [...a]; n[i] = e; return n; } return [...a, e]; });
            setEspacoEditor(null);
            toast.success('Espaço salvo.');
          }}
        />
      )}
    </div>
  );
}

const selCls = 'rounded-xl border border-black/10 bg-white px-3.5 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20';

function Kpi({ label, value, tone }: { label: string; value: string; tone: 'verde' | 'gold' | 'azul' | 'laranja' }) {
  const color = tone === 'verde' ? 'text-emerald-600' : tone === 'gold' ? 'text-amber-600' : tone === 'laranja' ? 'text-orange-600' : 'text-blue-600';
  return (
    <div className="rounded-2xl bg-white p-4 shadow-card">
      <div className="text-xs text-ink-muted">{label}</div>
      <div className={`mt-2 text-xl font-bold ${color}`}>{value}</div>
    </div>
  );
}

function EmptyCard({ title, msg, cta }: { title: string; msg: string; cta?: { label: string; onClick: () => void } }) {
  return (
    <div className="rounded-2xl border border-dashed border-brand/30 bg-white p-8 text-center shadow-card">
      <p className="font-display text-lg font-bold text-ink">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-ink-soft">{msg}</p>
      {cta && <button onClick={cta.onClick} className="mt-4 inline-flex rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-600">{cta.label}</button>}
    </div>
  );
}

