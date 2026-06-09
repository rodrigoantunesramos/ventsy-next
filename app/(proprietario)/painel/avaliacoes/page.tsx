'use client';

// Avaliações (públicas — o dono responde) · /painel/avaliacoes.
// O dono vê todas as avaliações públicas que recebeu (por propriedade), responde
// publicamente (com sugestão de IA no Pro+), modera (ocultar/destacar) e acompanha
// a reputação ao longo do tempo. As avaliações são escritas pelo CLIENTE (user_id);
// o dono é dono via propriedades.usuario_id → leitura por RLS de dono, escrita pela
// rota app/api/avaliacoes (PATCH, service-role, valida posse).
// PILARES: KPIs (média, distribuição, % respondidas, pendentes) · gráficos SVG
//   (distribuição, evolução mensal, nota por propriedade/tipo) · feed filtrável com
//   resposta + moderação · alertas de reputação. i18n via lib/format (sem "R$").

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabaseAny as sb, authHeaders } from '@/lib/supabase';
import { formatDate, formatNumber, formatPercent, formatMonth } from '@/lib/format';
import { useToast } from '@/components/Toast';
import {
  type Avaliacao, type PropLite, type StatusFiltro,
  NOTAS, PERIODOS, TONS,
  media, distribuicao, serieMensal, notaPorChave, comparativo, dentroPeriodo,
  precisaResposta, exportAvaliacoesCSV,
} from './_lib';

// ── Constantes de estilo (copiadas do design system) ──────────────────────────
const inp = 'w-full rounded-xl border border-black/10 bg-white px-3.5 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20';
const selCls = 'rounded-xl border border-black/10 bg-white px-3 py-2 text-sm focus:border-brand focus:outline-none';
const PAGE_SIZE = 12;

// ── Helpers locais ────────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normAval(a: any): Avaliacao {
  return {
    id: Number(a.id),
    user_id: a.user_id ?? null,
    propriedade_id: a.propriedade_id != null ? Number(a.propriedade_id) : null,
    nota: Number(a.nota) || 0,
    texto: a.texto ?? null,
    autor: a.autor ?? null,
    avatar: a.avatar ?? null,
    evento_tipo: a.evento_tipo ?? null,
    data: a.data ?? null,
    verificada: !!a.verificada,
    resposta: a.resposta ?? null,
    respondido_em: a.respondido_em ?? null,
    oculta: !!a.oculta,
    destaque: !!a.destaque,
    criado_em: a.criado_em ?? '',
  };
}
const iniciais = (nome: string | null) =>
  (nome || '?').trim().split(/\s+/).slice(0, 2).map((p) => p[0] || '').join('').toUpperCase() || '?';

// ── Página ────────────────────────────────────────────────────────────────────
export default function AvaliacoesPage() {
  const router = useRouter();
  const toast = useToast();
  const now = useMemo(() => new Date(), []);

  const [loading, setLoading] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [plano, setPlano] = useState('basico');
  const isPro = plano === 'pro' || plano === 'ultra';

  const [props, setProps] = useState<PropLite[]>([]);
  const [avals, setAvals] = useState<Avaliacao[]>([]);

  // filtros
  const [busca, setBusca] = useState('');
  const [fProp, setFProp] = useState<number | ''>('');
  const [fNota, setFNota] = useState<number | ''>('');
  const [fStatus, setFStatus] = useState<StatusFiltro>('todas');
  const [fPeriodo, setFPeriodo] = useState<number>(0);
  const [page, setPage] = useState(0);

  const carregar = useCallback(async (uid: string) => {
    const { data: pr } = await sb.from('propriedades').select('id,nome,cidade,estado').eq('usuario_id', uid).order('id');
    const plist = ((pr || []) as PropLite[]).map((p) => ({ ...p, id: Number(p.id) }));
    setProps(plist);
    const ids = plist.map((p) => p.id);

    // Lê as avaliações das propriedades do dono (RLS de dono). Sem propriedades,
    // faz só uma sondagem leve p/ detectar tabela ausente (needsSetup) — nunca head:true.
    const { data: av, error } = ids.length
      ? await sb.from('avaliacoes').select('*').in('propriedade_id', ids).order('criado_em', { ascending: false })
      : await sb.from('avaliacoes').select('id').limit(1);

    if (error && (error.code === '42P01' || error.code === 'PGRST205')) { setNeedsSetup(true); setAvals([]); return; }
    setNeedsSetup(false);
    setAvals(ids.length ? ((av || []) as unknown[]).map(normAval) : []);
  }, []);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await sb.auth.getSession();
      if (!session) { router.replace('/login'); return; }
      try {
        const { data: a } = await sb.from('assinaturas').select('plano_ativo').eq('usuario_id', session.user.id).maybeSingle();
        setPlano((a?.plano_ativo || 'basico').toString().toLowerCase());
      } catch { /* plano opcional */ }
      await carregar(session.user.id);
      setLoading(false);
    })();
  }, [carregar, router]);

  useEffect(() => { setPage(0); }, [busca, fProp, fNota, fStatus, fPeriodo]);

  const propNome = useMemo(() => new Map(props.map((p) => [p.id, p.nome || `Espaço #${p.id}`])), [props]);

  // Base de reputação = não-ocultas (espelha o público). Recebidas = tudo.
  const visiveis = useMemo(() => avals.filter((a) => !a.oculta), [avals]);

  // ── KPIs ──
  const kpis = useMemo(() => {
    const respondidas = visiveis.filter((a) => a.resposta).length;
    const pendentes = visiveis.filter((a) => !a.resposta).length;
    const pendentes48 = visiveis.filter((a) => precisaResposta(a, now)).length;
    const cmp = comparativo(visiveis, fPeriodo || 90, now);
    return {
      mediaGeral: media(visiveis),
      totalRecebidas: avals.length,
      ocultas: avals.length - visiveis.length,
      respondidas,
      pctRespondidas: visiveis.length ? respondidas / visiveis.length : 0,
      pendentes,
      pendentes48,
      delta: cmp.atual && cmp.anterior ? cmp.atual - cmp.anterior : 0,
      cmp,
    };
  }, [visiveis, avals, now, fPeriodo]);

  const dist = useMemo(() => distribuicao(visiveis), [visiveis]);
  const serie = useMemo(() => serieMensal(visiveis, now, 6), [visiveis, now]);
  const porProp = useMemo(
    () => notaPorChave(visiveis, (a) => (a.propriedade_id != null ? propNome.get(a.propriedade_id) || '—' : '—')),
    [visiveis, propNome],
  );
  const porTipo = useMemo(() => notaPorChave(visiveis, (a) => a.evento_tipo), [visiveis]);

  // ── Feed filtrado ──
  const filtrados = useMemo(() => {
    let arr = avals;
    const q = busca.trim().toLowerCase();
    if (q) arr = arr.filter((a) => `${a.autor || ''} ${a.texto || ''} ${a.evento_tipo || ''}`.toLowerCase().includes(q));
    if (fProp !== '') arr = arr.filter((a) => a.propriedade_id === fProp);
    if (fNota !== '') arr = arr.filter((a) => Math.round(a.nota) === fNota);
    if (fPeriodo) arr = arr.filter((a) => dentroPeriodo(a, fPeriodo, now));
    if (fStatus === 'respondidas') arr = arr.filter((a) => !!a.resposta && !a.oculta);
    else if (fStatus === 'pendentes') arr = arr.filter((a) => !a.resposta && !a.oculta);
    else if (fStatus === 'ocultas') arr = arr.filter((a) => a.oculta);
    else if (fStatus === 'destaque') arr = arr.filter((a) => a.destaque);
    else arr = arr.filter((a) => !a.oculta); // 'todas' = visíveis (ocultas têm aba própria)
    // destaque no topo, depois mais recentes
    return [...arr].sort((a, b) => (Number(b.destaque) - Number(a.destaque)) || (b.criado_em || '').localeCompare(a.criado_em || ''));
  }, [avals, busca, fProp, fNota, fStatus, fPeriodo, now]);

  const totalPages = Math.max(1, Math.ceil(filtrados.length / PAGE_SIZE));
  const pageItems = filtrados.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
  const temFiltro = !!(busca || fProp !== '' || fNota !== '' || fStatus !== 'todas' || fPeriodo);

  // ── Mutações (via rota app/api/avaliacoes — service-role valida posse) ──
  const patch = useCallback(async (id: number, body: Record<string, unknown>): Promise<boolean> => {
    const res = await fetch('/api/avaliacoes', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
      body: JSON.stringify({ id, ...body }),
    });
    const j = await res.json().catch(() => ({ error: 'Falha de rede.' }));
    if (j.error) { toast.error(j.error); return false; }
    setAvals((prev) => prev.map((a) => (a.id === id ? normAval({ ...a, ...j.data }) : a)));
    return true;
  }, [toast]);

  const responder = useCallback(async (id: number, resposta: string) => {
    const ok = await patch(id, { resposta });
    if (ok) toast.success(resposta.trim() ? 'Resposta publicada.' : 'Resposta removida.');
    return ok;
  }, [patch, toast]);

  const toggleDestaque = useCallback(async (a: Avaliacao) => {
    const ok = await patch(a.id, { destaque: !a.destaque });
    if (ok) toast.success(a.destaque ? 'Destaque removido.' : 'Avaliação destacada no anúncio.');
  }, [patch, toast]);

  const toggleOcultar = useCallback(async (a: Avaliacao) => {
    if (!a.oculta && !confirm('Ocultar esta avaliação do anúncio público? A média do espaço será recalculada.')) return;
    const ok = await patch(a.id, { oculta: !a.oculta });
    if (ok) toast.success(a.oculta ? 'Avaliação reexibida no anúncio.' : 'Avaliação ocultada do público.');
  }, [patch, toast]);

  const sugerirIA = useCallback(async (id: number, tom: string): Promise<string | null> => {
    const res = await fetch('/api/avaliacoes/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
      body: JSON.stringify({ id, tom }),
    });
    const j = await res.json().catch(() => ({ error: 'Falha de rede.' }));
    if (j.code === 'NO_KEY') { toast.info(j.error); return null; }
    if (j.error) { toast.error(j.error); return null; }
    return (j.text as string) || null;
  }, [toast]);

  // ── Loading ──
  if (loading) {
    return (
      <div className="mx-auto max-w-6xl space-y-4">
        <div className="h-[72px] animate-pulse rounded-2xl bg-black/[0.05]" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <div key={i} className="h-[92px] animate-pulse rounded-2xl bg-black/[0.05]" />)}</div>
        <div className="h-[220px] animate-pulse rounded-2xl bg-black/[0.05]" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink sm:text-2xl">Avaliações</h1>
          <p className="mt-1 text-sm text-ink-muted">Tudo o que disseram sobre seus espaços — responda em público, modere e acompanhe a reputação. O raio-x de cada cliente fica em <Link href="/painel/clientes" className="font-semibold text-brand underline">Clientes</Link>.</p>
        </div>
        {filtrados.length > 0 && (
          <button onClick={() => exportAvaliacoesCSV(filtrados, propNome, (s) => formatDate(s, { style: 'short' }))} className="flex items-center gap-1.5 rounded-xl border border-black/10 px-3 py-2.5 text-sm text-ink-muted hover:border-brand/30 hover:text-brand">
            <IcoDownload /> Exportar
          </button>
        )}
      </div>

      {needsSetup && (
        <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-600"><IcoStar /></div>
          <h3 className="text-base font-bold text-ink">Ative o módulo de Avaliações</h3>
          <p className="mx-auto mt-1 max-w-md text-sm text-ink-soft">A tabela <code className="rounded bg-black/[0.06] px-1">avaliacoes</code> ainda não existe neste ambiente. Rode <code className="rounded bg-black/[0.06] px-1">docs/sql/avaliacoes.sql</code> no Supabase para começar a receber e responder avaliações.</p>
        </div>
      )}

      {!needsSetup && (
        <>
          {/* Alertas de reputação */}
          {(kpis.delta < -0.05 || kpis.pendentes48 > 0) && (
            <div className="mt-5 flex flex-wrap items-center gap-2">
              {kpis.delta < -0.05 && (
                <span className="inline-flex items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-700">
                  <IcoAlert /> Sua média caiu {formatNumber(Math.abs(kpis.delta), { maximumFractionDigits: 1 })} ponto(s) vs. o período anterior.
                </span>
              )}
              {kpis.pendentes48 > 0 && (
                <button onClick={() => setFStatus('pendentes')} className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-100">
                  <IcoClock /> {kpis.pendentes48} avaliação(ões) sem resposta há +48h
                </button>
              )}
            </div>
          )}

          {/* KPIs */}
          <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi
              label="Nota média"
              value={visiveis.length ? formatNumber(kpis.mediaGeral, { maximumFractionDigits: 1 }) : '—'}
              foot={<Stars value={kpis.mediaGeral} size={14} />}
              delta={kpis.cmp.nAnterior ? kpis.delta : undefined}
            />
            <Kpi label="Avaliações" value={formatNumber(kpis.totalRecebidas)} foot={<span className="text-xs text-ink-muted">{kpis.ocultas > 0 ? `${formatNumber(kpis.ocultas)} oculta(s)` : 'todas públicas'}</span>} />
            <Kpi label="Respondidas" value={formatPercent(kpis.pctRespondidas)} foot={<span className="text-xs text-ink-muted">{formatNumber(kpis.respondidas)} de {formatNumber(visiveis.length)}</span>} />
            <Kpi
              label="Aguardando resposta"
              value={formatNumber(kpis.pendentes)}
              foot={kpis.pendentes48 > 0 ? <span className="text-xs font-semibold text-red-600">{formatNumber(kpis.pendentes48)} há +48h</span> : <span className="text-xs text-emerald-600">em dia</span>}
            />
          </div>

          {visiveis.length > 0 && (
            <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
              {/* Distribuição 1–5 */}
              <div className="rounded-2xl bg-white p-5 shadow-card">
                <h3 className="mb-3 text-sm font-bold text-ink">Distribuição das notas</h3>
                <div className="space-y-2">
                  {NOTAS.map((n) => {
                    const c = dist[n - 1]; const pct = visiveis.length ? c / visiveis.length : 0;
                    return (
                      <div key={n} className="flex items-center gap-2 text-xs">
                        <span className="flex w-7 items-center gap-0.5 text-ink-muted">{n}<IcoStar size={11} /></span>
                        <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-black/[0.06]"><div className="h-full rounded-full bg-amber-400" style={{ width: `${pct * 100}%` }} /></div>
                        <span className="w-10 text-right tabular-nums text-ink-muted">{formatNumber(c)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Evolução mensal */}
              <div className="rounded-2xl bg-white p-5 shadow-card">
                <h3 className="mb-1 text-sm font-bold text-ink">Evolução mensal</h3>
                <p className="mb-2 text-xs text-ink-muted"><span className="text-amber-500">●</span> média &nbsp;<span className="text-brand/40">▮</span> volume</p>
                <EvolucaoMensal serie={serie} />
              </div>

              {/* Nota por propriedade */}
              <div className="rounded-2xl bg-white p-5 shadow-card">
                <h3 className="mb-3 text-sm font-bold text-ink">Nota por propriedade</h3>
                {porProp.length === 0 ? <p className="text-xs text-ink-muted">Sem dados.</p> : (
                  <div className="space-y-2.5">{porProp.slice(0, 6).map((r) => <MediaBar key={r.chave} label={r.chave} value={r.media} n={r.n} />)}</div>
                )}
              </div>
            </div>
          )}

          {/* Nota por tipo de evento */}
          {porTipo.length > 0 && (
            <div className="mt-4 rounded-2xl bg-white p-5 shadow-card">
              <h3 className="mb-3 text-sm font-bold text-ink">Nota por tipo de evento</h3>
              <div className="grid grid-cols-1 gap-x-6 gap-y-2.5 sm:grid-cols-2 lg:grid-cols-3">
                {porTipo.slice(0, 9).map((r) => <MediaBar key={r.chave} label={r.chave} value={r.media} n={r.n} />)}
              </div>
            </div>
          )}

          {/* Filtros */}
          <div className="mt-6 flex flex-wrap items-center gap-2">
            <div className="relative min-w-[200px] flex-1">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted"><IcoSearch /></span>
              <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por autor, texto ou evento…" className={`${inp} pl-9`} />
            </div>
            <select value={fProp} onChange={(e) => setFProp(e.target.value ? Number(e.target.value) : '')} className={selCls} aria-label="Filtrar por propriedade">
              <option value="">Todas as propriedades</option>
              {props.map((p) => <option key={p.id} value={p.id}>{p.nome || `Espaço #${p.id}`}</option>)}
            </select>
            <select value={fNota} onChange={(e) => setFNota(e.target.value ? Number(e.target.value) : '')} className={selCls} aria-label="Filtrar por nota">
              <option value="">Todas as notas</option>
              {NOTAS.map((n) => <option key={n} value={n}>{n} estrelas</option>)}
            </select>
            <select value={fStatus} onChange={(e) => setFStatus(e.target.value as StatusFiltro)} className={selCls} aria-label="Filtrar por status">
              <option value="todas">Todas</option>
              <option value="pendentes">Sem resposta</option>
              <option value="respondidas">Respondidas</option>
              <option value="destaque">Em destaque</option>
              <option value="ocultas">Ocultas</option>
            </select>
            <select value={fPeriodo} onChange={(e) => setFPeriodo(Number(e.target.value))} className={selCls} aria-label="Filtrar por período">
              {PERIODOS.map((p) => <option key={p.v} value={p.v}>{p.label}</option>)}
            </select>
            {temFiltro && <button onClick={() => { setBusca(''); setFProp(''); setFNota(''); setFStatus('todas'); setFPeriodo(0); }} className="rounded-xl px-3 py-2 text-sm text-ink-muted hover:text-brand">Limpar</button>}
          </div>

          {/* Feed */}
          <div className="mt-4 space-y-3">
            {filtrados.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-black/10 bg-white py-14 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand"><IcoStar /></div>
                <h3 className="text-base font-bold text-ink">{avals.length ? 'Nenhuma avaliação com esses filtros' : 'Ainda sem avaliações'}</h3>
                <p className="mx-auto mt-1 max-w-sm text-sm text-ink-muted">
                  {avals.length
                    ? 'Ajuste a busca ou os filtros acima.'
                    : props.length
                      ? 'Quando um cliente avaliar um dos seus espaços, a avaliação aparece aqui para você responder.'
                      : <>Publique uma propriedade em <Link href="/painel/minha-propriedade" className="font-semibold text-brand underline">Minha Propriedade</Link> para começar a receber avaliações.</>}
                </p>
              </div>
            ) : (
              pageItems.map((a) => (
                <AvaliacaoCard
                  key={a.id}
                  a={a}
                  propNome={(a.propriedade_id != null && propNome.get(a.propriedade_id)) || ''}
                  isPro={isPro}
                  now={now}
                  onResponder={responder}
                  onToggleDestaque={toggleDestaque}
                  onToggleOcultar={toggleOcultar}
                  onSugerir={sugerirIA}
                />
              ))
            )}
          </div>

          {/* Paginação */}
          {totalPages > 1 && (
            <div className="mt-5 flex items-center justify-center gap-2">
              <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} className="rounded-lg border border-black/10 px-3 py-1.5 text-sm disabled:opacity-40">Anterior</button>
              <span className="text-sm text-ink-muted">{page + 1} / {totalPages}</span>
              <button onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="rounded-lg border border-black/10 px-3 py-1.5 text-sm disabled:opacity-40">Próxima</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Card de avaliação (resposta inline + IA + moderação) ──────────────────────
function AvaliacaoCard({ a, propNome, isPro, now, onResponder, onToggleDestaque, onToggleOcultar, onSugerir }: {
  a: Avaliacao; propNome: string; isPro: boolean; now: Date;
  onResponder: (id: number, resposta: string) => Promise<boolean>;
  onToggleDestaque: (a: Avaliacao) => void;
  onToggleOcultar: (a: Avaliacao) => void;
  onSugerir: (id: number, tom: string) => Promise<string | null>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(a.resposta || '');
  const [saving, setSaving] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [tom, setTom] = useState('cordial');

  const dataLabel = a.criado_em ? formatDate(a.criado_em, { style: 'medium' }) : (a.data || '');
  const pede48 = precisaResposta(a, now);

  async function salvar() {
    setSaving(true);
    const ok = await onResponder(a.id, draft.trim());
    setSaving(false);
    if (ok) setEditing(false);
  }
  async function gerar() {
    setAiBusy(true);
    const txt = await onSugerir(a.id, tom);
    setAiBusy(false);
    if (txt) setDraft(txt);
  }

  return (
    <div className={`rounded-2xl border bg-white p-4 shadow-card transition sm:p-5 ${a.oculta ? 'border-black/[0.06] opacity-70' : a.destaque ? 'border-amber-200 ring-1 ring-amber-100' : 'border-black/[0.06]'}`}>
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand/10 text-sm font-bold text-brand">
          {a.avatar ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={a.avatar} alt={a.autor || ''} className="h-full w-full object-cover" /> : iniciais(a.autor)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-semibold text-ink">{a.autor || 'Cliente'}</span>
            {a.verificada && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[0.65rem] font-semibold text-emerald-700">✓ Verificada</span>}
            {a.destaque && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[0.65rem] font-semibold text-amber-700">★ Destaque</span>}
            {a.oculta && <span className="rounded-full bg-black/[0.06] px-2 py-0.5 text-[0.65rem] font-semibold text-ink-muted">Oculta</span>}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-ink-muted">
            <Stars value={a.nota} size={14} />
            <span>·</span>
            {propNome && <span className="truncate">{propNome}</span>}
            {a.evento_tipo && <><span>·</span><span>{a.evento_tipo}</span></>}
            <span>·</span><span>{dataLabel}</span>
          </div>
        </div>
      </div>

      {a.texto && <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-ink-soft">{a.texto}</p>}

      {/* Resposta publicada */}
      {a.resposta && !editing && (
        <div className="mt-3 rounded-xl border-l-2 border-brand bg-brand-50/40 px-3.5 py-2.5">
          <div className="mb-0.5 flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-brand">↳ Sua resposta pública</span>
            {a.respondido_em && <span className="text-[0.7rem] text-ink-muted">{formatDate(a.respondido_em, { style: 'short' })}</span>}
          </div>
          <p className="whitespace-pre-wrap text-sm text-ink-soft">{a.resposta}</p>
        </div>
      )}

      {/* Editor de resposta */}
      {editing && (
        <div className="mt-3 rounded-xl border border-black/[0.08] bg-black/[0.015] p-3">
          <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={3} placeholder="Escreva uma resposta pública e cordial…" className={`${inp} resize-y`} autoFocus />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {isPro ? (
              <>
                <button onClick={gerar} disabled={aiBusy} className="inline-flex items-center gap-1.5 rounded-lg border border-black/10 px-2.5 py-1.5 text-xs font-semibold text-ink-soft hover:border-brand/30 hover:text-brand disabled:opacity-50">
                  ✨ {aiBusy ? 'Gerando…' : 'Sugerir com IA'}
                </button>
                <select value={tom} onChange={(e) => setTom(e.target.value)} className="rounded-lg border border-black/10 bg-white px-2 py-1.5 text-xs focus:border-brand focus:outline-none" aria-label="Tom da resposta">
                  {TONS.map((t) => <option key={t.v} value={t.v}>{t.label}</option>)}
                </select>
              </>
            ) : (
              <Link href="/painel/planos" className="inline-flex items-center gap-1 rounded-lg bg-gradient-to-r from-amber-500 to-brand px-2.5 py-1.5 text-xs font-semibold text-white hover:opacity-90" title="Sugestão de resposta com IA é exclusiva do Pro+">✨ Sugerir com IA (Pro+)</Link>
            )}
            <div className="ml-auto flex gap-2">
              <button onClick={() => { setEditing(false); setDraft(a.resposta || ''); }} className="rounded-lg px-3 py-1.5 text-xs font-medium text-ink-muted hover:text-ink">Cancelar</button>
              <button onClick={salvar} disabled={saving} className="rounded-lg bg-brand px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-brand-600 disabled:opacity-50">{saving ? 'Salvando…' : 'Publicar resposta'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Ações */}
      {!editing && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-black/[0.05] pt-3">
          <button onClick={() => { setDraft(a.resposta || ''); setEditing(true); }} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-ink-soft hover:bg-black/[0.03] hover:text-brand">
            <IcoReply /> {a.resposta ? 'Editar resposta' : 'Responder'}
          </button>
          <button onClick={() => onToggleDestaque(a)} className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold hover:bg-black/[0.03] ${a.destaque ? 'text-amber-600' : 'text-ink-soft hover:text-amber-600'}`}>
            <IcoStar size={13} /> {a.destaque ? 'Remover destaque' : 'Destacar'}
          </button>
          <button onClick={() => onToggleOcultar(a)} className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold hover:bg-black/[0.03] ${a.oculta ? 'text-emerald-600' : 'text-ink-soft hover:text-red-600'}`}>
            {a.oculta ? <><IcoEye /> Reexibir</> : <><IcoEyeOff /> Ocultar</>}
          </button>
          {pede48 && <span className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-red-600"><IcoClock /> +48h sem resposta</span>}
        </div>
      )}
    </div>
  );
}

// ── Componentes de UI ─────────────────────────────────────────────────────────
function Kpi({ label, value, foot, delta }: { label: string; value: string; foot?: ReactNode; delta?: number }) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-card">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-ink-muted">{label}</span>
        {delta !== undefined && Math.abs(delta) >= 0.05 && (
          <span className={`text-xs font-semibold ${delta >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{delta >= 0 ? '▲' : '▼'} {formatNumber(Math.abs(delta), { maximumFractionDigits: 1 })}</span>
        )}
      </div>
      <div className="mt-1 text-2xl font-bold text-ink">{value}</div>
      {foot && <div className="mt-1.5">{foot}</div>}
    </div>
  );
}

function MediaBar({ label, value, n }: { label: string; value: number; n: number }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="min-w-0 flex-1 truncate text-ink-soft" title={label}>{label}</span>
      <div className="h-2 w-20 overflow-hidden rounded-full bg-black/[0.06]"><div className="h-full rounded-full bg-amber-400" style={{ width: `${(value / 5) * 100}%` }} /></div>
      <span className="w-8 text-right font-semibold tabular-nums text-ink">{formatNumber(value, { maximumFractionDigits: 1 })}</span>
      <span className="w-9 text-right tabular-nums text-ink-muted">({formatNumber(n)})</span>
    </div>
  );
}

function EvolucaoMensal({ serie }: { serie: { ym: string; media: number; n: number }[] }) {
  const W = 100 * serie.length, H = 130, pad = 22;
  const maxN = Math.max(1, ...serie.map((s) => s.n));
  const cw = (W - pad) / serie.length;
  const x = (i: number) => pad + (i + 0.5) * cw;
  const yN = (n: number) => H - pad - (n / maxN) * (H - pad * 2);
  const yM = (m: number) => pad + (1 - m / 5) * (H - pad * 2);
  const linePts = serie.filter((s) => s.n > 0).map((s) => `${x(serie.indexOf(s))},${yM(s.media)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="xMidYMid meet" aria-label="Evolução mensal das avaliações">
      {serie.map((s, i) => <rect key={`b${i}`} x={x(i) - cw * 0.22} y={yN(s.n)} width={cw * 0.44} height={Math.max(0, H - pad - yN(s.n))} rx="3" className="fill-brand/15" />)}
      {linePts && <polyline points={linePts} fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />}
      {serie.map((s, i) => s.n > 0 ? <circle key={`c${i}`} cx={x(i)} cy={yM(s.media)} r="2.6" className="fill-amber-400" /> : null)}
      {serie.map((s, i) => <text key={`t${i}`} x={x(i)} y={H - 5} textAnchor="middle" className="fill-ink-muted" fontSize="9">{formatMonth(s.ym, { withYear: false })}</text>)}
    </svg>
  );
}

// ── Stars (SVG, design system) ────────────────────────────────────────────────
const STAR_PATH = 'M12 3.5l2.6 5.27 5.82.85-4.21 4.1.99 5.79L12 16.77l-5.2 2.73.99-5.79-4.21-4.1 5.82-.85L12 3.5Z';
function Stars({ value, size = 16 }: { value: number; size?: number }) {
  const full = Math.round(value);
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${formatNumber(value, { maximumFractionDigits: 1 })} de 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <svg key={i} width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={i <= full ? 'text-amber-400' : 'text-black/[0.13]'}><path d={STAR_PATH} /></svg>
      ))}
    </span>
  );
}

// ── Ícones (SVG inline) ───────────────────────────────────────────────────────
const svg = (path: ReactNode, size = 15, sw = 2) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">{path}</svg>;
const IcoStar = ({ size = 15 }: { size?: number }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><path d={STAR_PATH} /></svg>;
const IcoReply = () => svg(<path d="M9 17l-5-5 5-5M4 12h11a5 5 0 0 1 5 5v2" />, 14);
const IcoEye = () => svg(<><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></>, 14);
const IcoEyeOff = () => svg(<><path d="M9.9 4.24A9.1 9.1 0 0 1 12 4c6.5 0 10 7 10 7a13.2 13.2 0 0 1-1.67 2.39M6.6 6.6A13.2 13.2 0 0 0 2 12s3.5 7 10 7a9.1 9.1 0 0 0 3.2-.57M3 3l18 18M9.9 9.9a3 3 0 0 0 4.2 4.2" /></>, 14);
const IcoDownload = () => svg(<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />, 13);
const IcoSearch = () => svg(<path d="M21 21l-4.3-4.3M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16Z" />, 14);
const IcoAlert = () => svg(<path d="M12 9v4M12 17h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />, 14);
const IcoClock = () => svg(<path d="M12 7v5l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z" />, 13);
