'use client';

// Leads — /painel/leads.
// Pipeline/CRM sobre a tabela `clientes_eventos` (por usuario_id), portando o
// núcleo do módulo legado: KPIs por grupo de status, lista filtrável, criar,
// mudar status e excluir. Follow-up: ficha detalhada do evento (6 seções) + export.

import { useEffect, useMemo, useState } from 'react';
import { supabaseAny as sb } from '@/lib/supabase';
import { formatDateRange } from '@/lib/format';

type Grupo = 'negociando' | 'contratados' | 'finalizados' | 'perdidos';
type StatusDef = { v: string; label: string; grupo: Grupo };

const STATUS: StatusDef[] = [
  { v: 'lead', label: 'Lead / Novo', grupo: 'negociando' },
  { v: 'consultada', label: 'Data Consultada', grupo: 'negociando' },
  { v: 'visita', label: 'Visita Agendada', grupo: 'negociando' },
  { v: 'negociacao', label: 'Em Negociação', grupo: 'negociando' },
  { v: 'reserva', label: 'Reserva Temp.', grupo: 'negociando' },
  { v: 'contratado', label: 'Contratado', grupo: 'contratados' },
  { v: 'briefing', label: 'Briefing', grupo: 'contratados' },
  { v: 'pronto', label: 'Pronto p/ Exec.', grupo: 'contratados' },
  { v: 'montagem', label: 'Em Montagem', grupo: 'contratados' },
  { v: 'finalizado', label: 'Finalizado', grupo: 'finalizados' },
  { v: 'pos', label: 'Pós-Evento', grupo: 'finalizados' },
  { v: 'perdido', label: 'Perdido', grupo: 'perdidos' },
  { v: 'recontactar', label: 'Recontactar', grupo: 'perdidos' },
];
const STATUS_BY_V = Object.fromEntries(STATUS.map((s) => [s.v, s]));
const GRUPO_CLS: Record<Grupo, string> = {
  negociando: 'bg-amber-50 text-amber-700 border-amber-200',
  contratados: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  finalizados: 'bg-blue-50 text-blue-700 border-blue-200',
  perdidos: 'bg-red-50 text-red-700 border-red-200',
};
const TIPOS = ['Casamento', 'Aniversário', 'Corporativo', 'Formatura', 'Batizado', 'Outro'];

type Lead = {
  id: string | number;
  nome_evento: string | null;
  quem_contratou: string | null;
  tipo_evento: string | null;
  status: string | null;
  data_inicio: string | null;
  data_fim: string | null;
  valor_total: string | number | null;
};

export default function LeadsPage() {
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [fStatus, setFStatus] = useState('');
  const [busca, setBusca] = useState('');

  const [modal, setModal] = useState(false);
  const [nNome, setNNome] = useState('');
  const [nQuem, setNQuem] = useState('');
  const [nTipo, setNTipo] = useState(TIPOS[0]);
  const [nStatus, setNStatus] = useState('lead');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await sb.auth.getSession();
      if (!session) { setLoading(false); return; }
      setUserId(session.user.id);
      const { data } = await sb.from('clientes_eventos').select('*').eq('usuario_id', session.user.id).order('criado_em', { ascending: false });
      setLeads((data || []) as Lead[]);
      setLoading(false);
    })();
  }, []);

  const kpis = useMemo(() => {
    const grupoDe = (s: string | null) => STATUS_BY_V[s || 'lead']?.grupo;
    const count = (g: Grupo) => leads.filter((l) => grupoDe(l.status) === g).length;
    return { total: leads.length, negociando: count('negociando'), contratados: count('contratados'), finalizados: count('finalizados'), perdidos: count('perdidos') };
  }, [leads]);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return leads.filter((l) => {
      if (fStatus && l.status !== fStatus) return false;
      if (q && !(`${l.nome_evento || ''} ${l.quem_contratou || ''}`.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [leads, fStatus, busca]);

  async function criar() {
    if (!userId || !nNome.trim() || !nQuem.trim()) return;
    setSaving(true);
    const { data, error } = await sb.from('clientes_eventos').insert({
      usuario_id: userId, nome_evento: nNome.trim(), quem_contratou: nQuem.trim(),
      tipo_evento: nTipo, status: nStatus, telefones: [], parcelas: [], checklist: {},
    }).select().single();
    setSaving(false);
    if (!error && data) {
      setLeads((arr) => [data as Lead, ...arr]);
      setModal(false); setNNome(''); setNQuem(''); setNTipo(TIPOS[0]); setNStatus('lead');
    }
  }

  async function mudarStatus(id: string | number, status: string) {
    setLeads((arr) => arr.map((l) => (l.id === id ? { ...l, status } : l)));
    if (userId) await sb.from('clientes_eventos').update({ status }).eq('id', id).eq('usuario_id', userId);
  }

  async function excluir(id: string | number) {
    if (!userId || !confirm('Excluir este lead/evento?')) return;
    await sb.from('clientes_eventos').delete().eq('id', id).eq('usuario_id', userId);
    setLeads((arr) => arr.filter((l) => l.id !== id));
  }

  if (loading) return <div className="mx-auto h-[480px] max-w-6xl animate-pulse rounded-2xl bg-black/[0.05]" />;

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink sm:text-2xl">Leads</h1>
          <p className="mt-1 text-sm text-ink-muted">Acompanhe contatos e eventos do primeiro interesse até o pós-evento.</p>
        </div>
        <button onClick={() => setModal(true)} className="rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-600">+ Novo lead</button>
      </div>

      {/* KPIs */}
      <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-5">
        <Kpi label="Total" value={kpis.total} />
        <Kpi label="Negociando" value={kpis.negociando} tone="amber" />
        <Kpi label="Contratados" value={kpis.contratados} tone="emerald" />
        <Kpi label="Finalizados" value={kpis.finalizados} tone="blue" />
        <Kpi label="Perdidos" value={kpis.perdidos} tone="red" />
      </div>

      {/* Filtros */}
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <select value={fStatus} onChange={(e) => setFStatus(e.target.value)} className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm focus:border-brand focus:outline-none">
          <option value="">Todos os status</option>
          {STATUS.map((s) => <option key={s.v} value={s.v}>{s.label}</option>)}
        </select>
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por evento ou cliente…" className="min-w-[220px] flex-1 rounded-xl border border-black/10 px-3.5 py-2 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20" />
      </div>

      {/* Lista */}
      <div className="mt-4 rounded-2xl bg-white p-5 shadow-card">
        {filtrados.length === 0 ? (
          <div className="py-12 text-center text-sm text-ink-muted">
            Nenhum lead {fStatus || busca ? 'com esse filtro' : 'ainda'}. Use <strong>+ Novo lead</strong> para registrar um contato.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-black/[0.06] text-left text-xs text-ink-muted">
                  <th className="pb-2 font-semibold">Evento</th>
                  <th className="pb-2 font-semibold">Cliente</th>
                  <th className="pb-2 font-semibold">Tipo</th>
                  <th className="pb-2 font-semibold">Data</th>
                  <th className="pb-2 font-semibold">Status</th>
                  <th className="pb-2" />
                </tr>
              </thead>
              <tbody>
                {filtrados.map((l) => {
                  const grupo = STATUS_BY_V[l.status || 'lead']?.grupo || 'negociando';
                  return (
                    <tr key={String(l.id)} className="border-b border-black/[0.04]">
                      <td className="py-2.5 font-semibold text-ink">{l.nome_evento || '—'}</td>
                      <td className="py-2.5 text-ink-soft">{l.quem_contratou || '—'}</td>
                      <td className="py-2.5 text-ink-muted">{l.tipo_evento || '—'}</td>
                      <td className="py-2.5 text-ink-muted">{formatDateRange(l.data_inicio, l.data_fim) || '—'}</td>
                      <td className="py-2.5">
                        <select
                          value={l.status || 'lead'}
                          onChange={(e) => mudarStatus(l.id, e.target.value)}
                          className={`rounded-full border px-2.5 py-1 text-xs font-semibold focus:outline-none ${GRUPO_CLS[grupo]}`}
                        >
                          {STATUS.map((s) => <option key={s.v} value={s.v}>{s.label}</option>)}
                        </select>
                      </td>
                      <td className="py-2.5 pl-2 text-right">
                        <button onClick={() => excluir(l.id)} title="Excluir" className="text-ink-muted hover:text-red-600">✕</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal novo lead */}
      {modal && (
        <div className="fixed inset-0 z-[10000] flex items-start justify-center overflow-y-auto bg-black/50 p-4">
          <div className="relative my-8 w-full max-w-md rounded-2xl bg-white p-6 shadow-pop">
            <button onClick={() => setModal(false)} className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full border border-black/10 text-ink-muted hover:bg-black/[0.03]">✕</button>
            <h3 className="mb-5 font-display text-xl font-bold text-ink">Novo lead</h3>
            <div className="space-y-4">
              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold text-ink-soft">Nome do evento</span>
                <input value={nNome} onChange={(e) => setNNome(e.target.value)} className={inp} placeholder="Ex: Casamento Silva" autoFocus />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold text-ink-soft">Quem contratou</span>
                <input value={nQuem} onChange={(e) => setNQuem(e.target.value)} className={inp} placeholder="Nome do cliente" />
              </label>
              <div className="grid grid-cols-2 gap-4">
                <label className="block">
                  <span className="mb-1.5 block text-sm font-semibold text-ink-soft">Tipo</span>
                  <select value={nTipo} onChange={(e) => setNTipo(e.target.value)} className={inp}>
                    {TIPOS.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-sm font-semibold text-ink-soft">Status</span>
                  <select value={nStatus} onChange={(e) => setNStatus(e.target.value)} className={inp}>
                    {STATUS.map((s) => <option key={s.v} value={s.v}>{s.label}</option>)}
                  </select>
                </label>
              </div>
            </div>
            <div className="mt-6 flex items-center gap-3">
              <button onClick={criar} disabled={saving || !nNome.trim() || !nQuem.trim()} className="rounded-xl bg-brand px-6 py-3 text-sm font-bold text-white transition hover:bg-brand-600 disabled:opacity-60">
                {saving ? 'Criando…' : 'Criar lead'}
              </button>
              <button onClick={() => setModal(false)} className="ml-auto text-sm font-medium text-ink-muted hover:text-ink">Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const inp = 'w-full rounded-xl border border-black/10 px-3.5 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20';

function Kpi({ label, value, tone }: { label: string; value: number; tone?: 'amber' | 'emerald' | 'blue' | 'red' }) {
  const color = tone === 'amber' ? 'text-amber-600' : tone === 'emerald' ? 'text-emerald-600' : tone === 'blue' ? 'text-blue-600' : tone === 'red' ? 'text-red-600' : 'text-ink';
  return (
    <div className="rounded-2xl bg-white p-4 shadow-card">
      <div className="text-xs text-ink-muted">{label}</div>
      <div className={`mt-2 text-xl font-bold ${color}`}>{value}</div>
    </div>
  );
}
