'use client';

// Ativos & Bens (patrimônio) — /painel/ativos.
// Inventário do que a empresa POSSUI: imóveis, móveis, equipamentos de
// som/luz/cozinha, mobiliário, veículos, estruturas (tendas/palcos) e TI.
// PILARES: KPIs (valor de aquisição · depreciação acumulada · valor contábil ·
//   itens em manutenção · garantias/seguros a vencer) · patrimônio por categoria
//   (donut) · concentração por propriedade/local · lista filtrável · novo ·
//   exportar. A matemática de DEPRECIAÇÃO LINEAR vem do motor puro lib/ativos.ts.
// Fonte: ativos, ativos_manutencao (OS abertas/custo), propriedades (local).
// Sem "R$" hardcoded — tudo via lib/format.

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { supabase as sb } from '@/lib/supabase';
import { formatMoney, formatMoneyShort, formatNumber, formatPercent } from '@/lib/format';
import { useToast } from '@/components/Toast';
import {
  type Ativo, type AtivoManutencao, type PropriedadeLite, type Categoria, type Estado,
  type Depreciacao, type VencStatus,
  CATEGORIAS, CAT_BY, catLabel, catCor, catIcon, ESTADOS, ESTADO_BY, VIDA_UTIL_PADRAO,
  iniciais, ymd, exportAtivosCSV, type LinhaExport,
  depreciar, resumoPatrimonio, statusVencimento, custoManutencao, manutencaoAbertas,
} from './_lib';

// ── Constantes ────────────────────────────────────────────────────────────────
const PAGE_SIZE = 20;
const inp = 'w-full rounded-xl border border-black/10 bg-white px-3.5 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20';
const selCls = 'rounded-xl border border-black/10 bg-white px-3 py-2 text-sm focus:border-brand focus:outline-none';
// Paleta para barras por propriedade (propriedade não tem cor fixa).
const PALETTE = ['#ff385c', '#1a73e8', '#8b5cf6', '#f97316', '#10b981', '#0ea5e9', '#eab308', '#ec4899', '#14b8a6', '#64748b'];

type SortKey = 'valor' | 'aquisicao' | 'depreciacao' | 'nome' | 'recente';
type Row = {
  a: Ativo; dep: Depreciacao; manutAbertas: number; custoManut: number;
  propNome: string; vencGarantia: VencStatus; vencSeguro: VencStatus;
};

// ── Página ────────────────────────────────────────────────────────────────────
export default function AtivosPage() {
  const router = useRouter();
  const nowMs = useMemo(() => Date.now(), []);

  const [loading, setLoading] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  const [ativos, setAtivos] = useState<Ativo[]>([]);
  const [manuts, setManuts] = useState<Pick<AtivoManutencao, 'ativo_id' | 'status' | 'custo_num'>[]>([]);
  const [props, setProps] = useState<PropriedadeLite[]>([]);

  // filtros / ordenação / paginação
  const [busca, setBusca] = useState('');
  const [fCat, setFCat] = useState('');
  const [fProp, setFProp] = useState('');
  const [fEstado, setFEstado] = useState('');
  const [fSituacao, setFSituacao] = useState<'uso' | 'baixado' | ''>('uso');
  const [sortKey, setSortKey] = useState<SortKey>('valor');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(0);

  const [novo, setNovo] = useState(false);

  const carregar = useCallback(async (uid: string) => {
    const aRes = await sb.from('ativos').select('*').eq('usuario_id', uid).order('criado_em', { ascending: false });
    // Tabela ainda não criada: Postgres cru responde 42P01; via PostgREST vem
    // PGRST205 (404, "Could not find the table"). Trata os dois.
    if (aRes.error && (aRes.error.code === '42P01' || aRes.error.code === 'PGRST205')) { setNeedsSetup(true); setAtivos([]); return; }
    setNeedsSetup(false);
    setAtivos(((aRes.data || []) as Ativo[]).map(normalizaAtivo));
    const [mRes, pRes] = await Promise.all([
      sb.from('ativos_manutencao').select('ativo_id,status,custo_num').eq('usuario_id', uid),
      sb.from('propriedades').select('id,nome,cidade').eq('usuario_id', uid),
    ]);
    setManuts(mRes.error ? [] : (mRes.data || []).map((m) => ({ ...m, custo_num: Number(m.custo_num) || 0 })) as Pick<AtivoManutencao, 'ativo_id' | 'status' | 'custo_num'>[]);
    setProps(pRes.error ? [] : (pRes.data || []) as PropriedadeLite[]);
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

  useEffect(() => { setPage(0); }, [busca, fCat, fProp, fEstado, fSituacao]);

  // ── Agregações por ativo ──
  const propMap = useMemo(() => new Map(props.map((p) => [Number(p.id), p])), [props]);
  const manutMap = useMemo(() => {
    const m = new Map<string, { abertas: number; custo: number }>();
    const byAtivo = new Map<string, typeof manuts>();
    for (const x of manuts) { const arr = byAtivo.get(x.ativo_id) || []; arr.push(x); byAtivo.set(x.ativo_id, arr); }
    for (const [aid, arr] of byAtivo) m.set(aid, { abertas: manutencaoAbertas(arr), custo: custoManutencao(arr) });
    return m;
  }, [manuts]);

  const rows = useMemo<Row[]>(() => ativos.map((a) => {
    const dep = depreciar(a, nowMs);
    const mm = manutMap.get(a.id) || { abertas: 0, custo: 0 };
    const prop = a.propriedade_id != null ? propMap.get(Number(a.propriedade_id)) : undefined;
    return {
      a, dep, manutAbertas: mm.abertas, custoManut: mm.custo,
      propNome: prop?.nome || (a.propriedade_id != null ? `Propriedade #${a.propriedade_id}` : ''),
      vencGarantia: statusVencimento(a.garantia_ate, nowMs),
      vencSeguro: statusVencimento(a.seguro_ate, nowMs),
    };
  }), [ativos, manutMap, propMap, nowMs]);

  // ── KPIs ──
  const kpis = useMemo(() => {
    const resumo = resumoPatrimonio(ativos, nowMs);
    const emManutencao = rows.filter((r) => r.manutAbertas > 0);
    const osAbertas = rows.reduce((s, r) => s + r.manutAbertas, 0);
    const vencendo = rows.filter((r) => !r.a.baixado_em && (
      r.vencGarantia === 'vencido' || r.vencGarantia === 'avencer' ||
      r.vencSeguro === 'vencido' || r.vencSeguro === 'avencer'));
    const venc = rows.filter((r) => !r.a.baixado_em && (r.vencGarantia === 'vencido' || r.vencSeguro === 'vencido')).length;
    const pctDeprec = resumo.aquisicaoTotal > 0 ? resumo.depreciacaoAcumulada / resumo.aquisicaoTotal : 0;
    return { ...resumo, emManutencao: emManutencao.length, osAbertas, vencendo: vencendo.length, venc, pctDeprec };
  }, [ativos, rows, nowMs]);

  // ── Patrimônio por categoria (donut, valor contábil) ──
  const catDist = useMemo(() => {
    const m = new Map<string, { n: number; valor: number }>();
    rows.filter((r) => !r.a.baixado_em).forEach((r) => {
      const k = r.a.categoria || 'outro';
      const e = m.get(k) || { n: 0, valor: 0 };
      e.n++; e.valor += r.dep.valorContabil; m.set(k, e);
    });
    return [...m.entries()].map(([v, e]) => ({ v, label: catLabel(v), cor: catCor(v), ...e })).sort((a, b) => b.valor - a.valor);
  }, [rows]);

  // ── Concentração por propriedade/local (valor contábil) ──
  const propDist = useMemo(() => {
    const m = new Map<string, { valor: number; n: number }>();
    rows.filter((r) => !r.a.baixado_em).forEach((r) => {
      const k = r.propNome || 'Sem propriedade';
      const e = m.get(k) || { valor: 0, n: 0 };
      e.valor += r.dep.valorContabil; e.n++; m.set(k, e);
    });
    return [...m.entries()].map(([label, e], i) => ({ label, cor: PALETTE[i % PALETTE.length], ...e })).sort((a, b) => b.valor - a.valor).slice(0, 8);
  }, [rows]);

  // ── Lista filtrada/ordenada/paginada ──
  const filtrados = useMemo(() => {
    let arr = rows;
    const q = busca.trim().toLowerCase();
    if (q) arr = arr.filter(({ a }) => `${a.nome} ${a.codigo || ''} ${a.marca || ''} ${a.modelo || ''} ${a.num_serie || ''} ${a.localizacao || ''} ${a.responsavel || ''} ${a.placa || ''}`.toLowerCase().includes(q));
    if (fCat) arr = arr.filter(({ a }) => a.categoria === fCat);
    if (fProp) arr = arr.filter(({ a }) => String(a.propriedade_id ?? '') === fProp);
    if (fEstado) arr = arr.filter(({ a }) => a.estado === fEstado);
    if (fSituacao === 'uso') arr = arr.filter(({ a }) => !a.baixado_em);
    else if (fSituacao === 'baixado') arr = arr.filter(({ a }) => !!a.baixado_em);
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...arr].sort((x, y) => {
      if (sortKey === 'nome') return x.a.nome.localeCompare(y.a.nome) * dir;
      if (sortKey === 'aquisicao') return (x.a.valor_aquisicao_num - y.a.valor_aquisicao_num) * dir;
      if (sortKey === 'depreciacao') return (x.dep.percentual - y.dep.percentual) * dir;
      if (sortKey === 'recente') return (x.a.criado_em || '').localeCompare(y.a.criado_em || '') * dir;
      return (x.dep.valorContabil - y.dep.valorContabil) * dir;
    });
  }, [rows, busca, fCat, fProp, fEstado, fSituacao, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtrados.length / PAGE_SIZE));
  const pageItems = filtrados.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
  const temFiltro = !!(busca || fCat || fProp || fEstado || fSituacao !== 'uso');

  const exportar = useCallback(() => {
    const linhas: LinhaExport[] = filtrados.map((r) => ({ a: r.a, valorContabil: r.dep.valorContabil, acumulada: r.dep.acumulada, propriedade: r.propNome }));
    exportAtivosCSV(linhas);
  }, [filtrados]);

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
          <h1 className="text-xl font-bold text-ink sm:text-2xl">Ativos &amp; Bens</h1>
          <p className="mt-1 text-sm text-ink-muted">Patrimônio da empresa — imóveis, móveis, equipamentos, veículos e estruturas — com depreciação, localização, garantia e manutenção.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {filtrados.length > 0 && <button onClick={exportar} className="flex items-center gap-1.5 rounded-xl border border-black/10 px-3 py-2.5 text-sm text-ink-muted hover:border-brand/30 hover:text-brand"><IcoDownload /> Exportar</button>}
          <button onClick={() => setNovo(true)} className="rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-600">+ Novo ativo</button>
        </div>
      </div>

      {needsSetup && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          O inventário de patrimônio ainda não foi criado. Rode a migration <code className="rounded bg-amber-100 px-1 py-0.5">docs/sql/ativos.sql</code> no Supabase para ativar o módulo.
        </div>
      )}

      {!needsSetup && ativos.length === 0 ? (
        <EmptyAtivos onNovo={() => setNovo(true)} />
      ) : !needsSetup && (
        <>
          {/* KPIs */}
          <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
            <Kpi label="Valor de aquisição" value={formatMoneyShort(kpis.aquisicaoTotal)} sub="patrimônio bruto" tone="ink" icon={<IcoBox />} />
            <Kpi label="Depreciação acum." value={formatMoneyShort(kpis.depreciacaoAcumulada)} sub={formatPercent(kpis.pctDeprec)} tone="vermelho" icon={<IcoTrendDown />} />
            <Kpi label="Valor contábil" value={formatMoneyShort(kpis.valorContabil)} sub="valor atual" tone="gold" icon={<IcoWallet />} />
            <Kpi label="Itens" value={formatNumber(kpis.qtd)} sub={kpis.baixados ? `${kpis.baixados} baixado(s)` : 'em uso'} tone="brand" icon={<IcoTag />} />
            <Kpi label="Em manutenção" value={formatNumber(kpis.emManutencao)} sub={kpis.osAbertas ? `${kpis.osAbertas} OS aberta(s)` : 'tudo ok'} tone={kpis.emManutencao ? 'azul' : 'ink'} icon={<IcoWrench />} />
            <Kpi label="Garantia/seguro" value={formatNumber(kpis.vencendo)} sub={kpis.venc ? `${kpis.venc} vencido(s)` : 'a vencer'} tone={kpis.venc ? 'vermelho' : kpis.vencendo ? 'gold' : 'verde'} icon={<IcoShield />} />
          </div>

          {/* Categoria (donut) + Propriedade (barras) */}
          <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-[320px_1fr]">
            <div className="rounded-2xl bg-white p-5 shadow-card">
              <h3 className="mb-1 text-base font-bold text-ink">Patrimônio por categoria</h3>
              <p className="mb-4 text-xs text-ink-muted">Valor contábil atual (após depreciação).</p>
              {catDist.length === 0 ? (
                <div className="flex h-[180px] items-center justify-center text-center"><p className="text-sm text-ink-muted">Cadastre ativos para ver a distribuição.</p></div>
              ) : <Donut data={catDist.map((c) => ({ label: c.label, value: c.valor, cor: c.cor, n: c.n }))} />}
            </div>
            <div className="rounded-2xl bg-white p-5 shadow-card">
              <h3 className="mb-1 text-base font-bold text-ink">Concentração por propriedade</h3>
              <p className="mb-4 text-xs text-ink-muted">Onde está o patrimônio (valor contábil por local).</p>
              {propDist.length === 0 ? (
                <p className="py-10 text-center text-sm text-ink-muted">Vincule ativos a propriedades para ver onde estão.</p>
              ) : (
                <div className="space-y-2.5">
                  {propDist.map((p) => {
                    const max = propDist[0].valor || 1;
                    return (
                      <div key={p.label}>
                        <div className="mb-1 flex items-center justify-between text-xs">
                          <span className="truncate text-ink-soft">{p.label} <span className="text-ink-muted">· {p.n}</span></span>
                          <span className="shrink-0 font-semibold text-ink">{formatMoneyShort(p.valor)}</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-black/[0.05]"><div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.max(3, (p.valor / max) * 100)}%`, background: p.cor }} /></div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Lista */}
          <div className="mt-5 rounded-2xl bg-white p-5 shadow-card">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <div className="relative min-w-[180px] flex-1">
                <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-muted"><IcoSearch /></span>
                <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar nome, código, série, placa, local…" className="w-full rounded-xl border border-black/10 py-2 pl-8 pr-3 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20" />
              </div>
              <select value={fCat} onChange={(e) => setFCat(e.target.value)} className={selCls}>
                <option value="">Categoria</option>
                {CATEGORIAS.map((c) => <option key={c.v} value={c.v}>{c.label}</option>)}
              </select>
              {props.length > 0 && (
                <select value={fProp} onChange={(e) => setFProp(e.target.value)} className={selCls}>
                  <option value="">Propriedade</option>
                  {props.map((p) => <option key={p.id} value={String(p.id)}>{p.nome || `Propriedade #${p.id}`}</option>)}
                </select>
              )}
              <select value={fEstado} onChange={(e) => setFEstado(e.target.value)} className={selCls}>
                <option value="">Estado</option>
                {ESTADOS.map((e) => <option key={e.v} value={e.v}>{e.label}</option>)}
              </select>
              <select value={fSituacao} onChange={(e) => setFSituacao(e.target.value as 'uso' | 'baixado' | '')} className={selCls}>
                <option value="uso">Em uso</option>
                <option value="baixado">Baixados</option>
                <option value="">Todos</option>
              </select>
              <select value={`${sortKey}:${sortDir}`} onChange={(e) => { const [k, d] = e.target.value.split(':'); setSortKey(k as SortKey); setSortDir(d as 'asc' | 'desc'); }} className={selCls}>
                <option value="valor:desc">Maior valor contábil</option>
                <option value="aquisicao:desc">Maior aquisição</option>
                <option value="depreciacao:desc">Mais depreciado</option>
                <option value="recente:desc">Mais recentes</option>
                <option value="nome:asc">Nome (A–Z)</option>
              </select>
            </div>

            {filtrados.length === 0 ? (
              <p className="py-12 text-center text-sm text-ink-muted">{temFiltro ? 'Nenhum ativo corresponde aos filtros.' : 'Nenhum ativo nesta situação.'}</p>
            ) : (
              <>
                {/* Desktop: tabela */}
                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-black/[0.06] text-left text-xs text-ink-muted">
                        <th className="pb-2 font-semibold">Ativo</th>
                        <th className="pb-2 font-semibold">Categoria</th>
                        <th className="pb-2 font-semibold">Localização</th>
                        <th className="pb-2 font-semibold">Estado</th>
                        <th className="pb-2 text-right font-semibold">Aquisição</th>
                        <th className="pb-2 text-right font-semibold">Valor contábil</th>
                        <th className="w-28 pb-2 font-semibold">Depreciação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pageItems.map((r) => <RowDesktop key={r.a.id} r={r} onClick={() => router.push(`/painel/ativos/${r.a.id}`)} />)}
                    </tbody>
                  </table>
                </div>

                {/* Mobile: cards */}
                <div className="space-y-2.5 md:hidden">
                  {pageItems.map((r) => <RowMobile key={r.a.id} r={r} onClick={() => router.push(`/painel/ativos/${r.a.id}`)} />)}
                </div>

                {totalPages > 1 && (
                  <div className="mt-4 flex items-center justify-between text-xs text-ink-muted">
                    <span>{filtrados.length} ativo(s) · página {page + 1} de {totalPages}</span>
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

      {novo && userId && <NovoAtivoModal userId={userId} props={props} onClose={() => setNovo(false)} onSaved={async (id) => { setNovo(false); if (id) router.push(`/painel/ativos/${id}`); else await carregar(userId); }} />}
    </div>
  );
}

// Normaliza números vindos como string do PostgREST.
function normalizaAtivo(a: Ativo): Ativo {
  return {
    ...a,
    valor_aquisicao_num: Number(a.valor_aquisicao_num) || 0,
    valor_residual_num: Number(a.valor_residual_num) || 0,
    vida_util_meses: a.vida_util_meses == null ? null : Number(a.vida_util_meses),
    valor_baixa_num: a.valor_baixa_num == null ? null : Number(a.valor_baixa_num),
    propriedade_id: a.propriedade_id == null ? null : Number(a.propriedade_id),
    ano_fabricacao: a.ano_fabricacao == null ? null : Number(a.ano_fabricacao),
  };
}

// ── Linha (desktop) ─────────────────────────────────────────────────────────────
function RowDesktop({ r, onClick }: { r: Row; onClick: () => void }) {
  const { a, dep } = r;
  return (
    <tr onClick={onClick} className="group cursor-pointer border-b border-black/[0.04] last:border-0 hover:bg-black/[0.015]">
      <td className="py-2.5">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-base" style={{ background: catCor(a.categoria) + '22' }}>{catIcon(a.categoria)}</span>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="truncate font-semibold text-ink">{a.nome}</span>
              {a.baixado_em && <span className="rounded bg-black/[0.05] px-1 py-0.5 text-[0.6rem] font-bold uppercase text-ink-muted">baixado</span>}
              {r.manutAbertas > 0 && <span title="Em manutenção" className="rounded-full bg-sky-50 px-1.5 py-0.5 text-[0.6rem] font-bold text-sky-600">🔧 {r.manutAbertas}</span>}
              {(r.vencGarantia === 'vencido' || r.vencSeguro === 'vencido') && !a.baixado_em && <span title="Garantia/seguro vencido" className="rounded-full bg-red-50 px-1.5 py-0.5 text-[0.6rem] font-bold text-red-600">!</span>}
            </div>
            <div className="truncate text-xs text-ink-muted">{a.codigo ? `#${a.codigo}` : ''}{a.codigo && (a.marca || a.modelo) ? ' · ' : ''}{[a.marca, a.modelo].filter(Boolean).join(' ')}</div>
          </div>
        </div>
      </td>
      <td className="py-2.5"><span className="inline-flex items-center gap-1.5 text-ink-soft"><span className="h-2 w-2 rounded-full" style={{ background: catCor(a.categoria) }} />{catLabel(a.categoria)}</span></td>
      <td className="py-2.5 text-ink-muted">{r.propNome || a.localizacao || '—'}{r.propNome && a.localizacao ? ` · ${a.localizacao}` : ''}</td>
      <td className="py-2.5"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${ESTADO_BY[a.estado]?.cls || 'bg-black/[0.04] text-ink-muted'}`}>{ESTADO_BY[a.estado]?.label || a.estado}</span></td>
      <td className="py-2.5 text-right text-ink-soft">{a.valor_aquisicao_num > 0 ? formatMoney(a.valor_aquisicao_num) : '—'}</td>
      <td className="py-2.5 text-right font-bold text-ink">{formatMoney(dep.valorContabil)}</td>
      <td className="py-2.5">
        {dep.deprecia ? <DepBar pct={dep.percentual} /> : <span className="text-xs text-ink-muted">não deprecia</span>}
      </td>
    </tr>
  );
}

// ── Card (mobile) ────────────────────────────────────────────────────────────────
function RowMobile({ r, onClick }: { r: Row; onClick: () => void }) {
  const { a, dep } = r;
  return (
    <button onClick={onClick} className="block w-full rounded-xl border border-black/[0.06] p-3 text-left transition hover:border-brand/30">
      <div className="flex items-start gap-2.5">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg" style={{ background: catCor(a.categoria) + '22' }}>{catIcon(a.categoria)}</span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate font-semibold text-ink">{a.nome}</span>
            {a.baixado_em && <span className="rounded bg-black/[0.05] px-1 py-0.5 text-[0.6rem] font-bold uppercase text-ink-muted">baixado</span>}
            {r.manutAbertas > 0 && <span className="rounded-full bg-sky-50 px-1.5 py-0.5 text-[0.6rem] font-bold text-sky-600">🔧 {r.manutAbertas}</span>}
          </div>
          <div className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-muted">
            <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: catCor(a.categoria) }} />{catLabel(a.categoria)}</span>
            {(r.propNome || a.localizacao) && <span>· {r.propNome || a.localizacao}</span>}
          </div>
          {dep.deprecia && <div className="mt-1.5"><DepBar pct={dep.percentual} /></div>}
        </div>
        <div className="shrink-0 text-right">
          <div className="font-bold text-ink">{formatMoneyShort(dep.valorContabil)}</div>
          <span className={`mt-0.5 inline-block rounded-full px-1.5 py-0.5 text-[0.6rem] font-semibold ${ESTADO_BY[a.estado]?.cls || 'bg-black/[0.04] text-ink-muted'}`}>{ESTADO_BY[a.estado]?.label || a.estado}</span>
        </div>
      </div>
    </button>
  );
}

function DepBar({ pct }: { pct: number }) {
  const p = Math.round(pct * 100);
  return (
    <div className="flex items-center gap-1.5">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-black/[0.06]"><div className="h-full rounded-full bg-amber-400" style={{ width: `${p}%` }} /></div>
      <span className="text-[0.68rem] text-ink-muted">{p}%</span>
    </div>
  );
}

// ── Empty state ────────────────────────────────────────────────────────────────
function EmptyAtivos({ onNovo }: { onNovo: () => void }) {
  return (
    <div className="mt-6 rounded-2xl bg-white p-10 text-center shadow-card">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-50 text-brand"><IcoBox size={30} /></div>
      <h2 className="text-lg font-bold text-ink">Seu inventário de patrimônio começa aqui</h2>
      <p className="mx-auto mt-1 max-w-md text-sm text-ink-muted">Cadastre imóveis, móveis, equipamentos, veículos e estruturas: saiba o valor contábil (com depreciação), onde cada bem está, garantia, seguro e histórico de manutenção.</p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
        <button onClick={onNovo} className="rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white hover:bg-brand-600">+ Adicionar primeiro ativo</button>
      </div>
    </div>
  );
}

// ── Modal: novo ativo ──────────────────────────────────────────────────────────
function NovoAtivoModal({ userId, props, onClose, onSaved }: { userId: string; props: PropriedadeLite[]; onClose: () => void; onSaved: (id?: string) => void }) {
  const toast = useToast();
  const [nome, setNome] = useState(''); const [codigo, setCodigo] = useState('');
  const [categoria, setCategoria] = useState<Categoria>('equipamento');
  const [propriedadeId, setPropriedadeId] = useState('');
  const [localizacao, setLocalizacao] = useState(''); const [responsavel, setResponsavel] = useState('');
  const [dataAquisicao, setDataAquisicao] = useState(ymd(new Date()));
  const [valorAquisicao, setValorAquisicao] = useState('');
  const [vidaUtil, setVidaUtil] = useState<string>(String(VIDA_UTIL_PADRAO.equipamento));
  const [vidaTocada, setVidaTocada] = useState(false);
  const [estado, setEstado] = useState<Estado>('bom');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onEsc); return () => document.removeEventListener('keydown', onEsc);
  }, [onClose]);

  // Ao trocar a categoria, sugere a vida útil (se o usuário ainda não editou).
  function trocarCategoria(c: Categoria) {
    setCategoria(c);
    if (!vidaTocada) setVidaUtil(String(VIDA_UTIL_PADRAO[c]));
  }

  async function salvar() {
    if (!nome.trim()) return;
    setSaving(true);
    const vida = vidaUtil ? Math.max(0, Math.trunc(Number(vidaUtil))) : null;
    const { data, error } = await sb.from('ativos').insert({
      usuario_id: userId, nome: nome.trim(), codigo: codigo.trim() || null, categoria,
      propriedade_id: propriedadeId ? Number(propriedadeId) : null, localizacao: localizacao.trim() || null,
      responsavel: responsavel.trim() || null, data_aquisicao: dataAquisicao || null,
      valor_aquisicao_num: Number(valorAquisicao) || 0, vida_util_meses: vida,
      metodo_deprec: vida && vida > 0 ? 'linear' : 'nenhum', estado,
    }).select('id').single();
    setSaving(false);
    if (error) { toast.error('Erro ao salvar o ativo.'); return; }
    toast.success('Ativo cadastrado!'); onSaved(data?.id);
  }

  const anos = vidaUtil && Number(vidaUtil) > 0 ? (Number(vidaUtil) / 12) : 0;

  return (
    <Modal onClose={onClose} title="Novo ativo">
      <div className="space-y-4">
        <div className="grid grid-cols-[1fr_140px] gap-4">
          <Campo label="Nome do bem"><input className={inp} value={nome} onChange={(e) => setNome(e.target.value)} autoFocus placeholder="Ex: Mesa de som Yamaha MG16XU" /></Campo>
          <Campo label="Código / Patrimônio"><input className={inp} value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="PAT-0001" /></Campo>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Campo label="Categoria"><select className={inp} value={categoria} onChange={(e) => trocarCategoria(e.target.value as Categoria)}>{CATEGORIAS.map((c) => <option key={c.v} value={c.v}>{c.icon} {c.label}</option>)}</select></Campo>
          <Campo label="Estado"><select className={inp} value={estado} onChange={(e) => setEstado(e.target.value as Estado)}>{ESTADOS.map((e) => <option key={e.v} value={e.v}>{e.label}</option>)}</select></Campo>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Campo label="Propriedade (onde fica)">
            <select className={inp} value={propriedadeId} onChange={(e) => setPropriedadeId(e.target.value)}>
              <option value="">— Sem propriedade —</option>
              {props.map((p) => <option key={p.id} value={String(p.id)}>{p.nome || `Propriedade #${p.id}`}</option>)}
            </select>
          </Campo>
          <Campo label="Localização (local)"><input className={inp} value={localizacao} onChange={(e) => setLocalizacao(e.target.value)} placeholder="Ex: Galpão A · prateleira 3" /></Campo>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Campo label="Data de aquisição"><input type="date" className={inp} value={dataAquisicao} onChange={(e) => setDataAquisicao(e.target.value)} /></Campo>
          <Campo label="Valor de aquisição"><input type="number" min={0} step="0.01" className={inp} value={valorAquisicao} onChange={(e) => setValorAquisicao(e.target.value)} placeholder="0,00" /></Campo>
        </div>
        <div className="grid grid-cols-[1fr_auto] items-end gap-4">
          <Campo label="Vida útil (meses · p/ depreciação)"><input type="number" min={0} className={inp} value={vidaUtil} onChange={(e) => { setVidaTocada(true); setVidaUtil(e.target.value); }} placeholder="0 = não deprecia" /></Campo>
          <div className="pb-2.5 text-xs text-ink-muted">{anos > 0 ? `≈ ${anos.toFixed(anos % 1 ? 1 : 0)} ano(s)` : 'não deprecia'}</div>
        </div>
        <Campo label="Responsável"><input className={inp} value={responsavel} onChange={(e) => setResponsavel(e.target.value)} placeholder="Quem responde pelo bem" /></Campo>
      </div>
      <div className="mt-6 flex items-center gap-3">
        <button onClick={salvar} disabled={saving || !nome.trim()} className="rounded-xl bg-brand px-6 py-3 text-sm font-bold text-white transition hover:bg-brand-600 disabled:opacity-60">{saving ? 'Salvando…' : 'Cadastrar ativo'}</button>
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

function Donut({ data }: { data: { label: string; value: number; cor: string; n: number }[] }) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1, top = data.slice(0, 9), r = 52, sw = 16, C = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="flex items-center gap-4">
      <svg width="128" height="128" viewBox="0 0 128 128" className="shrink-0 -rotate-90">
        <circle cx="64" cy="64" r={r} fill="none" stroke="#f1f5f9" strokeWidth={sw} />
        {top.map((d, i) => { const len = (d.value / total) * C; const el = <circle key={i} cx="64" cy="64" r={r} fill="none" stroke={d.cor} strokeWidth={sw} strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-offset} />; offset += len; return el; })}
      </svg>
      <div className="min-w-0 flex-1 space-y-1.5">
        {top.map((d, i) => <div key={i} className="flex items-center gap-2 text-xs"><span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: d.cor }} /><span className="min-w-0 flex-1 truncate text-ink-soft">{d.label} <span className="text-ink-muted">· {d.n}</span></span><span className="shrink-0 font-semibold text-ink-muted">{formatMoneyShort(d.value)}</span></div>)}
      </div>
    </div>
  );
}

// ── Ícones ──
const svg = (path: ReactNode, size = 15, sw = 1.8) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">{path}</svg>;
const IcoBox = ({ size = 15 }: { size?: number }) => svg(<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16ZM3.3 7l8.7 5 8.7-5M12 22V12" />, size);
const IcoWallet = () => svg(<path d="M3 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2H3Zm0 0v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2H5M16 13h.01" />, 15);
const IcoTrendDown = () => svg(<path d="M22 17 13.5 8.5l-5 5L2 7M16 17h6v-6" />, 15);
const IcoTag = () => svg(<path d="M20.59 13.41 12 22l-9-9V3h10l7.59 7.59a2 2 0 0 1 0 2.82ZM7.5 7.5h.01" />, 15);
const IcoWrench = () => svg(<path d="M14.7 6.3a4 4 0 0 0-5.4 5.3L3 18l3 3 6.4-6.3a4 4 0 0 0 5.3-5.4l-2.6 2.6-2.3-2.3 2.6-2.6Z" />, 15);
const IcoShield = () => svg(<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10ZM9 12l2 2 4-4" />, 15);
const IcoSearch = () => svg(<path d="M21 21l-4.3-4.3M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16Z" />, 14);
const IcoDownload = () => svg(<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />, 13);
