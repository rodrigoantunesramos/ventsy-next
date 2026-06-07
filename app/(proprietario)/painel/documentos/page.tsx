'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabaseAny as sb } from '@/lib/supabase';
import { formatDate } from '@/lib/format';

// ── Types ─────────────────────────────────────────────────────────────────────
type Doc = {
  id: number;
  nome: string;
  categoria: string;
  orgao: string | null;
  numero: string | null;
  emissao: string | null;
  vencimento: string | null;
  obs: string | null;
};

type StatusKey = 'vencido' | 'avencer' | 'emdia' | 'permanente';
type SortKey = 'vencimento' | 'nome' | 'categoria' | 'emissao';
type ModalMode = 'add' | 'edit' | 'view' | 'delete' | null;
type ToastEntry = { id: number; msg: string; kind: 'success' | 'error' };

// ── Constants ─────────────────────────────────────────────────────────────────
const CATS = [
  { v: 'licencas', label: 'Licenças',  color: '#dc2626', bg: '#fef2f2' },
  { v: 'alvara',   label: 'Alvarás',   color: '#d97706', bg: '#fffbeb' },
  { v: 'juridico', label: 'Jurídico',  color: '#1a73e8', bg: '#eff6ff' },
  { v: 'fiscal',   label: 'Fiscal',    color: '#ff385c', bg: 'rgba(255,56,92,0.07)' },
  { v: 'seguros',  label: 'Seguros',   color: '#16a34a', bg: '#f0fdf4' },
  { v: 'outros',   label: 'Outros',    color: '#6b7280', bg: '#f5f5f5' },
] as const;

const CAT_BY_V = Object.fromEntries(CATS.map((c) => [c.v, c])) as Record<string, (typeof CATS)[number]>;

const STATUS_META: Record<StatusKey, { label: string; color: string; bgCls: string }> = {
  vencido:   { label: 'Vencido',    color: '#dc2626', bgCls: 'bg-red-50 text-red-700 border-red-200' },
  avencer:   { label: 'A vencer',   color: '#d97706', bgCls: 'bg-amber-50 text-amber-700 border-amber-200' },
  emdia:     { label: 'Em dia',     color: '#16a34a', bgCls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  permanente:{ label: 'Permanente', color: '#1a73e8', bgCls: 'bg-blue-50 text-blue-700 border-blue-200' },
};

const ORDEM_GRUPOS: StatusKey[] = ['vencido', 'avencer', 'emdia', 'permanente'];
const GRUPO_LABEL: Record<StatusKey, string> = {
  vencido:    'Vencidos',
  avencer:    'A vencer (próximos 90 dias)',
  emdia:      'Em dia',
  permanente: 'Permanentes',
};

const SORT_OPTIONS: { v: SortKey; label: string }[] = [
  { v: 'vencimento', label: 'Vencimento' },
  { v: 'nome',       label: 'Nome' },
  { v: 'categoria',  label: 'Categoria' },
  { v: 'emissao',    label: 'Emissão' },
];

const EMPTY_FORM = { nome: '', categoria: 'licencas', orgao: '', numero: '', emissao: '', vencimento: '', obs: '' };

// ── Helpers ───────────────────────────────────────────────────────────────────
function statusDe(venc: string | null): StatusKey {
  if (!venc) return 'permanente';
  const diff = Math.ceil((new Date(venc).getTime() - Date.now()) / 86400000);
  if (diff < 0)   return 'vencido';
  if (diff <= 90) return 'avencer';
  return 'emdia';
}

function diasRestantes(venc: string | null): number | null {
  if (!venc) return null;
  return Math.ceil((new Date(venc).getTime() - Date.now()) / 86400000);
}

function validadePct(emissao: string | null, vencimento: string | null): number {
  if (!vencimento || !emissao) return 100;
  const total   = new Date(vencimento).getTime() - new Date(emissao).getTime();
  const elapsed = Date.now()                    - new Date(emissao).getTime();
  return Math.max(0, Math.min(100, 100 - (elapsed / total) * 100));
}

function exportCsv(docs: Doc[]) {
  const rows = ['Nome,Categoria,Órgão,Número,Emissão,Vencimento,Status'];
  docs.forEach((d) => {
    const cat    = CAT_BY_V[d.categoria]?.label || d.categoria;
    const status = STATUS_META[statusDe(d.vencimento)].label;
    const fmt    = (v: string | null) => v ? new Date(v + 'T00:00:00').toLocaleDateString('pt-BR') : '—';
    rows.push([d.nome, cat, d.orgao || '', d.numero || '', fmt(d.emissao), d.vencimento ? fmt(d.vencimento) : 'Permanente', status].join(','));
  });
  const blob = new Blob(['﻿' + rows.join('\n')], { type: 'text/csv;charset=utf-8' });
  const a    = document.createElement('a');
  a.href     = URL.createObjectURL(blob);
  a.download = `documentos_ventsy_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function DocumentosPage() {
  const [loading,    setLoading]    = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [userId,     setUserId]     = useState<string | null>(null);
  const [docs,       setDocs]       = useState<Doc[]>([]);

  const [catFiltro,    setCatFiltro]    = useState('todos');
  const [statusFiltro, setStatusFiltro] = useState<StatusKey | 'todos'>('todos');
  const [busca,        setBusca]        = useState('');
  const [sort,         setSort]         = useState<SortKey>('vencimento');

  const [mode,      setMode]      = useState<ModalMode>(null);
  const [activeDoc, setActiveDoc] = useState<Doc | null>(null);
  const [form,      setForm]      = useState({ ...EMPTY_FORM });
  const [saving,    setSaving]    = useState(false);

  const [toasts,  setToasts]  = useState<ToastEntry[]>([]);
  const toastId               = useRef(0);

  const toast = useCallback((msg: string, kind: 'success' | 'error' = 'success') => {
    const id = ++toastId.current;
    setToasts((t) => [...t, { id, msg, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500);
  }, []);

  const carregar = useCallback(async (uid: string) => {
    const { data, error } = await sb
      .from('documentos')
      .select('*')
      .eq('usuario_id', uid)
      .order('vencimento', { ascending: true, nullsFirst: false });
    if (error) { setNeedsSetup(true); setDocs([]); return; }
    setNeedsSetup(false);
    setDocs((data || []) as Doc[]);
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

  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') fecharModal(); };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Derived ──────────────────────────────────────────────────────────────────
  const counts = useMemo(() => {
    const c = { emdia: 0, avencer: 0, vencido: 0, total: docs.length };
    docs.forEach((d) => {
      const s = statusDe(d.vencimento);
      if (s === 'emdia') c.emdia++;
      else if (s === 'avencer') c.avencer++;
      else if (s === 'vencido') c.vencido++;
    });
    return c;
  }, [docs]);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    let list = docs.filter((d) => {
      if (catFiltro    !== 'todos' && d.categoria !== catFiltro)                    return false;
      if (statusFiltro !== 'todos' && statusDe(d.vencimento) !== statusFiltro)      return false;
      if (q && !(`${d.nome} ${d.orgao || ''} ${d.numero || ''}`.toLowerCase().includes(q))) return false;
      return true;
    });
    list = [...list].sort((a, b) => {
      if (sort === 'nome')      return a.nome.localeCompare(b.nome, 'pt-BR');
      if (sort === 'categoria') return a.categoria.localeCompare(b.categoria);
      if (sort === 'emissao')   return (a.emissao || '').localeCompare(b.emissao || '');
      const av = a.vencimento || '9999-99-99';
      const bv = b.vencimento || '9999-99-99';
      return av.localeCompare(bv);
    });
    return list;
  }, [docs, catFiltro, statusFiltro, busca, sort]);

  const grupos = useMemo(
    () => ORDEM_GRUPOS
      .map((g) => ({ g, items: filtrados.filter((d) => statusDe(d.vencimento) === g) }))
      .filter((x) => x.items.length > 0),
    [filtrados],
  );

  const hasFilter = catFiltro !== 'todos' || statusFiltro !== 'todos' || !!busca;

  // ── Modal helpers ─────────────────────────────────────────────────────────────
  function fecharModal() { setMode(null); setActiveDoc(null); }

  function abrirNovo() {
    setActiveDoc(null);
    setForm({ ...EMPTY_FORM, emissao: new Date().toISOString().split('T')[0] });
    setMode('add');
  }

  function abrirEdit(d: Doc) {
    setActiveDoc(d);
    setForm({ nome: d.nome || '', categoria: d.categoria || 'outros', orgao: d.orgao || '', numero: d.numero || '', emissao: d.emissao || '', vencimento: d.vencimento || '', obs: d.obs || '' });
    setMode('edit');
  }

  function abrirView(d: Doc)   { setActiveDoc(d); setMode('view'); }
  function abrirDelete(d: Doc) { setActiveDoc(d); setMode('delete'); }

  function abrirRenovar(d: Doc) {
    setActiveDoc(d);
    setForm({ nome: d.nome || '', categoria: d.categoria || 'outros', orgao: d.orgao || '', numero: d.numero || '', emissao: new Date().toISOString().split('T')[0], vencimento: '', obs: d.obs || '' });
    setMode('edit');
  }

  // ── CRUD ──────────────────────────────────────────────────────────────────────
  async function salvar() {
    if (!userId || !form.nome.trim()) return;
    setSaving(true);
    const payload = {
      nome:       form.nome.trim(),
      categoria:  form.categoria,
      orgao:      form.orgao      || null,
      numero:     form.numero     || null,
      emissao:    form.emissao    || null,
      vencimento: form.vencimento || null,
      obs:        form.obs        || null,
    };
    let error;
    if (mode === 'edit' && activeDoc) {
      ({ error } = await sb.from('documentos').update(payload).eq('id', activeDoc.id).eq('usuario_id', userId));
    } else {
      ({ error } = await sb.from('documentos').insert({ ...payload, usuario_id: userId }));
    }
    setSaving(false);
    if (!error) {
      fecharModal();
      await carregar(userId);
      toast(mode === 'edit' ? 'Documento atualizado!' : 'Documento adicionado!');
    } else {
      toast('Erro ao salvar. Tente novamente.', 'error');
    }
  }

  async function confirmarExclusao() {
    if (!userId || !activeDoc) return;
    setSaving(true);
    await sb.from('documentos').delete().eq('id', activeDoc.id).eq('usuario_id', userId);
    setSaving(false);
    setDocs((arr) => arr.filter((d) => d.id !== activeDoc.id));
    fecharModal();
    toast('Documento excluído.');
  }

  // ── Loading skeleton ──────────────────────────────────────────────────────────
  if (loading) return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="h-10 w-64 animate-pulse rounded-xl bg-black/[0.05]" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => <div key={i} className="h-24 animate-pulse rounded-2xl bg-black/[0.05]" />)}
      </div>
      <div className="h-10 animate-pulse rounded-xl bg-black/[0.05]" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[...Array(6)].map((_, i) => <div key={i} className="h-52 animate-pulse rounded-2xl bg-black/[0.05]" />)}
      </div>
    </div>
  );

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <>
      <div className="mx-auto max-w-6xl space-y-5">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-ink sm:text-2xl">Documentos</h1>
            <p className="mt-0.5 text-sm text-ink-muted">Licenças, alvarás e seguros com controle de validade.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => exportCsv(docs)}
              disabled={docs.length === 0}
              className="flex items-center gap-2 rounded-xl border border-black/10 bg-white px-4 py-2.5 text-sm font-semibold text-ink-soft shadow-sm transition hover:border-black/20 hover:text-ink disabled:opacity-40"
              title="Exportar todos como CSV"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
              </svg>
              Exportar CSV
            </button>
            <button
              onClick={abrirNovo}
              className="rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-600"
            >
              + Novo documento
            </button>
          </div>
        </div>

        {/* Setup warning */}
        {needsSetup && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            A tabela <code>documentos</code> ainda não existe no banco. Aplique a migration para começar.
          </div>
        )}

        {/* Alert banner */}
        {(counts.vencido > 0 || counts.avencer > 0) && (
          <div className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-sm ${counts.vencido > 0 ? 'border-red-200 bg-red-50 text-red-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
            <span className="text-lg">⚠️</span>
            <div className="flex-1">
              {counts.vencido > 0
                ? <><strong>{counts.vencido} documento{counts.vencido > 1 ? 's' : ''} vencido{counts.vencido > 1 ? 's' : ''}.</strong> Regularize para evitar problemas legais.</>
                : <><strong>{counts.avencer} documento{counts.avencer > 1 ? 's' : ''} vencem nos próximos 90 dias.</strong> Providencie a renovação com antecedência.</>}
            </div>
            <button
              onClick={() => setStatusFiltro(counts.vencido > 0 ? 'vencido' : 'avencer')}
              className="shrink-0 rounded-lg px-3 py-1 text-xs font-bold underline-offset-2 hover:underline"
            >
              Ver {counts.vencido > 0 ? 'vencidos' : 'a vencer'} →
            </button>
          </div>
        )}

        {/* Summary cards — clicáveis para filtrar por status */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <ResumoCard
            label="Em dia"        value={counts.emdia}   color="text-emerald-600"
            active={statusFiltro === 'emdia'}   onClick={() => setStatusFiltro(statusFiltro === 'emdia'   ? 'todos' : 'emdia')}
            iconPath={<path d="M22 11.08V12a10 10 0 11-5.93-9.14M22 4L12 14.01l-3-3" />}
          />
          <ResumoCard
            label="A vencer (90d)" value={counts.avencer} color="text-amber-600"
            active={statusFiltro === 'avencer'} onClick={() => setStatusFiltro(statusFiltro === 'avencer' ? 'todos' : 'avencer')}
            iconPath={<><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></>}
          />
          <ResumoCard
            label="Vencidos"     value={counts.vencido}  color="text-red-600"
            active={statusFiltro === 'vencido'} onClick={() => setStatusFiltro(statusFiltro === 'vencido' ? 'todos' : 'vencido')}
            iconPath={<><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></>}
          />
          <ResumoCard
            label="Total"        value={counts.total}    color="text-ink"
            active={statusFiltro === 'todos'}   onClick={() => setStatusFiltro('todos')}
            iconPath={<><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14,2 14,8 20,8" /></>}
          />
        </div>

        {/* Filtros + busca + sort */}
        <div className="flex flex-wrap items-center gap-2">
          {[{ v: 'todos', label: 'Todos' }, ...CATS].map((c) => (
            <button
              key={c.v}
              onClick={() => setCatFiltro(c.v)}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${catFiltro === c.v ? 'border-brand bg-brand-50 text-brand' : 'border-black/10 text-ink-muted hover:border-brand/40'}`}
            >
              {c.label}
            </button>
          ))}
          <div className="ml-auto flex items-center gap-2">
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar documento…"
              className="min-w-[180px] rounded-xl border border-black/10 px-3.5 py-2 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
            />
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="rounded-xl border border-black/10 bg-white px-3.5 py-2 text-sm text-ink-soft focus:border-brand focus:outline-none"
            >
              {SORT_OPTIONS.map((o) => <option key={o.v} value={o.v}>Ordenar: {o.label}</option>)}
            </select>
          </div>
        </div>

        {/* Filtros ativos */}
        {hasFilter && (
          <div className="flex flex-wrap items-center gap-2 text-xs text-ink-muted">
            <span>Filtrando por:</span>
            {statusFiltro !== 'todos' && <FilterChip label={STATUS_META[statusFiltro].label} onRemove={() => setStatusFiltro('todos')} />}
            {catFiltro    !== 'todos' && <FilterChip label={CAT_BY_V[catFiltro]?.label || catFiltro}  onRemove={() => setCatFiltro('todos')} />}
            {busca                    && <FilterChip label={`"${busca}"`}                              onRemove={() => setBusca('')} />}
            <button
              onClick={() => { setStatusFiltro('todos'); setCatFiltro('todos'); setBusca(''); }}
              className="ml-1 font-semibold text-brand hover:underline"
            >
              Limpar tudo
            </button>
          </div>
        )}

        {/* Lista agrupada */}
        {grupos.length === 0 ? (
          <EmptyState hasFilter={hasFilter} onNew={abrirNovo} />
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
                  {items.map((d) => (
                    <DocCard
                      key={d.id} doc={d}
                      onView={()    => abrirView(d)}
                      onEdit={()    => abrirEdit(d)}
                      onDelete={()  => abrirDelete(d)}
                      onRenovar={()=> abrirRenovar(d)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Modals ── */}
      {(mode === 'add' || mode === 'edit') && (
        <ModalShell onClose={fecharModal}>
          <h3 className="mb-5 font-display text-xl font-bold text-ink">
            {mode === 'edit' ? 'Editar documento' : 'Novo documento'}
          </h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Campo label="Nome do documento" full>
              <input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} className={inp} placeholder="Ex: Alvará de Funcionamento" autoFocus />
            </Campo>
            <Campo label="Categoria">
              <select value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })} className={inp}>
                {CATS.map((c) => <option key={c.v} value={c.v}>{c.label}</option>)}
              </select>
            </Campo>
            <Campo label="Órgão emissor">
              <input value={form.orgao} onChange={(e) => setForm({ ...form, orgao: e.target.value })} className={inp} placeholder="Ex: Prefeitura Municipal" />
            </Campo>
            <Campo label="Número / protocolo">
              <input value={form.numero} onChange={(e) => setForm({ ...form, numero: e.target.value })} className={inp} placeholder="Ex: ALV-2025-00991" />
            </Campo>
            <Campo label="Data de emissão">
              <input type="date" value={form.emissao} onChange={(e) => setForm({ ...form, emissao: e.target.value })} className={inp} />
            </Campo>
            <Campo label="Data de vencimento">
              <input type="date" value={form.vencimento} onChange={(e) => setForm({ ...form, vencimento: e.target.value })} className={inp} />
              <p className="mt-1 text-xs text-ink-muted">Deixe vazio se o documento não vence.</p>
            </Campo>
            <Campo label="Observações" full>
              <textarea
                value={form.obs}
                onChange={(e) => setForm({ ...form, obs: e.target.value })}
                className={`${inp} min-h-[80px] resize-none`}
                placeholder="Notas, instruções de renovação…"
              />
            </Campo>
          </div>
          <div className="mt-6 flex items-center gap-3">
            <button
              onClick={salvar}
              disabled={saving || !form.nome.trim()}
              className="rounded-xl bg-brand px-6 py-3 text-sm font-bold text-white transition hover:bg-brand-600 disabled:opacity-60"
            >
              {saving ? 'Salvando…' : mode === 'edit' ? 'Salvar alterações' : 'Adicionar documento'}
            </button>
            <button onClick={fecharModal} className="ml-auto text-sm font-medium text-ink-muted hover:text-ink">Cancelar</button>
          </div>
        </ModalShell>
      )}

      {mode === 'view' && activeDoc && (
        <ModalShell onClose={fecharModal}>
          <ViewModal
            doc={activeDoc}
            onEdit={() => abrirEdit(activeDoc)}
            onRenovar={() => abrirRenovar(activeDoc)}
            onClose={fecharModal}
          />
        </ModalShell>
      )}

      {mode === 'delete' && activeDoc && (
        <ModalShell onClose={fecharModal} small>
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-50">
              <svg viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth={2} className="h-7 w-7">
                <polyline points="3,6 5,6 21,6" />
                <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6M10 11v6M14 11v6M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-bold text-ink">Excluir documento?</h3>
              <p className="mt-1 text-sm text-ink-muted">
                <strong>{activeDoc.nome}</strong> será removido permanentemente e esta ação não pode ser desfeita.
              </p>
            </div>
            <div className="flex w-full gap-3">
              <button onClick={fecharModal} className="flex-1 rounded-xl border border-black/10 py-3 text-sm font-semibold text-ink-soft hover:bg-black/[0.02]">
                Cancelar
              </button>
              <button onClick={confirmarExclusao} disabled={saving} className="flex-1 rounded-xl bg-red-600 py-3 text-sm font-bold text-white transition hover:bg-red-700 disabled:opacity-60">
                {saving ? 'Excluindo…' : 'Excluir'}
              </button>
            </div>
          </div>
        </ModalShell>
      )}

      {/* Toasts */}
      <div className="fixed bottom-6 right-6 z-[20000] flex flex-col items-end gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`flex items-center gap-2.5 rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-pop ${t.kind === 'error' ? 'bg-red-600' : 'bg-emerald-600'}`}
          >
            {t.kind === 'error'
              ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4 shrink-0"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
              : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4 shrink-0"><path d="M22 11.08V12a10 10 0 11-5.93-9.14M22 4L12 14.01l-3-3"/></svg>}
            {t.msg}
          </div>
        ))}
      </div>
    </>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────
const inp = 'w-full rounded-xl border border-black/10 px-3.5 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20';

function ModalShell({ children, onClose, small }: { children: React.ReactNode; onClose: () => void; small?: boolean }) {
  return (
    <div className="fixed inset-0 z-[10000] flex items-start justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-sm">
      <div className={`relative my-8 w-full ${small ? 'max-w-sm' : 'max-w-lg'} rounded-2xl bg-white p-6 shadow-pop`}>
        <button onClick={onClose} className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full border border-black/10 text-ink-muted hover:bg-black/[0.03]">
          ✕
        </button>
        {children}
      </div>
    </div>
  );
}

function Campo({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <label className={`block ${full ? 'sm:col-span-2' : ''}`}>
      <span className="mb-1.5 block text-sm font-semibold text-ink-soft">{label}</span>
      {children}
    </label>
  );
}

function ResumoCard({ label, value, color, active, onClick, iconPath }: {
  label: string; value: number; color: string; active: boolean; onClick: () => void; iconPath: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-2xl bg-white p-4 text-left shadow-card transition hover:shadow-md ${active ? 'ring-2 ring-brand ring-offset-1' : ''}`}
    >
      <div className="flex items-start justify-between">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-5 w-5 text-ink-muted">
          {iconPath}
        </svg>
        {active && <span className="rounded-full bg-brand px-2 py-0.5 text-[10px] font-bold text-white">Ativo</span>}
      </div>
      <div className={`mt-2 text-2xl font-bold ${color}`}>{value}</div>
      <div className="text-xs text-ink-muted">{label}</div>
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
    <div className="mt-2 rounded-2xl bg-white p-12 text-center shadow-card">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.2} className="mx-auto h-12 w-12 text-black/20">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
        <polyline points="14,2 14,8 20,8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10,9 9,9 8,9" />
      </svg>
      <h3 className="mt-4 font-bold text-ink">
        {hasFilter ? 'Nenhum documento com esse filtro' : 'Nenhum documento ainda'}
      </h3>
      <p className="mt-1.5 text-sm text-ink-muted">
        {hasFilter
          ? 'Tente ajustar ou limpar os filtros.'
          : 'Adicione licenças, alvarás e seguros para controlar os vencimentos.'}
      </p>
      {!hasFilter && (
        <button onClick={onNew} className="mt-5 rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-600">
          + Novo documento
        </button>
      )}
    </div>
  );
}

function CatIcon({ catV, color, className = 'h-5 w-5' }: { catV: string; color: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} className={className}>
      {catV === 'licencas' && <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />}
      {catV === 'alvara'   && <><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M9 21V9" /></>}
      {catV === 'juridico' && <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><polyline points="9,12 11,14 15,10" /></>}
      {catV === 'fiscal'   && <><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" /></>}
      {catV === 'seguros'  && <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />}
      {!['licencas','alvara','juridico','fiscal','seguros'].includes(catV) && <><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14,2 14,8 20,8" /></>}
    </svg>
  );
}

function DocCard({ doc, onView, onEdit, onDelete, onRenovar }: {
  doc: Doc; onView: () => void; onEdit: () => void; onDelete: () => void; onRenovar: () => void;
}) {
  const cat      = CAT_BY_V[doc.categoria] || CAT_BY_V.outros;
  const status   = statusDe(doc.vencimento);
  const meta     = STATUS_META[status];
  const dias     = diasRestantes(doc.vencimento);
  const pct      = validadePct(doc.emissao, doc.vencimento);
  const isUrgent = status === 'vencido' || status === 'avencer';
  const diasLabel =
    dias == null  ? 'Não vence'
    : dias < 0    ? `Vencido há ${Math.abs(dias)}d`
    : dias === 0  ? 'Vence hoje!'
    : `${dias} dias restantes`;

  return (
    <div className="group overflow-hidden rounded-2xl bg-white shadow-card transition hover:shadow-md">
      <div className="h-1" style={{ background: meta.color }} />
      <div className="p-4">
        {/* Top row */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" style={{ background: cat.bg }}>
            <CatIcon catV={doc.categoria} color={cat.color} />
          </div>
          <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${meta.bgCls}`}>
            {meta.label}
          </span>
        </div>

        {/* Name + category */}
        <div className="mt-3 font-bold leading-snug text-ink">{doc.nome}</div>
        <div className="text-xs text-ink-muted">{cat.label}</div>

        {/* Metadata */}
        <dl className="mt-3 space-y-1 text-xs">
          <Linha t="Órgão"       v={doc.orgao  || '—'} />
          <Linha t="Número"      v={doc.numero || '—'} />
          <Linha t="Emissão"     v={doc.emissao    ? formatDate(doc.emissao,    { style: 'short' }) : '—'} />
          <Linha t="Vencimento"  v={doc.vencimento ? formatDate(doc.vencimento, { style: 'short' }) : 'Não vence'} vc={meta.color} />
        </dl>

        {/* Progress bar de validade */}
        {doc.vencimento && (
          <div className="mt-3">
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="text-ink-muted">Validade</span>
              <span className="font-semibold" style={{ color: meta.color }}>{diasLabel}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-black/[0.06]">
              <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: meta.color }} />
            </div>
          </div>
        )}

        {/* CTA de renovação para docs urgentes */}
        {isUrgent && (
          <button
            onClick={onRenovar}
            className="mt-3 w-full rounded-lg py-1.5 text-xs font-bold transition"
            style={{ background: `${meta.color}18`, color: meta.color }}
          >
            {status === 'vencido' ? '↺ Regularizar agora' : '↺ Renovar documento'}
          </button>
        )}
      </div>

      {/* Footer actions */}
      <div className="flex border-t border-black/[0.06] text-xs">
        <button onClick={onView}   className="flex-1 py-2.5 font-semibold text-ink-soft hover:bg-black/[0.02]">Ver</button>
        <div className="w-px bg-black/[0.06]" />
        <button onClick={onEdit}   className="flex-1 py-2.5 font-semibold text-ink-soft hover:bg-black/[0.02]">Editar</button>
        <div className="w-px bg-black/[0.06]" />
        <button onClick={onDelete} className="flex-1 py-2.5 font-semibold text-red-600 hover:bg-red-50">Excluir</button>
      </div>
    </div>
  );
}

function ViewModal({ doc, onEdit, onRenovar, onClose }: {
  doc: Doc; onEdit: () => void; onRenovar: () => void; onClose: () => void;
}) {
  const cat      = CAT_BY_V[doc.categoria] || CAT_BY_V.outros;
  const status   = statusDe(doc.vencimento);
  const meta     = STATUS_META[status];
  const dias     = diasRestantes(doc.vencimento);
  const pct      = validadePct(doc.emissao, doc.vencimento);
  const isUrgent = status === 'vencido' || status === 'avencer';
  const diasLabel =
    dias == null  ? 'Não vence'
    : dias < 0    ? `Vencido há ${Math.abs(dias)} dias`
    : dias === 0  ? 'Vence hoje!'
    : `${dias} dias restantes`;

  return (
    <div>
      {/* Header */}
      <div className="flex items-start gap-3 pr-8">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ background: cat.bg }}>
          <CatIcon catV={doc.categoria} color={cat.color} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-display text-xl font-bold leading-tight text-ink">{doc.nome}</h3>
          <p className="text-sm text-ink-muted">{cat.label}</p>
        </div>
        <span className={`shrink-0 self-start rounded-full border px-2.5 py-0.5 text-xs font-semibold ${meta.bgCls}`}>
          {meta.label}
        </span>
      </div>

      {/* Fields */}
      <div className="mt-5 grid grid-cols-2 gap-3">
        <ViewField label="Órgão Emissor"       value={doc.orgao  || '—'} />
        <ViewField label="Número / Protocolo"  value={doc.numero || '—'} />
        <ViewField label="Data de Emissão"     value={doc.emissao    ? formatDate(doc.emissao,    { style: 'short' }) : '—'} />
        <ViewField label="Data de Vencimento"  value={doc.vencimento ? formatDate(doc.vencimento, { style: 'short' }) : 'Não vence'} color={meta.color} />
      </div>

      {/* Progress bar */}
      {doc.vencimento && (
        <div className="mt-4">
          <div className="mb-1.5 flex items-center justify-between text-sm">
            <span className="text-ink-muted">Validade restante</span>
            <span className="font-bold" style={{ color: meta.color }}>{diasLabel}</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-black/[0.06]">
            <div className="h-full rounded-full" style={{ width: `${pct}%`, background: meta.color }} />
          </div>
        </div>
      )}

      {/* Obs */}
      {doc.obs && (
        <div className="mt-4 rounded-xl bg-black/[0.02] px-4 py-3">
          <span className="mb-1 block text-xs font-semibold text-ink-muted">Observações</span>
          <p className="text-sm text-ink-soft">{doc.obs}</p>
        </div>
      )}

      {/* Actions */}
      <div className="mt-6 flex items-center gap-3">
        {isUrgent && (
          <button
            onClick={onRenovar}
            className="rounded-xl px-5 py-2.5 text-sm font-bold text-white"
            style={{ background: meta.color }}
          >
            ↺ {status === 'vencido' ? 'Regularizar' : 'Renovar'}
          </button>
        )}
        <button
          onClick={onEdit}
          className={`rounded-xl border px-5 py-2.5 text-sm font-semibold transition ${isUrgent ? 'border-black/10 text-ink-soft hover:text-ink' : 'border-brand bg-brand text-white hover:bg-brand-600 border-transparent'}`}
        >
          Editar
        </button>
        <button onClick={onClose} className="ml-auto text-sm font-medium text-ink-muted hover:text-ink">Fechar</button>
      </div>
    </div>
  );
}

function ViewField({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-xl bg-black/[0.02] px-3.5 py-3">
      <div className="text-xs font-semibold text-ink-muted">{label}</div>
      <div className="mt-0.5 text-sm font-bold text-ink" style={color ? { color } : undefined}>{value}</div>
    </div>
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
