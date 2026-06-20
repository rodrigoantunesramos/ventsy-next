'use client';

// Clientes (CRM 360º) — /painel/clientes.
// O "raio-x" de cada contratante: quem é, quanto já gerou e em que ponto está
// o relacionamento. Ancorado na nova tabela `clientes` + `clientes_eventos`
// (vínculo cliente_id) + `parcelas`. Segmentação RFM automática (Campeão, Fiel,
// Novo, Em risco, Perdido, Lead) alimenta filtros e futuras Campanhas.
// PILARES: KPIs de carteira · distribuição por segmento/origem · lista filtrável
//   com LTV/recência · novo cliente · importar CSV (de-dupe) · mesclar duplicados
//   · exportar · derivar clientes dos eventos existentes. i18n via lib/format.

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase as sb } from '@/lib/supabase';
import { formatMoney, formatMoneyShort, formatPercent, formatDate, formatNumber } from '@/lib/format';
import { useToast } from '@/components/Toast';
import {
  type Cliente, type EventoLite, type ParcelaLite, type Segmento, type ClienteMetrics,
  SEGMENTOS, SEG_BY, ORIGENS, ORIGEM_LABEL,
  eventosDoCliente, metricsCliente, segmentar, iniciais, soDigitos, waLink,
  importClientesCSV, chaveDedupe, exportClientesCSV,
} from './_lib';
import { EmptyState } from '@/components/ui/Estados';

// ── Constantes ────────────────────────────────────────────────────────────────
const PAGE_SIZE = 20;
const inp = 'w-full rounded-xl border border-black/10 bg-white px-3.5 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20';
const selCls = 'rounded-xl border border-black/10 bg-white px-3 py-2 text-sm focus:border-brand focus:outline-none';
type SortKey = 'ltv' | 'recencia' | 'eventos' | 'nome';
type Row = { c: Cliente; m: ClienteMetrics; seg: Segmento };

// ── Página ────────────────────────────────────────────────────────────────────
export default function ClientesPage() {
  const router = useRouter();
  const toast = useToast();
  const now = useMemo(() => new Date(), []);

  const [loading, setLoading] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [eventos, setEventos] = useState<EventoLite[]>([]);
  const [parcelas, setParcelas] = useState<ParcelaLite[]>([]);

  // filtros / ordenação / paginação
  const [busca, setBusca] = useState('');
  const [fSeg, setFSeg] = useState<Segmento | ''>('');
  const [fCidade, setFCidade] = useState('');
  const [fOrigem, setFOrigem] = useState('');
  const [fTag, setFTag] = useState('');
  const [fVip, setFVip] = useState(false);
  const [fInativo, setFInativo] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('ltv');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(0);

  // modais
  const [novo, setNovo] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [mergeOpen, setMergeOpen] = useState(false);
  const [derivBusy, setDerivBusy] = useState(false);

  const carregar = useCallback(async (uid: string) => {
    const [cliRes, evRes, pcRes] = await Promise.all([
      sb.from('clientes').select('*').eq('usuario_id', uid).order('criado_em', { ascending: false }),
      sb.from('clientes_eventos').select('id,cliente_id,nome_evento,quem_contratou,tipo_evento,status,data_inicio,data_fim,valor_total_num,propriedade_id,criado_em').eq('usuario_id', uid),
      sb.from('parcelas').select('id,evento_id,valor,vencimento,status,pago_em').eq('usuario_id', uid),
    ]);
    if (cliRes.error && (cliRes.error.code === '42P01' || cliRes.error.code === 'PGRST205')) { setNeedsSetup(true); setClientes([]); return; }
    setNeedsSetup(false);
    setClientes(((cliRes.data || []) as Cliente[]).map((c) => ({ ...c, tags: Array.isArray(c.tags) ? c.tags : [] })));
    setEventos(((evRes.data || []) as EventoLite[]).map((e) => ({ ...e, valor_total_num: e.valor_total_num != null ? Number(e.valor_total_num) : null })));
    setParcelas(((pcRes.data || []) as ParcelaLite[]).map((p) => ({ ...p, id: Number(p.id), valor: Number(p.valor) })));
  }, []);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await sb.auth.getSession();
      if (!session) { setLoading(false); return; }
      setUserId(session.user.id);
      await carregar(session.user.id);
      setLoading(false);
    })();
  }, [carregar]);

  useEffect(() => { setPage(0); }, [busca, fSeg, fCidade, fOrigem, fTag, fVip, fInativo]);

  // ── Métricas + segmentação (refValor = LTV médio dos compradores) ──
  const base = useMemo(
    () => clientes.map((c) => { const ev = eventosDoCliente(c, eventos); return { c, m: metricsCliente(c, ev, parcelas, [], now) }; }),
    [clientes, eventos, parcelas, now],
  );
  const refValor = useMemo(() => {
    const comp = base.filter((r) => r.m.nGanhos >= 1);
    return comp.length ? comp.reduce((s, r) => s + r.m.valorContratado, 0) / comp.length : 0;
  }, [base]);
  const enriched = useMemo<Row[]>(() => base.map((r) => ({ ...r, seg: segmentar(r.c, r.m, now, refValor) })), [base, refValor, now]);

  // ── KPIs da carteira ──
  const kpis = useMemo(() => {
    const compradores = enriched.filter((r) => r.m.nGanhos >= 1);
    const totGanhos = enriched.reduce((s, r) => s + r.m.nGanhos, 0);
    const totValor = enriched.reduce((s, r) => s + r.m.valorContratado, 0);
    const mesAtual = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    return {
      total: enriched.length,
      novosMes: clientes.filter((c) => (c.criado_em || '').slice(0, 7) === mesAtual).length,
      ticket: totGanhos ? totValor / totGanhos : 0,
      ltvMedio: compradores.length ? compradores.reduce((s, r) => s + r.m.valorContratado, 0) / compradores.length : 0,
      recompra: compradores.length ? compradores.filter((r) => r.m.nGanhos >= 2).length / compradores.length : 0,
      pctInativos: enriched.length ? enriched.filter((r) => r.m.inativo).length / enriched.length : 0,
    };
  }, [enriched, clientes, now]);

  // ── Distribuições para os gráficos ──
  const segDist = useMemo(() => {
    const m = new Map<Segmento, { n: number; valor: number }>();
    SEGMENTOS.forEach((s) => m.set(s.v, { n: 0, valor: 0 }));
    enriched.forEach((r) => { const e = m.get(r.seg)!; e.n++; e.valor += r.m.valorContratado; });
    return SEGMENTOS.map((s) => ({ ...s, ...m.get(s.v)! }));
  }, [enriched]);
  const origemDist = useMemo(() => {
    const m = new Map<string, number>();
    clientes.forEach((c) => { const k = c.origem || '—'; m.set(k, (m.get(k) || 0) + 1); });
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [clientes]);

  // opções de filtro dinâmicas
  const cidades = useMemo(() => [...new Set(clientes.map((c) => c.cidade).filter(Boolean) as string[])].sort(), [clientes]);
  const origensUsadas = useMemo(() => [...new Set(clientes.map((c) => c.origem).filter(Boolean) as string[])], [clientes]);
  const tags = useMemo(() => [...new Set(clientes.flatMap((c) => c.tags || []))].sort(), [clientes]);

  // ── Duplicados (mesma chave doc>email>nome) ──
  const duplicados = useMemo(() => {
    const g = new Map<string, Cliente[]>();
    clientes.forEach((c) => { const k = chaveDedupe(c); if (!g.has(k)) g.set(k, []); g.get(k)!.push(c); });
    return [...g.values()].filter((arr) => arr.length > 1);
  }, [clientes]);
  const nDuplicados = duplicados.reduce((s, g) => s + g.length - 1, 0);

  // ── Lista filtrada/ordenada/paginada ──
  const filtrados = useMemo(() => {
    let arr = enriched;
    const q = busca.trim().toLowerCase();
    if (q) arr = arr.filter(({ c }) => `${c.nome} ${c.email || ''} ${c.doc || ''} ${c.cidade || ''} ${(c.tags || []).join(' ')}`.toLowerCase().includes(q));
    if (fSeg) arr = arr.filter((r) => r.seg === fSeg);
    if (fCidade) arr = arr.filter(({ c }) => (c.cidade || '') === fCidade);
    if (fOrigem) arr = arr.filter(({ c }) => (c.origem || '') === fOrigem);
    if (fTag) arr = arr.filter(({ c }) => (c.tags || []).includes(fTag));
    if (fVip) arr = arr.filter(({ c }) => c.vip);
    if (fInativo) arr = arr.filter((r) => r.m.inativo);
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...arr].sort((a, b) => {
      if (sortKey === 'nome') return a.c.nome.localeCompare(b.c.nome) * dir;
      if (sortKey === 'eventos') return (a.m.nGanhos - b.m.nGanhos) * dir;
      if (sortKey === 'recencia') return (a.m.ultimaAtividade || '').localeCompare(b.m.ultimaAtividade || '') * dir;
      return (a.m.valorContratado - b.m.valorContratado) * dir;
    });
  }, [enriched, busca, fSeg, fCidade, fOrigem, fTag, fVip, fInativo, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtrados.length / PAGE_SIZE));
  const pageItems = filtrados.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
  const temFiltro = !!(busca || fSeg || fCidade || fOrigem || fTag || fVip || fInativo);

  // ── Ações ──
  async function derivarDosEventos() {
    if (!userId) return;
    setDerivBusy(true);
    const { data: rows } = await sb.from('clientes_eventos').select('id,quem_contratou,documento,email').eq('usuario_id', userId);
    const existentes = new Set(clientes.map((c) => chaveDedupe(c)));
    const porChave = new Map<string, { nome: string; doc: string; email: string; tipo: 'pf' | 'pj'; eventoIds: string[] }>();
    for (const r of (rows || []) as { id: string; quem_contratou: string | null; documento: string | null; email: string | null }[]) {
      const nome = (r.quem_contratou || '').trim();
      if (!nome) continue;
      const k = chaveDedupe({ doc: r.documento, email: r.email, nome });
      if (existentes.has(k)) continue;
      const cur = porChave.get(k) || { nome, doc: r.documento || '', email: r.email || '', tipo: soDigitos(r.documento).length > 11 ? 'pj' : 'pf', eventoIds: [] };
      cur.eventoIds.push(r.id);
      if (!cur.doc && r.documento) cur.doc = r.documento;
      if (!cur.email && r.email) cur.email = r.email;
      porChave.set(k, cur);
    }
    const vals = [...porChave.values()];
    if (!vals.length) { setDerivBusy(false); toast.info('Nenhum cliente novo a importar dos eventos.'); return; }
    const { data: inseridos, error } = await sb.from('clientes').insert(
      vals.map((v) => ({ usuario_id: userId, nome: v.nome, doc: v.doc || null, email: v.email || null, tipo: v.tipo })),
    ).select();
    if (error) { setDerivBusy(false); toast.error('Erro ao importar clientes dos eventos.'); return; }
    const byKey = new Map((inseridos as Cliente[]).map((c) => [chaveDedupe(c), c.id]));
    await Promise.all(vals.map((v) => {
      const id = byKey.get(chaveDedupe({ doc: v.doc, email: v.email, nome: v.nome }));
      return id ? sb.from('clientes_eventos').update({ cliente_id: id }).in('id', v.eventoIds).eq('usuario_id', userId) : null;
    }));
    setDerivBusy(false);
    toast.success(`${vals.length} cliente(s) importado(s) dos seus eventos.`);
    await carregar(userId);
  }

  async function mesclarTodos() {
    if (!userId || !duplicados.length) return;
    for (const g of duplicados) {
      const ord = [...g].sort((a, b) => (a.criado_em || '').localeCompare(b.criado_em || ''));
      const surv = ord[0]; const dups = ord.slice(1);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const patch: any = {}; let tags = [...(surv.tags || [])]; let vip = surv.vip;
      for (const d of dups) {
        await sb.from('clientes_eventos').update({ cliente_id: surv.id }).eq('cliente_id', d.id).eq('usuario_id', userId);
        await sb.from('clientes_interacoes').update({ cliente_id: surv.id }).eq('cliente_id', d.id).eq('usuario_id', userId);
        (['doc', 'email', 'telefone', 'whatsapp', 'cidade', 'estado', 'origem', 'aniversario', 'obs', 'segmento'] as const)
          .forEach((k) => { if (!surv[k] && d[k] && !patch[k]) patch[k] = d[k]; });
        tags = [...new Set([...tags, ...(d.tags || [])])];
        if (d.vip) vip = true;
        await sb.from('clientes').delete().eq('id', d.id).eq('usuario_id', userId);
      }
      patch.tags = tags; patch.vip = vip;
      await sb.from('clientes').update(patch).eq('id', surv.id).eq('usuario_id', userId);
    }
    toast.success('Clientes duplicados mesclados.');
    setMergeOpen(false);
    await carregar(userId);
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl space-y-4">
        <div className="h-[72px] animate-pulse rounded-2xl bg-black/[0.05]" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">{[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="h-[92px] animate-pulse rounded-2xl bg-black/[0.05]" />)}</div>
        <div className="h-[240px] animate-pulse rounded-2xl bg-black/[0.05]" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink sm:text-2xl">Clientes</h1>
          <p className="mt-1 text-sm text-ink-muted">O raio-x de cada contratante — histórico, valor gerado e relacionamento num só lugar. Os eventos vivem em <Link href="/painel/leads" className="font-semibold text-brand underline">Leads</Link>.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {filtrados.length > 0 && <button onClick={() => exportClientesCSV(filtrados)} className="flex items-center gap-1.5 rounded-xl border border-black/10 px-3 py-2.5 text-sm text-ink-muted hover:border-brand/30 hover:text-brand"><IcoDownload /> Exportar</button>}
          <button onClick={() => setImportOpen(true)} className="flex items-center gap-1.5 rounded-xl border border-black/10 px-3 py-2.5 text-sm font-semibold text-ink-soft hover:border-brand/30 hover:text-brand"><IcoUpload /> Importar</button>
          <button onClick={() => setNovo(true)} className="rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-600">+ Novo cliente</button>
        </div>
      </div>

      {needsSetup && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          A base de clientes ainda não foi criada. Rode a migration <code className="rounded bg-amber-100 px-1 py-0.5">docs/sql/clientes-crm.sql</code> no Supabase para ativar o CRM 360º.
        </div>
      )}

      {/* Aviso de duplicados */}
      {nDuplicados > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700"><IcoMerge /></span>
          <p className="min-w-0 flex-1 text-sm text-amber-800"><span className="font-semibold">{nDuplicados} possível(is) duplicado(s)</span> por documento, e-mail ou nome.</p>
          <button onClick={() => setMergeOpen(true)} className="shrink-0 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-700">Revisar e mesclar</button>
        </div>
      )}

      {!needsSetup && clientes.length === 0 ? (
        (() => {
          const hasEventos = eventos.some((e) => (e.quem_contratou || '').trim());
          return (
            <EmptyState
              icone={<IcoUsers size={30} />}
              titulo="Sua carteira de clientes começa aqui"
              descricao="Reúna todo contratante num só lugar: histórico de eventos, financeiro, interações e segmentação automática."
              acao={<>
                {hasEventos && <button onClick={derivarDosEventos} disabled={derivBusy} className="rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white hover:bg-brand-600 disabled:opacity-60">{derivBusy ? 'Importando…' : '✨ Importar clientes dos meus eventos'}</button>}
                <button onClick={() => setNovo(true)} className={`rounded-xl px-5 py-2.5 text-sm font-semibold ${hasEventos ? 'border border-black/10 text-ink-soft hover:border-brand/30 hover:text-brand' : 'bg-brand text-white hover:bg-brand-600'}`}>+ Adicionar primeiro cliente</button>
              </>}
            />
          );
        })()
      ) : !needsSetup && (
        <>
          {/* KPIs */}
          <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
            <Kpi label="Clientes" value={formatNumber(kpis.total)} sub={`${kpis.novosMes} novo(s) no mês`} tone="ink" icon={<IcoUsers />} />
            <Kpi label="Novos no mês" value={formatNumber(kpis.novosMes)} tone="brand" icon={<IcoSpark />} />
            <Kpi label="Ticket médio" value={formatMoneyShort(kpis.ticket)} sub="por evento ganho" tone="azul" icon={<IcoTicket />} />
            <Kpi label="LTV médio" value={formatMoneyShort(kpis.ltvMedio)} sub="por comprador" tone="gold" icon={<IcoCrown />} />
            <Kpi label="Recompra" value={formatPercent(kpis.recompra)} sub="2+ eventos" tone="verde" icon={<IcoRepeat />} />
            <Kpi label="Inativos" value={formatPercent(kpis.pctInativos)} sub="+90d sem ação" tone="vermelho" icon={<IcoSleep />} />
          </div>

          {/* Segmentos (RFM) + Origem */}
          <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-[1fr_320px]">
            <div className="rounded-2xl bg-white p-5 shadow-card">
              <div className="mb-1 flex items-center justify-between">
                <h3 className="text-base font-bold text-ink">Segmentação inteligente</h3>
                <span className="text-xs text-ink-muted">RFM · clique para filtrar</span>
              </div>
              <p className="mb-4 text-xs text-ink-muted">Recência × Frequência × Valor — rótulos automáticos usados também nas Campanhas.</p>
              <div className="space-y-2.5">
                {segDist.map((s) => {
                  const max = Math.max(1, ...segDist.map((x) => x.n));
                  const ativo = fSeg === s.v;
                  return (
                    <button key={s.v} onClick={() => setFSeg(ativo ? '' : s.v)} className={`block w-full rounded-xl px-2 py-1.5 text-left transition ${ativo ? 'bg-black/[0.04] ring-1 ring-brand/30' : 'hover:bg-black/[0.02]'}`}>
                      <div className="mb-1 flex items-center justify-between text-xs">
                        <span className="flex items-center gap-2 font-semibold text-ink-soft"><span className={`h-2.5 w-2.5 rounded-full ${s.dot}`} />{s.label}<span className="font-normal text-ink-muted">· {s.desc}</span></span>
                        <span className="font-semibold text-ink-muted">{s.n}{s.valor > 0 && <span className="ml-1.5 font-normal">· {formatMoneyShort(s.valor)}</span>}</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-black/[0.06]"><div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.round((s.n / max) * 100)}%`, background: s.cor }} /></div>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="rounded-2xl bg-white p-5 shadow-card">
              <h3 className="mb-4 text-base font-bold text-ink">Aquisição por origem</h3>
              {origemDist.length === 0 || (origemDist.length === 1 && origemDist[0][0] === '—') ? (
                <div className="flex h-[180px] items-center justify-center text-center"><p className="text-sm text-ink-muted">Defina a <strong>origem</strong> dos clientes para ver de onde eles vêm.</p></div>
              ) : <Donut data={origemDist.map(([k, v]) => [ORIGEM_LABEL[k] || (k === '—' ? 'Sem origem' : k), v] as [string, number])} />}
            </div>
          </div>

          {/* Lista */}
          <div className="mt-5 rounded-2xl bg-white p-5 shadow-card">
            {/* Toolbar */}
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <div className="relative min-w-[180px] flex-1">
                <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-muted"><IcoSearch /></span>
                <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar nome, e-mail, documento, cidade…" className="w-full rounded-xl border border-black/10 py-2 pl-8 pr-3 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20" />
              </div>
              <select value={fSeg} onChange={(e) => setFSeg(e.target.value as Segmento | '')} className={selCls}>
                <option value="">Segmento</option>
                {SEGMENTOS.map((s) => <option key={s.v} value={s.v}>{s.label}</option>)}
              </select>
              {cidades.length > 0 && (
                <select value={fCidade} onChange={(e) => setFCidade(e.target.value)} className={selCls}>
                  <option value="">Cidade</option>
                  {cidades.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              )}
              {origensUsadas.length > 0 && (
                <select value={fOrigem} onChange={(e) => setFOrigem(e.target.value)} className={selCls}>
                  <option value="">Origem</option>
                  {origensUsadas.map((o) => <option key={o} value={o}>{ORIGEM_LABEL[o] || o}</option>)}
                </select>
              )}
              {tags.length > 0 && (
                <select value={fTag} onChange={(e) => setFTag(e.target.value)} className={selCls}>
                  <option value="">Tag</option>
                  {tags.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              )}
              <button onClick={() => setFVip((v) => !v)} className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${fVip ? 'bg-amber-100 text-amber-700' : 'bg-black/[0.04] text-ink-muted hover:bg-black/[0.07]'}`}>★ VIP</button>
              <button onClick={() => setFInativo((v) => !v)} className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${fInativo ? 'bg-red-100 text-red-700' : 'bg-black/[0.04] text-ink-muted hover:bg-black/[0.07]'}`}>Inativos 90d</button>
              <select value={`${sortKey}:${sortDir}`} onChange={(e) => { const [k, d] = e.target.value.split(':'); setSortKey(k as SortKey); setSortDir(d as 'asc' | 'desc'); }} className={selCls}>
                <option value="ltv:desc">Maior valor</option>
                <option value="recencia:desc">Mais recentes</option>
                <option value="recencia:asc">Mais inativos</option>
                <option value="eventos:desc">Mais eventos</option>
                <option value="nome:asc">Nome (A–Z)</option>
              </select>
            </div>

            {filtrados.length === 0 ? (
              <p className="py-12 text-center text-sm text-ink-muted">{temFiltro ? 'Nenhum cliente corresponde aos filtros.' : 'Nenhum cliente ainda.'}</p>
            ) : (
              <>
                {/* Desktop: tabela */}
                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-black/[0.06] text-left text-xs text-ink-muted">
                        <th className="pb-2 font-semibold">Cliente</th>
                        <th className="pb-2 font-semibold">Segmento</th>
                        <th className="pb-2 font-semibold">Cidade</th>
                        <th className="pb-2 text-center font-semibold">Eventos</th>
                        <th className="pb-2 text-right font-semibold">Valor gerado</th>
                        <th className="pb-2 font-semibold">Últ. atividade</th>
                        <th className="pb-2 font-semibold">Próximo</th>
                        <th className="w-10 pb-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {pageItems.map(({ c, m, seg }) => {
                        const wa = waLink(c.whatsapp || c.telefone);
                        return (
                          <tr key={c.id} onClick={() => router.push(`/painel/clientes/${c.id}`)} className="group cursor-pointer border-b border-black/[0.04] last:border-0 hover:bg-black/[0.015]">
                            <td className="py-2.5">
                              <div className="flex items-center gap-2.5">
                                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-bold text-brand">{iniciais(c.nome)}</span>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <span className="truncate font-semibold text-ink">{c.nome}</span>
                                    {c.vip && <span title="VIP" className="text-amber-500">★</span>}
                                    <span className="rounded bg-black/[0.04] px-1 py-0.5 text-[0.6rem] font-bold uppercase text-ink-muted">{c.tipo}</span>
                                  </div>
                                  {(c.tags || []).length > 0 && <div className="mt-0.5 flex flex-wrap gap-1">{(c.tags || []).slice(0, 3).map((t) => <span key={t} className="rounded-full bg-brand-50 px-1.5 py-0.5 text-[0.6rem] font-medium text-brand">{t}</span>)}</div>}
                                </div>
                              </div>
                            </td>
                            <td className="py-2.5"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${SEG_BY[seg].cls}`}>{SEG_BY[seg].label}</span></td>
                            <td className="py-2.5 text-ink-muted">{c.cidade || '—'}{c.estado ? `/${c.estado}` : ''}</td>
                            <td className="py-2.5 text-center text-ink-soft"><span className="font-semibold">{m.nGanhos}</span>{m.nEventos > m.nGanhos && <span className="text-ink-muted">/{m.nEventos}</span>}</td>
                            <td className="py-2.5 text-right font-bold text-ink">{m.valorContratado > 0 ? formatMoney(m.valorContratado) : <span className="font-normal text-ink-muted">—</span>}</td>
                            <td className="py-2.5 text-ink-muted">{m.ultimaAtividade ? formatDate(m.ultimaAtividade, { style: 'short' }) : '—'}{m.inativo && <span className="ml-1 text-red-500" title="Inativo">●</span>}</td>
                            <td className="py-2.5 text-ink-muted">{m.proximoEvento?.data_inicio ? formatDate(m.proximoEvento.data_inicio, { style: 'short' }) : '—'}</td>
                            <td className="py-2.5 pl-2 text-right" onClick={(e) => e.stopPropagation()}>
                              {wa && <a href={wa} target="_blank" rel="noopener noreferrer" title="WhatsApp" className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-ink-muted opacity-0 transition hover:bg-emerald-50 hover:text-emerald-600 group-hover:opacity-100">💬</a>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile: cards */}
                <div className="space-y-2.5 md:hidden">
                  {pageItems.map(({ c, m, seg }) => (
                    <button key={c.id} onClick={() => router.push(`/painel/clientes/${c.id}`)} className="block w-full rounded-xl border border-black/[0.06] p-3 text-left transition hover:border-brand/30">
                      <div className="flex items-start gap-2.5">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-sm font-bold text-brand">{iniciais(c.nome)}</span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="truncate font-semibold text-ink">{c.nome}</span>{c.vip && <span className="text-amber-500">★</span>}
                          </div>
                          <div className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-muted">
                            <span className={`rounded-full px-1.5 py-0.5 font-semibold ${SEG_BY[seg].cls}`}>{SEG_BY[seg].label}</span>
                            {c.cidade && <span>· {c.cidade}</span>}
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          <div className="font-bold text-ink">{m.valorContratado > 0 ? formatMoneyShort(m.valorContratado) : '—'}</div>
                          <div className="text-[0.65rem] text-ink-muted">{m.nGanhos} evento(s)</div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>

                {totalPages > 1 && (
                  <div className="mt-4 flex items-center justify-between text-xs text-ink-muted">
                    <span>{filtrados.length} cliente(s) · página {page + 1} de {totalPages}</span>
                    <div className="flex gap-1">
                      <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} className="rounded-lg border border-black/10 px-3 py-1.5 font-semibold disabled:opacity-40 enabled:hover:border-brand/30 enabled:hover:text-brand">Anterior</button>
                      <button onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="rounded-lg border border-black/10 px-3 py-1.5 font-semibold disabled:opacity-40 enabled:hover:border-brand/30 enabled:hover:text-brand">Próxima</button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </>
      )}

      {novo && userId && <NovoClienteModal userId={userId} existentes={clientes} onClose={() => setNovo(false)} onSaved={async () => { setNovo(false); await carregar(userId); }} />}
      {importOpen && userId && <ImportModal userId={userId} existentes={clientes} onClose={() => setImportOpen(false)} onDone={async () => { setImportOpen(false); await carregar(userId); }} />}
      {mergeOpen && <MergeModal grupos={duplicados} onClose={() => setMergeOpen(false)} onConfirm={mesclarTodos} />}
    </div>
  );
}

// ── Modal: novo cliente ─────────────────────────────────────────────────────────
function NovoClienteModal({ userId, existentes, onClose, onSaved }: { userId: string; existentes: Cliente[]; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [tipo, setTipo] = useState<'pf' | 'pj'>('pf');
  const [nome, setNome] = useState(''); const [doc, setDoc] = useState(''); const [email, setEmail] = useState('');
  const [telefone, setTelefone] = useState(''); const [whatsapp, setWhatsapp] = useState('');
  const [cidade, setCidade] = useState(''); const [estado, setEstado] = useState('');
  const [origem, setOrigem] = useState(''); const [tagsStr, setTagsStr] = useState(''); const [vip, setVip] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onEsc); return () => document.removeEventListener('keydown', onEsc);
  }, [onClose]);

  async function salvar() {
    if (!nome.trim()) return;
    const dup = existentes.find((c) => chaveDedupe(c) === chaveDedupe({ doc, email, nome }));
    if (dup && !confirm(`Já existe "${dup.nome}" com o mesmo documento/e-mail/nome. Criar mesmo assim?`)) return;
    setSaving(true);
    const tags = tagsStr.split(',').map((t) => t.trim()).filter(Boolean);
    const { error } = await sb.from('clientes').insert({
      usuario_id: userId, tipo, nome: nome.trim(), doc: doc.trim() || null, email: email.trim() || null,
      telefone: telefone.trim() || null, whatsapp: whatsapp.trim() || null, cidade: cidade.trim() || null,
      estado: estado.trim().toUpperCase().slice(0, 2) || null, origem: origem || null, tags, vip,
    });
    setSaving(false);
    if (error) { toast.error('Erro ao salvar cliente.'); return; }
    toast.success('Cliente cadastrado!'); onSaved();
  }

  return (
    <Modal onClose={onClose} title="Novo cliente">
      <div className="space-y-4">
        <div className="flex gap-2">
          {(['pf', 'pj'] as const).map((t) => <button key={t} onClick={() => setTipo(t)} className={`flex-1 rounded-xl border px-3 py-2 text-sm font-semibold transition ${tipo === t ? 'border-brand bg-brand-50 text-brand' : 'border-black/10 text-ink-muted hover:border-black/20'}`}>{t === 'pf' ? 'Pessoa Física' : 'Pessoa Jurídica'}</button>)}
        </div>
        <Campo label={tipo === 'pf' ? 'Nome completo' : 'Razão social / nome'}><input className={inp} value={nome} onChange={(e) => setNome(e.target.value)} autoFocus placeholder="Ex: Maria Silva" /></Campo>
        <div className="grid grid-cols-2 gap-4">
          <Campo label={tipo === 'pf' ? 'CPF' : 'CNPJ'}><input className={inp} value={doc} onChange={(e) => setDoc(e.target.value)} placeholder={tipo === 'pf' ? '000.000.000-00' : '00.000.000/0000-00'} /></Campo>
          <Campo label="E-mail"><input type="email" className={inp} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@exemplo.com" /></Campo>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Campo label="Telefone"><input type="tel" className={inp} value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="(00) 0000-0000" /></Campo>
          <Campo label="WhatsApp"><input type="tel" className={inp} value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="(00) 00000-0000" /></Campo>
        </div>
        <div className="grid grid-cols-[1fr_88px] gap-4">
          <Campo label="Cidade"><input className={inp} value={cidade} onChange={(e) => setCidade(e.target.value)} /></Campo>
          <Campo label="UF"><input className={inp} value={estado} onChange={(e) => setEstado(e.target.value)} maxLength={2} placeholder="SP" /></Campo>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Campo label="Origem"><select className={inp} value={origem} onChange={(e) => setOrigem(e.target.value)}><option value="">Selecionar…</option>{ORIGENS.map((o) => <option key={o} value={o}>{ORIGEM_LABEL[o]}</option>)}</select></Campo>
          <Campo label="Tags (vírgula)"><input className={inp} value={tagsStr} onChange={(e) => setTagsStr(e.target.value)} placeholder="casamento, premium" /></Campo>
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-ink-soft"><input type="checkbox" checked={vip} onChange={(e) => setVip(e.target.checked)} className="h-4 w-4 accent-brand" /> Marcar como VIP ★</label>
      </div>
      <div className="mt-6 flex items-center gap-3">
        <button onClick={salvar} disabled={saving || !nome.trim()} className="rounded-xl bg-brand px-6 py-3 text-sm font-bold text-white transition hover:bg-brand-600 disabled:opacity-60">{saving ? 'Salvando…' : 'Cadastrar cliente'}</button>
        <button onClick={onClose} className="ml-auto text-sm font-medium text-ink-muted hover:text-ink">Cancelar</button>
      </div>
    </Modal>
  );
}

// ── Modal: importar CSV ─────────────────────────────────────────────────────────
function ImportModal({ userId, existentes, onClose, onDone }: { userId: string; existentes: Cliente[]; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [preview, setPreview] = useState<ReturnType<typeof importClientesCSV>>([]);
  const [novos, setNovos] = useState(0); const [dups, setDups] = useState(0);
  const [busy, setBusy] = useState(false); const [fileName, setFileName] = useState('');

  function onFile(file: File) {
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      const rows = importClientesCSV(String(reader.result || ''));
      const existKeys = new Set(existentes.map((c) => chaveDedupe(c)));
      let nv = 0, dp = 0;
      const seen = new Set<string>();
      for (const r of rows) { const k = chaveDedupe(r); if (existKeys.has(k) || seen.has(k)) dp++; else { nv++; seen.add(k); } }
      setPreview(rows); setNovos(nv); setDups(dp);
    };
    reader.readAsText(file);
  }

  async function importar() {
    if (!preview.length) return;
    setBusy(true);
    const existKeys = new Set(existentes.map((c) => chaveDedupe(c)));
    const seen = new Set<string>();
    const payload = preview.filter((r) => { const k = chaveDedupe(r); if (existKeys.has(k) || seen.has(k)) return false; seen.add(k); return true; })
      .map((r) => ({ usuario_id: userId, tipo: r.tipo, nome: r.nome, doc: r.doc || null, email: r.email || null, telefone: r.telefone || null, cidade: r.cidade || null, estado: r.estado || null, origem: r.origem || null }));
    if (!payload.length) { setBusy(false); toast.info('Nada novo para importar (tudo já existe).'); return; }
    const { error } = await sb.from('clientes').insert(payload);
    setBusy(false);
    if (error) { toast.error('Erro ao importar.'); return; }
    toast.success(`${payload.length} cliente(s) importado(s).`); onDone();
  }

  return (
    <Modal onClose={onClose} title="Importar clientes (CSV)">
      <p className="mb-4 text-sm text-ink-muted">Arquivo com cabeçalho. Colunas reconhecidas: <code className="rounded bg-black/[0.04] px-1">nome</code>, <code className="rounded bg-black/[0.04] px-1">email</code>, <code className="rounded bg-black/[0.04] px-1">doc</code>, <code className="rounded bg-black/[0.04] px-1">telefone</code>, <code className="rounded bg-black/[0.04] px-1">cidade</code>, <code className="rounded bg-black/[0.04] px-1">estado</code>, <code className="rounded bg-black/[0.04] px-1">origem</code>. De-dupe por documento/e-mail.</p>
      <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-black/15 px-4 py-8 text-center transition hover:border-brand/40">
        <IcoUpload size={22} />
        <span className="text-sm font-semibold text-ink-soft">{fileName || 'Clique para escolher um arquivo .csv'}</span>
        <input type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
      </label>
      {preview.length > 0 && (
        <div className="mt-4">
          <div className="mb-2 flex items-center gap-3 text-sm">
            <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 font-semibold text-emerald-700">{novos} novo(s)</span>
            {dups > 0 && <span className="rounded-full bg-amber-50 px-2.5 py-0.5 font-semibold text-amber-700">{dups} duplicado(s) ignorado(s)</span>}
          </div>
          <div className="max-h-44 overflow-y-auto rounded-xl border border-black/[0.06]">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-black/[0.02] text-ink-muted"><tr><th className="px-3 py-1.5 text-left font-semibold">Nome</th><th className="px-3 py-1.5 text-left font-semibold">E-mail</th><th className="px-3 py-1.5 text-left font-semibold">Cidade</th></tr></thead>
              <tbody>{preview.slice(0, 50).map((r, i) => <tr key={i} className="border-t border-black/[0.04]"><td className="px-3 py-1.5 text-ink-soft">{r.nome}</td><td className="px-3 py-1.5 text-ink-muted">{r.email || '—'}</td><td className="px-3 py-1.5 text-ink-muted">{r.cidade || '—'}</td></tr>)}</tbody>
            </table>
          </div>
        </div>
      )}
      <div className="mt-6 flex items-center gap-3">
        <button onClick={importar} disabled={busy || novos === 0} className="rounded-xl bg-brand px-6 py-3 text-sm font-bold text-white transition hover:bg-brand-600 disabled:opacity-60">{busy ? 'Importando…' : `Importar ${novos || ''}`}</button>
        <button onClick={onClose} className="ml-auto text-sm font-medium text-ink-muted hover:text-ink">Cancelar</button>
      </div>
    </Modal>
  );
}

// ── Modal: mesclar duplicados ─────────────────────────────────────────────────
function MergeModal({ grupos, onClose, onConfirm }: { grupos: Cliente[][]; onClose: () => void; onConfirm: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  return (
    <Modal onClose={onClose} title="Mesclar duplicados">
      <p className="mb-4 text-sm text-ink-muted">Cada grupo será unificado no cadastro <strong>mais antigo</strong>; eventos, parcelas e interações são repontados e os campos vazios preenchidos. Esta ação não pode ser desfeita.</p>
      <div className="max-h-72 space-y-3 overflow-y-auto">
        {grupos.map((g, i) => {
          const ord = [...g].sort((a, b) => (a.criado_em || '').localeCompare(b.criado_em || ''));
          return (
            <div key={i} className="rounded-xl border border-black/[0.06] p-3">
              {ord.map((c, j) => (
                <div key={c.id} className="flex items-center gap-2 py-0.5 text-sm">
                  <span className={`rounded px-1.5 py-0.5 text-[0.6rem] font-bold uppercase ${j === 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-black/[0.04] text-ink-muted'}`}>{j === 0 ? 'manter' : 'mesclar'}</span>
                  <span className="font-semibold text-ink">{c.nome}</span>
                  <span className="text-xs text-ink-muted">{c.doc || c.email || '—'}</span>
                </div>
              ))}
            </div>
          );
        })}
      </div>
      <div className="mt-6 flex items-center gap-3">
        <button onClick={async () => { setBusy(true); await onConfirm(); setBusy(false); }} disabled={busy} className="rounded-xl bg-amber-600 px-6 py-3 text-sm font-bold text-white transition hover:bg-amber-700 disabled:opacity-60">{busy ? 'Mesclando…' : `Mesclar ${grupos.length} grupo(s)`}</button>
        <button onClick={onClose} className="ml-auto text-sm font-medium text-ink-muted hover:text-ink">Cancelar</button>
      </div>
    </Modal>
  );
}

// ── UI helpers ────────────────────────────────────────────────────────────────
function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[10000] flex items-start justify-center overflow-y-auto bg-black/50 p-4" onClick={onClose}>
      <div className="relative my-8 w-full max-w-md rounded-2xl bg-white p-6 shadow-pop" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full border border-black/10 text-ink-muted hover:bg-black/[0.03]">✕</button>
        <h3 className="mb-5 font-display text-xl font-bold text-ink">{title}</h3>
        {children}
      </div>
    </div>
  );
}

function Campo({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block"><span className="mb-1.5 block text-sm font-semibold text-ink-soft">{label}</span>{children}</label>;
}

function Kpi({ label, value, sub, tone, icon }: { label: string; value: string; sub?: string; tone: 'ink' | 'brand' | 'azul' | 'gold' | 'verde' | 'vermelho'; icon?: ReactNode }) {
  const color = { ink: 'text-ink', brand: 'text-brand', azul: 'text-blue-600', gold: 'text-amber-600', verde: 'text-emerald-600', vermelho: 'text-red-600' }[tone];
  const iconBg = { ink: 'bg-black/[0.05] text-ink-soft', brand: 'bg-brand-50 text-brand', azul: 'bg-blue-50 text-blue-600', gold: 'bg-amber-50 text-amber-600', verde: 'bg-emerald-50 text-emerald-600', vermelho: 'bg-red-50 text-red-600' }[tone];
  return (
    <div className="rounded-2xl bg-white p-4 shadow-card">
      <div className="flex items-start justify-between gap-2"><span className="text-xs text-ink-muted">{label}</span>{icon && <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${iconBg}`}>{icon}</span>}</div>
      <div className={`mt-2 text-xl font-bold ${color}`}>{value}</div>
      {sub && <div className="mt-0.5 text-[0.68rem] text-ink-muted">{sub}</div>}
    </div>
  );
}

function Donut({ data }: { data: [string, number][] }) {
  const PALETTE = ['#ff385c', '#10b981', '#f59e0b', '#1a73e8', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#94a3b8'];
  const total = data.reduce((s, [, v]) => s + v, 0) || 1, top = data.slice(0, 8), r = 52, sw = 16, C = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="flex items-center gap-4">
      <svg width="128" height="128" viewBox="0 0 128 128" className="shrink-0 -rotate-90">
        <circle cx="64" cy="64" r={r} fill="none" stroke="#f1f5f9" strokeWidth={sw} />
        {top.map(([cat, val], i) => { const len = (val / total) * C; const el = <circle key={cat} cx="64" cy="64" r={r} fill="none" stroke={PALETTE[i % PALETTE.length]} strokeWidth={sw} strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-offset} />; offset += len; return el; })}
      </svg>
      <div className="min-w-0 flex-1 space-y-1.5">
        {top.map(([cat, val], i) => <div key={cat} className="flex items-center gap-2 text-xs"><span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: PALETTE[i % PALETTE.length] }} /><span className="min-w-0 flex-1 truncate text-ink-soft">{cat}</span><span className="shrink-0 font-semibold text-ink-muted">{Math.round((val / total) * 100)}%</span></div>)}
      </div>
    </div>
  );
}

// ── Ícones ──
const svg = (path: ReactNode, size = 15, sw = 2) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">{path}</svg>;
const IcoUsers = ({ size = 15 }: { size?: number }) => svg(<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm13 10v-2a4 4 0 0 0-3-3.87M16 3.13A4 4 0 0 1 16 11" />, size, 1.8);
const IcoSearch = () => svg(<path d="M21 21l-4.3-4.3M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16Z" />, 14);
const IcoDownload = () => svg(<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />, 13);
const IcoUpload = ({ size = 13 }: { size?: number }) => svg(<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 9l5-5 5 5M12 4v12" />, size);
const IcoTicket = () => svg(<path d="M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4Zm10-2v12" />);
const IcoCrown = () => svg(<path d="M3 18h18M4 8l4 4 4-7 4 7 4-4-2 10H6L4 8Z" />);
const IcoRepeat = () => svg(<path d="M17 2l4 4-4 4M3 11V9a4 4 0 0 1 4-4h14M7 22l-4-4 4-4M21 13v2a4 4 0 0 1-4 4H3" />, 14);
const IcoSleep = () => svg(<path d="M12 3a9 9 0 1 0 9 9c-4.97 0-9-4.03-9-9Z" />, 14);
const IcoSpark = () => svg(<path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1" />, 14);
const IcoMerge = () => svg(<path d="M7 3v6a5 5 0 0 0 5 5 5 5 0 0 0 5-5V3M12 14v7" />, 16);
