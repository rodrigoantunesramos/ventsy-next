'use client';

// Fornecedores & Prestadores — /painel/fornecedores.
// Base operacional dos parceiros recorrentes (buffet, som, segurança, decoração,
// locação, gráfica, bebidas…): cadastro 360º, avaliação de desempenho, gasto
// (puxado de Contas a pagar), homologação e documentos com alerta de vencimento.
// PILARES: KPIs da base · distribuição por categoria · ranking preço×avaliação
//   para decisão de compra · lista filtrável · novo · importar CSV · exportar.
// Distinto de /painel/terceiros (custo×retorno macro) — aqui é o cadastro.
// Fonte: fornecedores (+avaliacao_media via trigger), lancamentos (despesas
// vinculadas), fornecedores_docs. Sem "R$" hardcoded — tudo via lib/format.

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseAny as sb } from '@/lib/supabase';
import { formatMoney, formatMoneyShort, formatNumber } from '@/lib/format';
import { useToast } from '@/components/Toast';
import {
  type Fornecedor, type DespesaLite, type FornDoc, type GastoForn, type Homologacao,
  CATEGORIAS, catLabel, catCor, HOMOLOGACOES, HOMOLOG_BY,
  gastoPorFornecedor, docStatus, iniciais, waLink, chaveDedupe,
  importFornecedoresCSV, exportFornecedoresCSV,
} from './_lib';

// ── Constantes ────────────────────────────────────────────────────────────────
const PAGE_SIZE = 20;
const inp = 'w-full rounded-xl border border-black/10 bg-white px-3.5 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20';
const selCls = 'rounded-xl border border-black/10 bg-white px-3 py-2 text-sm focus:border-brand focus:outline-none';
type SortKey = 'gasto' | 'avaliacao' | 'nome' | 'recente';
type Row = { f: Fornecedor; gasto: GastoForn; docsVencidos: number; docsAvencer: number };

// ── Página ────────────────────────────────────────────────────────────────────
export default function FornecedoresPage() {
  const router = useRouter();
  const toast = useToast();
  const anoRef = useMemo(() => new Date().getFullYear(), []);

  const [loading, setLoading] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [despesas, setDespesas] = useState<DespesaLite[]>([]);
  const [docs, setDocs] = useState<FornDoc[]>([]);

  // filtros / ordenação / paginação
  const [busca, setBusca] = useState('');
  const [fCat, setFCat] = useState('');
  const [fCidade, setFCidade] = useState('');
  const [fHomolog, setFHomolog] = useState<Homologacao | ''>('');
  const [fAval, setFAval] = useState(0);
  const [fInativos, setFInativos] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('gasto');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(0);

  // comparação por categoria
  const [rankCat, setRankCat] = useState('');

  // modais
  const [novo, setNovo] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const carregar = useCallback(async (uid: string) => {
    const fRes = await sb.from('fornecedores').select('*').eq('usuario_id', uid).order('criado_em', { ascending: false });
    // Tabela ainda não criada: Postgres cru responde 42P01; via PostgREST (REST do
    // browser) vem PGRST205 (404, "Could not find the table"). Trata os dois.
    if (fRes.error && (fRes.error.code === '42P01' || fRes.error.code === 'PGRST205')) { setNeedsSetup(true); setFornecedores([]); return; }
    setNeedsSetup(false);
    setFornecedores(((fRes.data || []) as Fornecedor[]).map((f) => ({
      ...f,
      tags: Array.isArray(f.tags) ? f.tags : [],
      banco: f.banco && typeof f.banco === 'object' ? f.banco : {},
      avaliacao_media: Number(f.avaliacao_media) || 0,
      avaliacao_n: Number(f.avaliacao_n) || 0,
    })));
    const [dRes, docRes] = await Promise.all([
      sb.from('lancamentos').select('id,fornecedor_id,categoria,descricao,valor,data,status,tipo_evento,metodo_pagamento').eq('usuario_id', uid).eq('tipo', 'despesa').not('fornecedor_id', 'is', null),
      sb.from('fornecedores_docs').select('id,fornecedor_id,validade').eq('usuario_id', uid),
    ]);
    setDespesas(dRes.error ? [] : ((dRes.data || []) as DespesaLite[]).map((d) => ({ ...d, id: Number(d.id), valor: Number(d.valor) || 0 })));
    setDocs(docRes.error ? [] : ((docRes.data || []) as FornDoc[]));
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

  useEffect(() => { setPage(0); }, [busca, fCat, fCidade, fHomolog, fAval, fInativos]);

  // ── Agregações ──
  const gastoMap = useMemo(() => gastoPorFornecedor(despesas, anoRef), [despesas, anoRef]);
  const docsMap = useMemo(() => {
    const m = new Map<string, { vencidos: number; avencer: number }>();
    for (const d of docs) {
      const st = docStatus(d.validade);
      if (st !== 'vencido' && st !== 'avencer') continue;
      const e = m.get(d.fornecedor_id) || { vencidos: 0, avencer: 0 };
      if (st === 'vencido') e.vencidos++; else e.avencer++;
      m.set(d.fornecedor_id, e);
    }
    return m;
  }, [docs]);

  const rows = useMemo<Row[]>(() => fornecedores.map((f) => {
    const gasto = gastoMap.get(f.id) || { total: 0, ytd: 0, n: 0, ultima: null };
    const dv = docsMap.get(f.id) || { vencidos: 0, avencer: 0 };
    return { f, gasto, docsVencidos: dv.vencidos, docsAvencer: dv.avencer };
  }), [fornecedores, gastoMap, docsMap]);

  // ── KPIs ──
  const kpis = useMemo(() => {
    const ativos = rows.filter((r) => r.f.ativo);
    const comAval = rows.filter((r) => r.f.avaliacao_n > 0);
    const avalMedia = comAval.length ? comAval.reduce((s, r) => s + r.f.avaliacao_media, 0) / comAval.length : 0;
    return {
      total: rows.length,
      ativos: ativos.length,
      homologados: rows.filter((r) => r.f.homologacao === 'homologado').length,
      gastoYtd: rows.reduce((s, r) => s + r.gasto.ytd, 0),
      avalMedia,
      docsVencidos: rows.reduce((s, r) => s + r.docsVencidos, 0),
    };
  }, [rows]);

  // ── Distribuição por categoria ──
  const catDist = useMemo(() => {
    const m = new Map<string, { n: number; gasto: number }>();
    rows.forEach((r) => { const k = r.f.categoria || 'outro'; const e = m.get(k) || { n: 0, gasto: 0 }; e.n++; e.gasto += r.gasto.total; m.set(k, e); });
    return [...m.entries()].map(([v, e]) => ({ v, label: catLabel(v), cor: catCor(v), ...e })).sort((a, b) => b.n - a.n);
  }, [rows]);

  // ── Ranking por categoria (preço × avaliação) p/ decisão de compra ──
  const catAtivaRank = rankCat || catDist[0]?.v || '';
  const ranking = useMemo(() => {
    if (!catAtivaRank) return [];
    return rows.filter((r) => r.f.categoria === catAtivaRank && r.f.ativo)
      .sort((a, b) => (b.f.avaliacao_media - a.f.avaliacao_media) || (a.gasto.total - b.gasto.total))
      .slice(0, 6);
  }, [rows, catAtivaRank]);

  // opções de filtro dinâmicas
  const cidades = useMemo(() => [...new Set(fornecedores.map((f) => f.cidade).filter(Boolean) as string[])].sort(), [fornecedores]);

  // ── Lista filtrada/ordenada/paginada ──
  const filtrados = useMemo(() => {
    let arr = rows;
    const q = busca.trim().toLowerCase();
    if (q) arr = arr.filter(({ f }) => `${f.nome} ${f.fantasia || ''} ${f.doc || ''} ${f.cidade || ''} ${f.contato || ''} ${(f.tags || []).join(' ')}`.toLowerCase().includes(q));
    if (fCat) arr = arr.filter(({ f }) => f.categoria === fCat);
    if (fCidade) arr = arr.filter(({ f }) => (f.cidade || '') === fCidade);
    if (fHomolog) arr = arr.filter(({ f }) => f.homologacao === fHomolog);
    if (fAval > 0) arr = arr.filter(({ f }) => f.avaliacao_media >= fAval);
    if (!fInativos) arr = arr.filter(({ f }) => f.ativo);
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...arr].sort((a, b) => {
      if (sortKey === 'nome') return a.f.nome.localeCompare(b.f.nome) * dir;
      if (sortKey === 'avaliacao') return (a.f.avaliacao_media - b.f.avaliacao_media) * dir;
      if (sortKey === 'recente') return (a.f.criado_em || '').localeCompare(b.f.criado_em || '') * dir;
      return (a.gasto.total - b.gasto.total) * dir;
    });
  }, [rows, busca, fCat, fCidade, fHomolog, fAval, fInativos, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtrados.length / PAGE_SIZE));
  const pageItems = filtrados.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
  const temFiltro = !!(busca || fCat || fCidade || fHomolog || fAval || fInativos);

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
          <h1 className="text-xl font-bold text-ink sm:text-2xl">Fornecedores</h1>
          <p className="mt-1 text-sm text-ink-muted">Buffet, som, segurança, decoração, locação e mais — avaliação, gasto e documentos num só lugar.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {filtrados.length > 0 && <button onClick={() => exportFornecedoresCSV(filtrados)} className="flex items-center gap-1.5 rounded-xl border border-black/10 px-3 py-2.5 text-sm text-ink-muted hover:border-brand/30 hover:text-brand"><IcoDownload /> Exportar</button>}
          <button onClick={() => setImportOpen(true)} className="flex items-center gap-1.5 rounded-xl border border-black/10 px-3 py-2.5 text-sm font-semibold text-ink-soft hover:border-brand/30 hover:text-brand"><IcoUpload /> Importar</button>
          <button onClick={() => setNovo(true)} className="rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-600">+ Novo fornecedor</button>
        </div>
      </div>

      {needsSetup && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          A base de fornecedores ainda não foi criada. Rode a migration <code className="rounded bg-amber-100 px-1 py-0.5">docs/sql/fornecedores.sql</code> no Supabase para ativar o módulo.
        </div>
      )}

      {!needsSetup && fornecedores.length === 0 ? (
        <EmptyFornecedores onNovo={() => setNovo(true)} onImport={() => setImportOpen(true)} />
      ) : !needsSetup && (
        <>
          {/* KPIs */}
          <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
            <Kpi label="Fornecedores" value={formatNumber(kpis.total)} sub={`${kpis.ativos} ativo(s)`} tone="ink" icon={<IcoTruck />} />
            <Kpi label="Homologados" value={formatNumber(kpis.homologados)} sub={`de ${kpis.total}`} tone="verde" icon={<IcoShield />} />
            <Kpi label="Gasto no ano" value={formatMoneyShort(kpis.gastoYtd)} sub={`em ${anoRef}`} tone="gold" icon={<IcoWallet />} />
            <Kpi label="Avaliação média" value={kpis.avalMedia ? `${kpis.avalMedia.toFixed(1)}★` : '—'} sub="da carteira" tone="azul" icon={<IcoStar />} />
            <Kpi label="Categorias" value={formatNumber(catDist.length)} tone="brand" icon={<IcoTag />} />
            <Kpi label="Docs vencidos" value={formatNumber(kpis.docsVencidos)} sub="a regularizar" tone={kpis.docsVencidos ? 'vermelho' : 'ink'} icon={<IcoAlert />} />
          </div>

          {/* Categorias + Ranking (comparação preço×avaliação) */}
          <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-[320px_1fr]">
            <div className="rounded-2xl bg-white p-5 shadow-card">
              <h3 className="mb-4 text-base font-bold text-ink">Por categoria</h3>
              {catDist.length === 0 ? (
                <div className="flex h-[180px] items-center justify-center text-center"><p className="text-sm text-ink-muted">Cadastre fornecedores para ver a distribuição.</p></div>
              ) : <Donut data={catDist.map((c) => ({ label: c.label, value: c.n, cor: c.cor }))} />}
            </div>
            <div className="rounded-2xl bg-white p-5 shadow-card">
              <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-base font-bold text-ink">Ranking para decisão de compra</h3>
                <select value={catAtivaRank} onChange={(e) => setRankCat(e.target.value)} className={selCls}>
                  {catDist.map((c) => <option key={c.v} value={c.v}>{c.label} ({c.n})</option>)}
                </select>
              </div>
              <p className="mb-4 text-xs text-ink-muted">Melhores parceiros da categoria por avaliação × gasto — clique para abrir a ficha.</p>
              {ranking.length === 0 ? (
                <p className="py-10 text-center text-sm text-ink-muted">Sem fornecedores ativos nesta categoria.</p>
              ) : (
                <div className="space-y-2">
                  {ranking.map((r, i) => (
                    <button key={r.f.id} onClick={() => router.push(`/painel/fornecedores/${r.f.id}`)} className="flex w-full items-center gap-3 rounded-xl border border-black/[0.06] p-2.5 text-left transition hover:border-brand/30 hover:bg-brand-50/30">
                      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${i === 0 ? 'bg-amber-100 text-amber-700' : 'bg-black/[0.05] text-ink-muted'}`}>{i + 1}</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-ink">{r.f.fantasia || r.f.nome}</p>
                        <p className="text-xs text-ink-muted">{r.f.cidade || '—'}{r.f.condicoes_pagamento ? ` · ${r.f.condicoes_pagamento}` : ''}</p>
                      </div>
                      <Stars media={r.f.avaliacao_media} n={r.f.avaliacao_n} compact />
                      <span className="shrink-0 text-right text-sm font-bold text-ink">{r.gasto.total > 0 ? formatMoneyShort(r.gasto.total) : <span className="font-normal text-ink-muted">—</span>}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Lista */}
          <div className="mt-5 rounded-2xl bg-white p-5 shadow-card">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <div className="relative min-w-[180px] flex-1">
                <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-muted"><IcoSearch /></span>
                <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar nome, fantasia, documento, contato…" className="w-full rounded-xl border border-black/10 py-2 pl-8 pr-3 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20" />
              </div>
              <select value={fCat} onChange={(e) => setFCat(e.target.value)} className={selCls}>
                <option value="">Categoria</option>
                {CATEGORIAS.map((c) => <option key={c.v} value={c.v}>{c.label}</option>)}
              </select>
              {cidades.length > 0 && (
                <select value={fCidade} onChange={(e) => setFCidade(e.target.value)} className={selCls}>
                  <option value="">Cidade</option>
                  {cidades.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              )}
              <select value={fHomolog} onChange={(e) => setFHomolog(e.target.value as Homologacao | '')} className={selCls}>
                <option value="">Homologação</option>
                {HOMOLOGACOES.map((h) => <option key={h.v} value={h.v}>{h.label}</option>)}
              </select>
              <select value={fAval} onChange={(e) => setFAval(Number(e.target.value))} className={selCls}>
                <option value={0}>Avaliação</option>
                <option value={4}>4★ ou mais</option>
                <option value={3}>3★ ou mais</option>
                <option value={2}>2★ ou mais</option>
              </select>
              <button onClick={() => setFInativos((v) => !v)} className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${fInativos ? 'bg-ink text-white' : 'bg-black/[0.04] text-ink-muted hover:bg-black/[0.07]'}`}>Incluir inativos</button>
              <select value={`${sortKey}:${sortDir}`} onChange={(e) => { const [k, d] = e.target.value.split(':'); setSortKey(k as SortKey); setSortDir(d as 'asc' | 'desc'); }} className={selCls}>
                <option value="gasto:desc">Maior gasto</option>
                <option value="avaliacao:desc">Melhor avaliação</option>
                <option value="recente:desc">Mais recentes</option>
                <option value="nome:asc">Nome (A–Z)</option>
              </select>
            </div>

            {filtrados.length === 0 ? (
              <p className="py-12 text-center text-sm text-ink-muted">{temFiltro ? 'Nenhum fornecedor corresponde aos filtros.' : 'Nenhum fornecedor ativo.'}</p>
            ) : (
              <>
                {/* Desktop: tabela */}
                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-black/[0.06] text-left text-xs text-ink-muted">
                        <th className="pb-2 font-semibold">Fornecedor</th>
                        <th className="pb-2 font-semibold">Categoria</th>
                        <th className="pb-2 font-semibold">Cidade</th>
                        <th className="pb-2 font-semibold">Homologação</th>
                        <th className="pb-2 font-semibold">Avaliação</th>
                        <th className="pb-2 text-right font-semibold">Gasto no ano</th>
                        <th className="w-10 pb-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {pageItems.map(({ f, gasto, docsVencidos }) => {
                        const wa = waLink(f.whatsapp || f.telefone);
                        return (
                          <tr key={f.id} onClick={() => router.push(`/painel/fornecedores/${f.id}`)} className="group cursor-pointer border-b border-black/[0.04] last:border-0 hover:bg-black/[0.015]">
                            <td className="py-2.5">
                              <div className="flex items-center gap-2.5">
                                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white" style={{ background: catCor(f.categoria) }}>{iniciais(f.fantasia || f.nome)}</span>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <span className="truncate font-semibold text-ink">{f.fantasia || f.nome}</span>
                                    {!f.ativo && <span className="rounded bg-black/[0.05] px-1 py-0.5 text-[0.6rem] font-bold uppercase text-ink-muted">inativo</span>}
                                    {docsVencidos > 0 && <span title="Documentos vencidos" className="rounded-full bg-red-50 px-1.5 py-0.5 text-[0.6rem] font-bold text-red-600">{docsVencidos} doc</span>}
                                  </div>
                                  {f.fantasia && <div className="truncate text-xs text-ink-muted">{f.nome}</div>}
                                </div>
                              </div>
                            </td>
                            <td className="py-2.5"><span className="inline-flex items-center gap-1.5 text-ink-soft"><span className="h-2 w-2 rounded-full" style={{ background: catCor(f.categoria) }} />{catLabel(f.categoria)}</span></td>
                            <td className="py-2.5 text-ink-muted">{f.cidade || '—'}{f.estado ? `/${f.estado}` : ''}</td>
                            <td className="py-2.5"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${HOMOLOG_BY[f.homologacao].cls}`}>{HOMOLOG_BY[f.homologacao].label}</span></td>
                            <td className="py-2.5"><Stars media={f.avaliacao_media} n={f.avaliacao_n} /></td>
                            <td className="py-2.5 text-right font-bold text-ink">{gasto.total > 0 ? formatMoney(gasto.total) : <span className="font-normal text-ink-muted">—</span>}</td>
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
                  {pageItems.map(({ f, gasto, docsVencidos }) => (
                    <button key={f.id} onClick={() => router.push(`/painel/fornecedores/${f.id}`)} className="block w-full rounded-xl border border-black/[0.06] p-3 text-left transition hover:border-brand/30">
                      <div className="flex items-start gap-2.5">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white" style={{ background: catCor(f.categoria) }}>{iniciais(f.fantasia || f.nome)}</span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="truncate font-semibold text-ink">{f.fantasia || f.nome}</span>
                            {docsVencidos > 0 && <span className="rounded-full bg-red-50 px-1.5 py-0.5 text-[0.6rem] font-bold text-red-600">{docsVencidos} doc</span>}
                          </div>
                          <div className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-muted">
                            <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: catCor(f.categoria) }} />{catLabel(f.categoria)}</span>
                            {f.cidade && <span>· {f.cidade}</span>}
                          </div>
                          <div className="mt-1"><Stars media={f.avaliacao_media} n={f.avaliacao_n} /></div>
                        </div>
                        <div className="shrink-0 text-right">
                          <div className="font-bold text-ink">{gasto.total > 0 ? formatMoneyShort(gasto.total) : '—'}</div>
                          <span className={`mt-0.5 inline-block rounded-full px-1.5 py-0.5 text-[0.6rem] font-semibold ${HOMOLOG_BY[f.homologacao].cls}`}>{HOMOLOG_BY[f.homologacao].label}</span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>

                {totalPages > 1 && (
                  <div className="mt-4 flex items-center justify-between text-xs text-ink-muted">
                    <span>{filtrados.length} fornecedor(es) · página {page + 1} de {totalPages}</span>
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

      {novo && userId && <NovoFornecedorModal userId={userId} existentes={fornecedores} onClose={() => setNovo(false)} onSaved={async (id) => { setNovo(false); if (id) router.push(`/painel/fornecedores/${id}`); else await carregar(userId); }} />}
      {importOpen && userId && <ImportModal userId={userId} existentes={fornecedores} onClose={() => setImportOpen(false)} onDone={async () => { setImportOpen(false); await carregar(userId); }} />}
    </div>
  );
}

// ── Empty state ────────────────────────────────────────────────────────────────
function EmptyFornecedores({ onNovo, onImport }: { onNovo: () => void; onImport: () => void }) {
  return (
    <div className="mt-6 rounded-2xl bg-white p-10 text-center shadow-card">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-50 text-brand"><IcoTruck size={30} /></div>
      <h2 className="text-lg font-bold text-ink">Sua rede de fornecedores começa aqui</h2>
      <p className="mx-auto mt-1 max-w-md text-sm text-ink-muted">Centralize buffet, som, segurança, decoração e locação: condições de pagamento, avaliação de desempenho, gasto por parceiro e documentos com alerta de vencimento.</p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
        <button onClick={onNovo} className="rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white hover:bg-brand-600">+ Adicionar primeiro fornecedor</button>
        <button onClick={onImport} className="rounded-xl border border-black/10 px-5 py-2.5 text-sm font-semibold text-ink-soft hover:border-brand/30 hover:text-brand">Importar de planilha (CSV)</button>
      </div>
    </div>
  );
}

// ── Modal: novo fornecedor ─────────────────────────────────────────────────────
function NovoFornecedorModal({ userId, existentes, onClose, onSaved }: { userId: string; existentes: Fornecedor[]; onClose: () => void; onSaved: (id?: string) => void }) {
  const toast = useToast();
  const [tipo, setTipo] = useState<'pf' | 'pj'>('pj');
  const [nome, setNome] = useState(''); const [fantasia, setFantasia] = useState(''); const [doc, setDoc] = useState('');
  const [categoria, setCategoria] = useState('buffet'); const [contato, setContato] = useState('');
  const [email, setEmail] = useState(''); const [telefone, setTelefone] = useState(''); const [whatsapp, setWhatsapp] = useState('');
  const [cidade, setCidade] = useState(''); const [estado, setEstado] = useState('');
  const [condicoes, setCondicoes] = useState(''); const [prazo, setPrazo] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onEsc); return () => document.removeEventListener('keydown', onEsc);
  }, [onClose]);

  async function salvar() {
    if (!nome.trim()) return;
    const dup = existentes.find((f) => chaveDedupe(f) === chaveDedupe({ doc, email, nome }));
    if (dup && !confirm(`Já existe "${dup.fantasia || dup.nome}" com o mesmo documento/e-mail/nome. Criar mesmo assim?`)) return;
    setSaving(true);
    const { data, error } = await sb.from('fornecedores').insert({
      usuario_id: userId, tipo, nome: nome.trim(), fantasia: fantasia.trim() || null, doc: doc.trim() || null,
      categoria, contato: contato.trim() || null, email: email.trim() || null, telefone: telefone.trim() || null,
      whatsapp: whatsapp.trim() || null, cidade: cidade.trim() || null, estado: estado.trim().toUpperCase().slice(0, 2) || null,
      condicoes_pagamento: condicoes.trim() || null, prazo_entrega_dias: prazo ? Number(prazo) : null,
    }).select('id').single();
    setSaving(false);
    if (error) { toast.error('Erro ao salvar fornecedor.'); return; }
    toast.success('Fornecedor cadastrado!'); onSaved(data?.id);
  }

  return (
    <Modal onClose={onClose} title="Novo fornecedor">
      <div className="space-y-4">
        <div className="flex gap-2">
          {(['pj', 'pf'] as const).map((t) => <button key={t} onClick={() => setTipo(t)} className={`flex-1 rounded-xl border px-3 py-2 text-sm font-semibold transition ${tipo === t ? 'border-brand bg-brand-50 text-brand' : 'border-black/10 text-ink-muted hover:border-black/20'}`}>{t === 'pj' ? 'Pessoa Jurídica' : 'Pessoa Física'}</button>)}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Campo label={tipo === 'pj' ? 'Razão social' : 'Nome'}><input className={inp} value={nome} onChange={(e) => setNome(e.target.value)} autoFocus placeholder="Ex: Sabor & Arte Buffet Ltda" /></Campo>
          <Campo label="Nome fantasia"><input className={inp} value={fantasia} onChange={(e) => setFantasia(e.target.value)} placeholder="Ex: Sabor & Arte" /></Campo>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Campo label={tipo === 'pj' ? 'CNPJ' : 'CPF'}><input className={inp} value={doc} onChange={(e) => setDoc(e.target.value)} placeholder={tipo === 'pj' ? '00.000.000/0000-00' : '000.000.000-00'} /></Campo>
          <Campo label="Categoria"><select className={inp} value={categoria} onChange={(e) => setCategoria(e.target.value)}>{CATEGORIAS.map((c) => <option key={c.v} value={c.v}>{c.label}</option>)}</select></Campo>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Campo label="Pessoa de contato"><input className={inp} value={contato} onChange={(e) => setContato(e.target.value)} placeholder="Ex: João (comercial)" /></Campo>
          <Campo label="E-mail"><input type="email" className={inp} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="contato@exemplo.com" /></Campo>
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
          <Campo label="Condições de pagamento"><input className={inp} value={condicoes} onChange={(e) => setCondicoes(e.target.value)} placeholder="Ex: 30/60/90 dias" /></Campo>
          <Campo label="Prazo de entrega (dias)"><input type="number" min={0} className={inp} value={prazo} onChange={(e) => setPrazo(e.target.value)} placeholder="Ex: 15" /></Campo>
        </div>
      </div>
      <div className="mt-6 flex items-center gap-3">
        <button onClick={salvar} disabled={saving || !nome.trim()} className="rounded-xl bg-brand px-6 py-3 text-sm font-bold text-white transition hover:bg-brand-600 disabled:opacity-60">{saving ? 'Salvando…' : 'Cadastrar fornecedor'}</button>
        <button onClick={onClose} className="ml-auto text-sm font-medium text-ink-muted hover:text-ink">Cancelar</button>
      </div>
    </Modal>
  );
}

// ── Modal: importar CSV ─────────────────────────────────────────────────────────
function ImportModal({ userId, existentes, onClose, onDone }: { userId: string; existentes: Fornecedor[]; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [preview, setPreview] = useState<ReturnType<typeof importFornecedoresCSV>>([]);
  const [novos, setNovos] = useState(0); const [dups, setDups] = useState(0);
  const [busy, setBusy] = useState(false); const [fileName, setFileName] = useState('');

  function onFile(file: File) {
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      const rows = importFornecedoresCSV(String(reader.result || ''));
      const existKeys = new Set(existentes.map((f) => chaveDedupe(f)));
      let nv = 0, dp = 0; const seen = new Set<string>();
      for (const r of rows) { const k = chaveDedupe(r); if (existKeys.has(k) || seen.has(k)) dp++; else { nv++; seen.add(k); } }
      setPreview(rows); setNovos(nv); setDups(dp);
    };
    reader.readAsText(file);
  }

  async function importar() {
    if (!preview.length) return;
    setBusy(true);
    const existKeys = new Set(existentes.map((f) => chaveDedupe(f)));
    const seen = new Set<string>();
    const payload = preview.filter((r) => { const k = chaveDedupe(r); if (existKeys.has(k) || seen.has(k)) return false; seen.add(k); return true; })
      .map((r) => ({ usuario_id: userId, tipo: r.tipo, nome: r.nome, fantasia: r.fantasia || null, doc: r.doc || null, categoria: r.categoria, email: r.email || null, telefone: r.telefone || null, cidade: r.cidade || null, estado: r.estado || null }));
    if (!payload.length) { setBusy(false); toast.info('Nada novo para importar (tudo já existe).'); return; }
    const { error } = await sb.from('fornecedores').insert(payload);
    setBusy(false);
    if (error) { toast.error('Erro ao importar.'); return; }
    toast.success(`${payload.length} fornecedor(es) importado(s).`); onDone();
  }

  return (
    <Modal onClose={onClose} title="Importar fornecedores (CSV)">
      <p className="mb-4 text-sm text-ink-muted">Arquivo com cabeçalho. Colunas reconhecidas: <code className="rounded bg-black/[0.04] px-1">nome</code>, <code className="rounded bg-black/[0.04] px-1">fantasia</code>, <code className="rounded bg-black/[0.04] px-1">doc</code>, <code className="rounded bg-black/[0.04] px-1">categoria</code>, <code className="rounded bg-black/[0.04] px-1">email</code>, <code className="rounded bg-black/[0.04] px-1">telefone</code>, <code className="rounded bg-black/[0.04] px-1">cidade</code>, <code className="rounded bg-black/[0.04] px-1">estado</code>. De-dupe por documento/e-mail.</p>
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
              <thead className="sticky top-0 bg-black/[0.02] text-ink-muted"><tr><th className="px-3 py-1.5 text-left font-semibold">Nome</th><th className="px-3 py-1.5 text-left font-semibold">Categoria</th><th className="px-3 py-1.5 text-left font-semibold">Cidade</th></tr></thead>
              <tbody>{preview.slice(0, 50).map((r, i) => <tr key={i} className="border-t border-black/[0.04]"><td className="px-3 py-1.5 text-ink-soft">{r.fantasia || r.nome}</td><td className="px-3 py-1.5 text-ink-muted">{catLabel(r.categoria)}</td><td className="px-3 py-1.5 text-ink-muted">{r.cidade || '—'}</td></tr>)}</tbody>
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

// ── UI helpers ────────────────────────────────────────────────────────────────
function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[10000] flex items-start justify-center overflow-y-auto bg-black/50 p-4" onClick={onClose}>
      <div className="relative my-8 w-full max-w-lg rounded-2xl bg-white p-6 shadow-pop" onClick={(e) => e.stopPropagation()}>
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

function Stars({ media, n, compact }: { media: number; n: number; compact?: boolean }) {
  if (!n) return <span className="text-xs text-ink-muted">sem avaliação</span>;
  const full = Math.round(media);
  return (
    <span className="inline-flex items-center gap-1 text-xs">
      <span className="text-amber-500">{'★'.repeat(full)}<span className="text-black/15">{'★'.repeat(5 - full)}</span></span>
      <span className="font-semibold text-ink-soft">{media.toFixed(1)}</span>
      {!compact && <span className="text-ink-muted">({n})</span>}
    </span>
  );
}

function Donut({ data }: { data: { label: string; value: number; cor: string }[] }) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1, top = data.slice(0, 9), r = 52, sw = 16, C = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="flex items-center gap-4">
      <svg width="128" height="128" viewBox="0 0 128 128" className="shrink-0 -rotate-90">
        <circle cx="64" cy="64" r={r} fill="none" stroke="#f1f5f9" strokeWidth={sw} />
        {top.map((d, i) => { const len = (d.value / total) * C; const el = <circle key={i} cx="64" cy="64" r={r} fill="none" stroke={d.cor} strokeWidth={sw} strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-offset} />; offset += len; return el; })}
      </svg>
      <div className="min-w-0 flex-1 space-y-1.5">
        {top.map((d, i) => <div key={i} className="flex items-center gap-2 text-xs"><span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: d.cor }} /><span className="min-w-0 flex-1 truncate text-ink-soft">{d.label}</span><span className="shrink-0 font-semibold text-ink-muted">{d.value}</span></div>)}
      </div>
    </div>
  );
}

// ── Ícones ──
const svg = (path: ReactNode, size = 15, sw = 1.8) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">{path}</svg>;
const IcoTruck = ({ size = 15 }: { size?: number }) => svg(<path d="M1 3h15v13H1zM16 8h4l3 3v5h-7M5.5 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm12 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" />, size);
const IcoShield = () => svg(<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10ZM9 12l2 2 4-4" />, 15);
const IcoWallet = () => svg(<path d="M3 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2H3Zm0 0v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2H5M16 13h.01" />, 15);
const IcoStar = () => svg(<path d="M12 2l3 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.9 21l1.2-6.8-5-4.9 6.9-1L12 2Z" />, 15);
const IcoTag = () => svg(<path d="M20.6 13.4 12 22l-9-9V3h10l7.6 7.6a2 2 0 0 1 0 2.8ZM7.5 7.5h.01" />, 15);
const IcoAlert = () => svg(<path d="M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />, 15);
const IcoSearch = () => svg(<path d="M21 21l-4.3-4.3M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16Z" />, 14);
const IcoDownload = () => svg(<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />, 13);
const IcoUpload = ({ size = 13 }: { size?: number }) => svg(<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 9l5-5 5 5M12 4v12" />, size);
