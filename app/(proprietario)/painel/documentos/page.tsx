'use client';

// Lista de documentos (/painel/documentos).
// Visão geral com contadores filtráveis, busca, ordenação e alertas.
// Cada card leva à página dedicada do documento (/painel/documentos/[id]).

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabaseAny as sb } from '@/lib/supabase';
import { formatDate } from '@/lib/format';
import {
  type Doc, type StatusKey, type SortKey, CATS, CAT_BY_V, STATUS_META, ORDEM_GRUPOS, GRUPO_LABEL,
  SORT_OPTIONS, statusDe, diasRestantes, diasLabel, validadePct, exportCsv,
} from './_lib';
import { CatIcon } from './_components/CatIcon';

export default function DocumentosPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [docs, setDocs] = useState<Doc[]>([]);

  const [catFiltro, setCatFiltro] = useState('todos');
  const [statusFiltro, setStatusFiltro] = useState<StatusKey | 'todos'>('todos');
  const [busca, setBusca] = useState('');
  const [sort, setSort] = useState<SortKey>('vencimento');

  const carregar = useCallback(async (uid: string) => {
    const { data, error } = await sb.from('documentos').select('*').eq('usuario_id', uid).order('vencimento', { ascending: true, nullsFirst: false });
    if (error) { setNeedsSetup(true); setDocs([]); return; }
    setNeedsSetup(false);
    setDocs((data || []) as Doc[]);
  }, []);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await sb.auth.getSession();
      if (!session) { setLoading(false); return; }
      await carregar(session.user.id);
      setLoading(false);
    })();
  }, [carregar]);

  const counts = useMemo(() => {
    const c = { emdia: 0, avencer: 0, vencido: 0, total: docs.length, comArquivo: 0 };
    docs.forEach((d) => {
      const s = statusDe(d.vencimento, d.dias_aviso);
      if (s === 'emdia') c.emdia++;
      else if (s === 'avencer') c.avencer++;
      else if (s === 'vencido') c.vencido++;
      if (d.arquivo_url) c.comArquivo++;
    });
    return c;
  }, [docs]);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    let list = docs.filter((d) => {
      if (catFiltro !== 'todos' && d.categoria !== catFiltro) return false;
      if (statusFiltro !== 'todos' && statusDe(d.vencimento, d.dias_aviso) !== statusFiltro) return false;
      if (q && !(`${d.nome} ${d.orgao || ''} ${d.numero || ''}`.toLowerCase().includes(q))) return false;
      return true;
    });
    list = [...list].sort((a, b) => {
      if (sort === 'nome') return a.nome.localeCompare(b.nome, 'pt-BR');
      if (sort === 'categoria') return a.categoria.localeCompare(b.categoria);
      if (sort === 'emissao') return (a.emissao || '').localeCompare(b.emissao || '');
      return (a.vencimento || '9999-99-99').localeCompare(b.vencimento || '9999-99-99');
    });
    return list;
  }, [docs, catFiltro, statusFiltro, busca, sort]);

  const grupos = useMemo(
    () => ORDEM_GRUPOS
      .map((g) => ({ g, items: filtrados.filter((d) => statusDe(d.vencimento, d.dias_aviso) === g) }))
      .filter((x) => x.items.length > 0),
    [filtrados],
  );

  const hasFilter = catFiltro !== 'todos' || statusFiltro !== 'todos' || !!busca;

  if (loading) return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="h-10 w-64 animate-pulse rounded-xl bg-black/[0.05]" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[...Array(4)].map((_, i) => <div key={i} className="h-24 animate-pulse rounded-2xl bg-black/[0.05]" />)}</div>
      <div className="h-10 animate-pulse rounded-xl bg-black/[0.05]" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">{[...Array(6)].map((_, i) => <div key={i} className="h-52 animate-pulse rounded-2xl bg-black/[0.05]" />)}</div>
    </div>
  );

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink sm:text-2xl">Documentos</h1>
          <p className="mt-0.5 text-sm text-ink-muted">Licenças, alvarás e seguros com arquivo, validade e guia de renovação.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => exportCsv(docs)} disabled={docs.length === 0} className="flex items-center gap-2 rounded-xl border border-black/10 bg-white px-4 py-2.5 text-sm font-semibold text-ink-soft shadow-sm transition hover:border-black/20 hover:text-ink disabled:opacity-40" title="Exportar CSV">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" /></svg>
            Exportar
          </button>
          <Link href="/painel/documentos/novo" className="rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-600">
            + Novo documento
          </Link>
        </div>
      </div>

      {needsSetup && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          A tabela <code>documentos</code> não está acessível. Verifique a migration no Supabase.
        </div>
      )}

      {/* Alert banner */}
      {(counts.vencido > 0 || counts.avencer > 0) && (
        <div className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-sm ${counts.vencido > 0 ? 'border-red-200 bg-red-50 text-red-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
          <span className="text-lg">⚠️</span>
          <div className="flex-1">
            {counts.vencido > 0
              ? <><strong>{counts.vencido} documento{counts.vencido > 1 ? 's' : ''} vencido{counts.vencido > 1 ? 's' : ''}.</strong> Regularize para evitar multas e interdição.</>
              : <><strong>{counts.avencer} documento{counts.avencer > 1 ? 's' : ''} vencendo.</strong> Providencie a renovação com antecedência.</>}
          </div>
          <button onClick={() => setStatusFiltro(counts.vencido > 0 ? 'vencido' : 'avencer')} className="shrink-0 rounded-lg px-3 py-1 text-xs font-bold underline-offset-2 hover:underline">
            Ver {counts.vencido > 0 ? 'vencidos' : 'a vencer'} →
          </button>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <ResumoCard label="Em dia" value={counts.emdia} color="text-emerald-600" active={statusFiltro === 'emdia'} onClick={() => setStatusFiltro(statusFiltro === 'emdia' ? 'todos' : 'emdia')} iconPath={<path d="M22 11.08V12a10 10 0 11-5.93-9.14M22 4L12 14.01l-3-3" />} />
        <ResumoCard label="A vencer" value={counts.avencer} color="text-amber-600" active={statusFiltro === 'avencer'} onClick={() => setStatusFiltro(statusFiltro === 'avencer' ? 'todos' : 'avencer')} iconPath={<><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></>} />
        <ResumoCard label="Vencidos" value={counts.vencido} color="text-red-600" active={statusFiltro === 'vencido'} onClick={() => setStatusFiltro(statusFiltro === 'vencido' ? 'todos' : 'vencido')} iconPath={<><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></>} />
        <ResumoCard label="Total" value={counts.total} color="text-ink" active={statusFiltro === 'todos'} onClick={() => setStatusFiltro('todos')} iconPath={<><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /></>} sub={`${counts.comArquivo} com arquivo`} />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        {[{ v: 'todos', label: 'Todos' }, ...CATS].map((c) => (
          <button key={c.v} onClick={() => setCatFiltro(c.v)} className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${catFiltro === c.v ? 'border-brand bg-brand-50 text-brand' : 'border-black/10 text-ink-muted hover:border-brand/40'}`}>
            {c.label}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar documento…" className="min-w-[180px] rounded-xl border border-black/10 px-3.5 py-2 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20" />
          <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className="rounded-xl border border-black/10 bg-white px-3.5 py-2 text-sm text-ink-soft focus:border-brand focus:outline-none">
            {SORT_OPTIONS.map((o) => <option key={o.v} value={o.v}>Ordenar: {o.label}</option>)}
          </select>
        </div>
      </div>

      {hasFilter && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-ink-muted">
          <span>Filtrando por:</span>
          {statusFiltro !== 'todos' && <FilterChip label={STATUS_META[statusFiltro].label} onRemove={() => setStatusFiltro('todos')} />}
          {catFiltro !== 'todos' && <FilterChip label={CAT_BY_V[catFiltro]?.label || catFiltro} onRemove={() => setCatFiltro('todos')} />}
          {busca && <FilterChip label={`"${busca}"`} onRemove={() => setBusca('')} />}
          <button onClick={() => { setStatusFiltro('todos'); setCatFiltro('todos'); setBusca(''); }} className="ml-1 font-semibold text-brand hover:underline">Limpar tudo</button>
        </div>
      )}

      {/* List */}
      {grupos.length === 0 ? (
        <EmptyState hasFilter={hasFilter} onNew={() => router.push('/painel/documentos/novo')} />
      ) : (
        <div className="space-y-8">
          {grupos.map(({ g, items }) => (
            <div key={g}>
              <div className="mb-3 flex items-center gap-3">
                <h3 className="text-sm font-bold" style={{ color: STATUS_META[g].color }}>{GRUPO_LABEL[g]}</h3>
                <div className="h-px flex-1 bg-black/[0.06]" />
                <span className="text-xs font-semibold text-ink-muted">{items.length}</span>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((d) => <DocCard key={d.id} doc={d} />)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────
function ResumoCard({ label, value, color, active, onClick, iconPath, sub }: {
  label: string; value: number; color: string; active: boolean; onClick: () => void; iconPath: React.ReactNode; sub?: string;
}) {
  return (
    <button onClick={onClick} className={`rounded-2xl bg-white p-4 text-left shadow-card transition hover:shadow-md ${active ? 'ring-2 ring-brand ring-offset-1' : ''}`}>
      <div className="flex items-start justify-between">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-5 w-5 text-ink-muted">{iconPath}</svg>
        {active && <span className="rounded-full bg-brand px-2 py-0.5 text-[10px] font-bold text-white">Ativo</span>}
      </div>
      <div className={`mt-2 text-2xl font-bold ${color}`}>{value}</div>
      <div className="text-xs text-ink-muted">{label}</div>
      {sub && <div className="mt-0.5 text-[11px] text-ink-muted/70">{sub}</div>}
    </button>
  );
}

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="flex items-center gap-1 rounded-full border border-brand/30 bg-brand-50 px-2.5 py-0.5 text-xs font-semibold text-brand">
      {label}
      <button onClick={onRemove} className="ml-0.5 text-brand/60 hover:text-brand">✕</button>
    </span>
  );
}

function EmptyState({ hasFilter, onNew }: { hasFilter: boolean; onNew: () => void }) {
  return (
    <div className="rounded-2xl bg-white p-12 text-center shadow-card">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.2} className="mx-auto h-12 w-12 text-black/20">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
      </svg>
      <h3 className="mt-4 font-bold text-ink">{hasFilter ? 'Nenhum documento com esse filtro' : 'Nenhum documento ainda'}</h3>
      <p className="mt-1.5 text-sm text-ink-muted">{hasFilter ? 'Tente ajustar ou limpar os filtros.' : 'Cadastre licenças, alvarás e seguros com arquivo e lembrete de vencimento.'}</p>
      {!hasFilter && <button onClick={onNew} className="mt-5 rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-600">+ Novo documento</button>}
    </div>
  );
}

function DocCard({ doc }: { doc: Doc }) {
  const cat = CAT_BY_V[doc.categoria] || CAT_BY_V.outros;
  const status = statusDe(doc.vencimento, doc.dias_aviso);
  const meta = STATUS_META[status];
  const dias = diasRestantes(doc.vencimento);
  const pct = validadePct(doc.emissao, doc.vencimento);

  return (
    <Link href={`/painel/documentos/${doc.id}`} className="group block overflow-hidden rounded-2xl bg-white shadow-card transition hover:shadow-md hover:-translate-y-0.5">
      <div className="h-1" style={{ background: meta.color }} />
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" style={{ background: cat.bg }}>
            <CatIcon catV={doc.categoria} color={cat.color} />
          </div>
          <div className="flex items-center gap-1.5">
            {doc.arquivo_url && (
              <span className="flex items-center gap-0.5 rounded-full bg-black/[0.04] px-2 py-0.5 text-[10px] font-semibold text-ink-muted" title="Arquivo anexado">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3 w-3"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" /></svg>
                PDF
              </span>
            )}
            <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${meta.bgCls}`}>{meta.label}</span>
          </div>
        </div>

        <div className="mt-3 font-bold leading-snug text-ink group-hover:text-brand">{doc.nome}</div>
        <div className="text-xs text-ink-muted">{cat.label}{doc.orgao ? ` · ${doc.orgao}` : ''}</div>

        <dl className="mt-3 space-y-1 text-xs">
          <Linha t="Número" v={doc.numero || '—'} />
          <Linha t="Emissão" v={doc.emissao ? formatDate(doc.emissao, { style: 'short' }) : '—'} />
          <Linha t="Vencimento" v={doc.vencimento ? formatDate(doc.vencimento, { style: 'short' }) : 'Não vence'} vc={meta.color} />
        </dl>

        {doc.vencimento && (
          <div className="mt-3">
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="text-ink-muted">Validade</span>
              <span className="font-semibold" style={{ color: meta.color }}>{diasLabel(dias)}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-black/[0.06]">
              <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: meta.color }} />
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between border-t border-black/[0.06] px-4 py-2.5 text-xs font-semibold text-ink-muted group-hover:text-brand">
        <span>Ver detalhes</span>
        <span>→</span>
      </div>
    </Link>
  );
}

function Linha({ t, v, vc }: { t: string; v: string; vc?: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="shrink-0 text-ink-muted">{t}</dt>
      <dd className="truncate font-semibold text-ink-soft" style={vc ? { color: vc } : undefined}>{v}</dd>
    </div>
  );
}
