'use client';

// Documentos — /painel/documentos.
// Substitui o legado 100% mock por um real sobre a tabela `documentos`
// (licenças/alvarás/seguros com controle de validade). CRUD via supabaseAny.
// Requer a migration de `documentos` (criada via MCP nesta sessão).

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabaseAny as sb } from '@/lib/supabase';
import { formatDate } from '@/lib/format';

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

const CATS = [
  { v: 'licencas', label: 'Licenças', color: '#dc2626', bg: '#fef2f2' },
  { v: 'alvara', label: 'Alvarás', color: '#d97706', bg: '#fffbeb' },
  { v: 'juridico', label: 'Jurídico', color: '#1a73e8', bg: '#eff6ff' },
  { v: 'fiscal', label: 'Fiscal', color: '#ff385c', bg: 'rgba(255,56,92,0.07)' },
  { v: 'seguros', label: 'Seguros', color: '#16a34a', bg: '#f0fdf4' },
  { v: 'outros', label: 'Outros', color: '#6b7280', bg: '#f5f5f5' },
];
const CAT_BY_V = Object.fromEntries(CATS.map((c) => [c.v, c]));

type StatusKey = 'vencido' | 'avencer' | 'emdia' | 'permanente';
const STATUS_META: Record<StatusKey, { label: string; color: string; bg: string }> = {
  vencido: { label: 'Vencido', color: '#dc2626', bg: 'bg-red-50 text-red-700' },
  avencer: { label: 'A vencer', color: '#d97706', bg: 'bg-amber-50 text-amber-700' },
  emdia: { label: 'Em dia', color: '#16a34a', bg: 'bg-emerald-50 text-emerald-700' },
  permanente: { label: 'Permanente', color: '#1a73e8', bg: 'bg-blue-50 text-blue-700' },
};

function statusDe(venc: string | null): StatusKey {
  if (!venc) return 'permanente';
  const diff = Math.ceil((new Date(venc).getTime() - Date.now()) / 86400000);
  if (diff < 0) return 'vencido';
  if (diff <= 90) return 'avencer';
  return 'emdia';
}
function diasRestantes(venc: string | null): number | null {
  if (!venc) return null;
  return Math.ceil((new Date(venc).getTime() - Date.now()) / 86400000);
}

const ORDEM_GRUPOS: StatusKey[] = ['vencido', 'avencer', 'emdia', 'permanente'];
const GRUPO_LABEL: Record<StatusKey, string> = { vencido: 'Vencidos', avencer: 'A vencer (90 dias)', emdia: 'Em dia', permanente: 'Permanentes' };

const EMPTY_FORM = { nome: '', categoria: 'licencas', orgao: '', numero: '', emissao: '', vencimento: '', obs: '' };

export default function DocumentosPage() {
  const [loading, setLoading] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [catFiltro, setCatFiltro] = useState('todos');
  const [busca, setBusca] = useState('');

  const [modal, setModal] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);

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
      setUserId(session.user.id);
      await carregar(session.user.id);
      setLoading(false);
    })();
  }, [carregar]);

  const counts = useMemo(() => {
    const c = { emdia: 0, avencer: 0, vencido: 0, total: docs.length };
    docs.forEach((d) => { const s = statusDe(d.vencimento); if (s === 'emdia') c.emdia++; else if (s === 'avencer') c.avencer++; else if (s === 'vencido') c.vencido++; });
    return c;
  }, [docs]);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return docs.filter((d) => {
      if (catFiltro !== 'todos' && d.categoria !== catFiltro) return false;
      if (q && !(`${d.nome} ${d.orgao || ''}`.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [docs, catFiltro, busca]);

  const grupos = useMemo(() => ORDEM_GRUPOS.map((g) => ({ g, items: filtrados.filter((d) => statusDe(d.vencimento) === g) })).filter((x) => x.items.length > 0), [filtrados]);

  function abrirNovo() { setEditId(null); setForm({ ...EMPTY_FORM, emissao: new Date().toISOString().split('T')[0] }); setModal(true); }
  function abrirEdit(d: Doc) {
    setEditId(d.id);
    setForm({ nome: d.nome || '', categoria: d.categoria || 'outros', orgao: d.orgao || '', numero: d.numero || '', emissao: d.emissao || '', vencimento: d.vencimento || '', obs: d.obs || '' });
    setModal(true);
  }

  async function salvar() {
    if (!userId || !form.nome.trim()) return;
    setSaving(true);
    const payload = {
      nome: form.nome.trim(), categoria: form.categoria, orgao: form.orgao || null, numero: form.numero || null,
      emissao: form.emissao || null, vencimento: form.vencimento || null, obs: form.obs || null,
    };
    let error;
    if (editId) {
      ({ error } = await sb.from('documentos').update(payload).eq('id', editId).eq('usuario_id', userId));
    } else {
      ({ error } = await sb.from('documentos').insert({ ...payload, usuario_id: userId }));
    }
    setSaving(false);
    if (!error) { setModal(false); await carregar(userId); }
  }

  async function excluir(id: number) {
    if (!userId || !confirm('Excluir este documento?')) return;
    await sb.from('documentos').delete().eq('id', id).eq('usuario_id', userId);
    setDocs((arr) => arr.filter((d) => d.id !== id));
  }

  if (loading) return <div className="mx-auto h-[480px] max-w-6xl animate-pulse rounded-2xl bg-black/[0.05]" />;

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink sm:text-2xl">Documentos</h1>
          <p className="mt-1 text-sm text-ink-muted">Licenças, alvarás e seguros com controle de validade.</p>
        </div>
        <button onClick={abrirNovo} className="rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-600">+ Novo documento</button>
      </div>

      {needsSetup && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          A tabela de documentos ainda não foi criada no banco. Os documentos aparecerão aqui assim que a migration <code>documentos</code> for aplicada.
        </div>
      )}

      {(counts.vencido > 0 || counts.avencer > 0) && (
        <div className={`mt-4 flex items-center gap-3 rounded-xl border px-4 py-3 text-sm ${counts.vencido > 0 ? 'border-red-200 bg-red-50 text-red-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
          <span className="text-lg">⚠️</span>
          {counts.vencido > 0
            ? <span><strong>{counts.vencido} documento(s) vencido(s).</strong> Regularize para evitar problemas legais.</span>
            : <span><strong>{counts.avencer} documento(s) vencem em breve.</strong> Providencie a renovação com antecedência.</span>}
        </div>
      )}

      {/* Summary */}
      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Resumo label="Em dia" value={counts.emdia} color="text-emerald-600" />
        <Resumo label="A vencer (90d)" value={counts.avencer} color="text-amber-600" />
        <Resumo label="Vencidos" value={counts.vencido} color="text-red-600" />
        <Resumo label="Total" value={counts.total} color="text-ink" />
      </div>

      {/* Filtros */}
      <div className="mt-5 flex flex-wrap items-center gap-2">
        {[{ v: 'todos', label: 'Todos' }, ...CATS].map((c) => (
          <button
            key={c.v}
            onClick={() => setCatFiltro(c.v)}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${catFiltro === c.v ? 'border-brand bg-brand-50 text-brand' : 'border-black/10 text-ink-muted hover:border-brand/40'}`}
          >
            {c.label}
          </button>
        ))}
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar documento…" className="min-w-[200px] flex-1 rounded-xl border border-black/10 px-3.5 py-2 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20" />
      </div>

      {/* Lista agrupada */}
      {grupos.length === 0 ? (
        <div className="mt-6 rounded-2xl bg-white p-12 text-center text-sm text-ink-muted shadow-card">
          Nenhum documento {catFiltro !== 'todos' || busca ? 'com esse filtro' : 'ainda'}. Use <strong>+ Novo documento</strong> para começar.
        </div>
      ) : (
        <div className="mt-6 space-y-6">
          {grupos.map(({ g, items }) => (
            <div key={g}>
              <div className="mb-3 flex items-center gap-3">
                <h3 className="text-sm font-bold" style={{ color: STATUS_META[g].color }}>{GRUPO_LABEL[g]}</h3>
                <div className="h-px flex-1 bg-black/[0.06]" />
                <span className="text-xs font-semibold text-ink-muted">{items.length}</span>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((d) => <Card key={d.id} doc={d} onEdit={() => abrirEdit(d)} onDelete={() => excluir(d.id)} />)}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 z-[10000] flex items-start justify-center overflow-y-auto bg-black/50 p-4">
          <div className="relative my-8 w-full max-w-lg rounded-2xl bg-white p-6 shadow-pop">
            <button onClick={() => setModal(false)} className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full border border-black/10 text-ink-muted hover:bg-black/[0.03]">✕</button>
            <h3 className="mb-5 font-display text-xl font-bold text-ink">{editId ? 'Editar documento' : 'Novo documento'}</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Campo label="Nome do documento" full><input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} className={inp} placeholder="Ex: Alvará de Funcionamento" autoFocus /></Campo>
              <Campo label="Categoria"><select value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })} className={inp}>{CATS.map((c) => <option key={c.v} value={c.v}>{c.label}</option>)}</select></Campo>
              <Campo label="Órgão emissor"><input value={form.orgao} onChange={(e) => setForm({ ...form, orgao: e.target.value })} className={inp} placeholder="Ex: Prefeitura" /></Campo>
              <Campo label="Número / protocolo"><input value={form.numero} onChange={(e) => setForm({ ...form, numero: e.target.value })} className={inp} /></Campo>
              <div className="hidden sm:block" />
              <Campo label="Emissão"><input type="date" value={form.emissao} onChange={(e) => setForm({ ...form, emissao: e.target.value })} className={inp} /></Campo>
              <Campo label="Vencimento (deixe vazio se permanente)"><input type="date" value={form.vencimento} onChange={(e) => setForm({ ...form, vencimento: e.target.value })} className={inp} /></Campo>
              <Campo label="Observações" full><textarea value={form.obs} onChange={(e) => setForm({ ...form, obs: e.target.value })} className={`${inp} min-h-[80px]`} /></Campo>
            </div>
            <div className="mt-6 flex items-center gap-3">
              <button onClick={salvar} disabled={saving || !form.nome.trim()} className="rounded-xl bg-brand px-6 py-3 text-sm font-bold text-white transition hover:bg-brand-600 disabled:opacity-60">{saving ? 'Salvando…' : 'Salvar'}</button>
              <button onClick={() => setModal(false)} className="ml-auto text-sm font-medium text-ink-muted hover:text-ink">Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const inp = 'w-full rounded-xl border border-black/10 px-3.5 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20';

function Resumo({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-card">
      <div className="text-xs text-ink-muted">{label}</div>
      <div className={`mt-2 text-2xl font-bold ${color}`}>{value}</div>
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

function Card({ doc, onEdit, onDelete }: { doc: Doc; onEdit: () => void; onDelete: () => void }) {
  const cat = CAT_BY_V[doc.categoria] || CAT_BY_V.outros;
  const status = statusDe(doc.vencimento);
  const meta = STATUS_META[status];
  const dias = diasRestantes(doc.vencimento);
  const diasLabel = dias == null ? 'Não vence' : dias < 0 ? `Vencido há ${Math.abs(dias)} dias` : dias === 0 ? 'Vence hoje!' : `${dias} dias restantes`;

  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-card">
      <div className="h-1" style={{ background: meta.color }} />
      <div className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg text-sm font-bold" style={{ background: cat.bg, color: cat.color }}>
            {cat.label[0]}
          </div>
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${meta.bg}`}>{meta.label}</span>
        </div>
        <div className="mt-3 font-bold text-ink">{doc.nome}</div>
        <div className="text-xs text-ink-muted">{cat.label}</div>
        <dl className="mt-3 space-y-1.5 text-xs">
          <Linha t="Órgão" v={doc.orgao || '—'} />
          <Linha t="Número" v={doc.numero || '—'} />
          <Linha t="Emissão" v={doc.emissao ? formatDate(doc.emissao, { style: 'short' }) : '—'} />
          <Linha t="Vencimento" v={doc.vencimento ? formatDate(doc.vencimento, { style: 'short' }) : 'Não vence'} vc={meta.color} />
        </dl>
        {doc.vencimento && <div className="mt-2 text-xs font-semibold" style={{ color: meta.color }}>{diasLabel}</div>}
      </div>
      <div className="flex border-t border-black/[0.06] text-xs">
        <button onClick={onEdit} className="flex-1 py-2.5 font-semibold text-ink-soft hover:bg-black/[0.02]">Editar</button>
        <div className="w-px bg-black/[0.06]" />
        <button onClick={onDelete} className="flex-1 py-2.5 font-semibold text-red-600 hover:bg-red-50">Excluir</button>
      </div>
    </div>
  );
}

function Linha({ t, v, vc }: { t: string; v: string; vc?: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="text-ink-muted">{t}</dt>
      <dd className="font-semibold text-ink-soft" style={vc ? { color: vc } : undefined}>{v}</dd>
    </div>
  );
}
