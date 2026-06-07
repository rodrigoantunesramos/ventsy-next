'use client';

// Equipe — /painel/equipe.
// Gestão de equipe (roster) sobre a NOVA tabela `equipe` (escopada por dono).
// Substitui o legado mock; NÃO usa a tabela `funcionarios` (é do FoodSy).
// Follow-up: motor de folha/encargos BR (INSS/FGTS) — hiper-local, fora do core global.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabaseAny as sb } from '@/lib/supabase';
import { formatMoneyShort } from '@/lib/format';

type Func = {
  id: number; nome: string; cargo: string | null; departamento: string | null;
  salario: number; contrato: string; status: string; admissao: string | null; telefone: string | null; obs: string | null;
};

const CONTRATOS = [{ v: 'clt', l: 'CLT' }, { v: 'horista', l: 'Horista' }, { v: 'mei', l: 'MEI/PJ' }, { v: 'estagio', l: 'Estágio' }];
const STATUS = [{ v: 'ativo', l: 'Ativo', c: 'bg-emerald-50 text-emerald-700' }, { v: 'ferias', l: 'Férias', c: 'bg-blue-50 text-blue-700' }, { v: 'afastado', l: 'Afastado', c: 'bg-amber-50 text-amber-700' }];
const STATUS_C = Object.fromEntries(STATUS.map((s) => [s.v, s]));
const AVATAR_CORES = ['#0ca678', '#f59e0b', '#ff385c', '#8b5cf6', '#1a73e8', '#fb923c', '#e879f9'];
const EMPTY = { nome: '', cargo: '', departamento: 'Operações', salario: '', contrato: 'clt', status: 'ativo', admissao: '', telefone: '', obs: '' };

function inicial(n: string) { return n.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase(); }

export default function EquipePage() {
  const [loading, setLoading] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [team, setTeam] = useState<Func[]>([]);
  const [fStatus, setFStatus] = useState('todos');
  const [busca, setBusca] = useState('');

  const [modal, setModal] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({ ...EMPTY });
  const [saving, setSaving] = useState(false);

  const carregar = useCallback(async (uid: string) => {
    const { data, error } = await sb.from('equipe').select('*').eq('usuario_id', uid).order('nome');
    if (error) { setNeedsSetup(true); setTeam([]); return; }
    setNeedsSetup(false);
    setTeam((data || []).map((r: Func) => ({ ...r, salario: Number(r.salario) || 0 })) as Func[]);
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

  const kpis = useMemo(() => {
    const ativos = team.filter((e) => e.status === 'ativo');
    const folha = team.filter((e) => e.status !== 'afastado' && e.contrato !== 'mei').reduce((s, e) => s + (e.salario || 0), 0);
    return { total: team.length, ativos: ativos.length, folha, depts: new Set(team.map((e) => e.departamento).filter(Boolean)).size };
  }, [team]);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return team.filter((e) => {
      if (fStatus !== 'todos' && e.status !== fStatus && e.contrato !== fStatus) return false;
      if (q && !(`${e.nome} ${e.cargo || ''} ${e.departamento || ''}`.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [team, fStatus, busca]);

  function abrirNovo() { setEditId(null); setForm({ ...EMPTY, admissao: new Date().toISOString().split('T')[0] }); setModal(true); }
  function abrirEdit(e: Func) {
    setEditId(e.id);
    setForm({ nome: e.nome, cargo: e.cargo || '', departamento: e.departamento || 'Operações', salario: e.salario ? String(e.salario) : '', contrato: e.contrato || 'clt', status: e.status || 'ativo', admissao: e.admissao || '', telefone: e.telefone || '', obs: e.obs || '' });
    setModal(true);
  }

  async function salvar() {
    if (!userId || !form.nome.trim()) return;
    setSaving(true);
    const payload = {
      nome: form.nome.trim(), cargo: form.cargo || null, departamento: form.departamento || null,
      salario: form.salario ? Number(form.salario) : 0, contrato: form.contrato, status: form.status,
      admissao: form.admissao || null, telefone: form.telefone || null, obs: form.obs || null,
    };
    let error;
    if (editId) ({ error } = await sb.from('equipe').update(payload).eq('id', editId).eq('usuario_id', userId));
    else ({ error } = await sb.from('equipe').insert({ ...payload, usuario_id: userId }));
    setSaving(false);
    if (!error) { setModal(false); await carregar(userId); }
  }

  async function excluir(id: number) {
    if (!userId || !confirm('Remover este colaborador?')) return;
    await sb.from('equipe').delete().eq('id', id).eq('usuario_id', userId);
    setTeam((arr) => arr.filter((e) => e.id !== id));
  }

  if (loading) return <div className="mx-auto h-[480px] max-w-6xl animate-pulse rounded-2xl bg-black/[0.05]" />;

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink sm:text-2xl">Equipe</h1>
          <p className="mt-1 text-sm text-ink-muted">Gerencie os colaboradores do seu espaço.</p>
        </div>
        <button onClick={abrirNovo} className="rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-600">+ Novo colaborador</button>
      </div>

      {needsSetup && <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">A tabela de equipe ainda não foi criada no banco. Aplique a migration <code>equipe</code> para começar.</div>}

      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Colaboradores" value={String(kpis.total)} />
        <Kpi label="Ativos" value={String(kpis.ativos)} color="text-emerald-600" />
        <Kpi label="Folha mensal" value={formatMoneyShort(kpis.folha)} color="text-amber-600" />
        <Kpi label="Departamentos" value={String(kpis.depts)} color="text-blue-600" />
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <select value={fStatus} onChange={(e) => setFStatus(e.target.value)} className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm focus:border-brand focus:outline-none">
          <option value="todos">Todos</option>
          {STATUS.map((s) => <option key={s.v} value={s.v}>{s.l}</option>)}
        </select>
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome, cargo, depto…" className="min-w-[220px] flex-1 rounded-xl border border-black/10 px-3.5 py-2 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20" />
      </div>

      {filtrados.length === 0 ? (
        <div className="mt-6 rounded-2xl bg-white p-12 text-center text-sm text-ink-muted shadow-card">
          Nenhum colaborador {fStatus !== 'todos' || busca ? 'com esse filtro' : 'ainda'}. Use <strong>+ Novo colaborador</strong>.
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtrados.map((e, i) => {
            const st = STATUS_C[e.status] || STATUS[0];
            return (
              <div key={e.id} className="rounded-2xl bg-white p-5 shadow-card">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full text-sm font-bold text-white" style={{ background: AVATAR_CORES[i % AVATAR_CORES.length] }}>{inicial(e.nome)}</div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-bold text-ink">{e.nome}</div>
                    <div className="truncate text-xs text-ink-muted">{e.cargo || '—'}{e.departamento ? ` · ${e.departamento}` : ''}</div>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${st.c}`}>{st.l}</span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <Cel t="Contrato" v={CONTRATOS.find((c) => c.v === e.contrato)?.l || e.contrato} />
                  <Cel t="Salário" v={e.contrato === 'mei' ? 'por evento' : formatMoneyShort(e.salario)} />
                  <Cel t="Telefone" v={e.telefone || '—'} />
                  <Cel t="Admissão" v={e.admissao ? e.admissao.split('-').reverse().join('/') : '—'} />
                </div>
                <div className="mt-3 flex border-t border-black/[0.06] pt-2 text-xs">
                  <button onClick={() => abrirEdit(e)} className="flex-1 py-1.5 font-semibold text-ink-soft hover:text-brand">Editar</button>
                  <div className="w-px bg-black/[0.06]" />
                  <button onClick={() => excluir(e.id)} className="flex-1 py-1.5 font-semibold text-red-600 hover:text-red-700">Excluir</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 z-[10000] flex items-start justify-center overflow-y-auto bg-black/50 p-4">
          <div className="relative my-8 w-full max-w-lg rounded-2xl bg-white p-6 shadow-pop">
            <button onClick={() => setModal(false)} className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full border border-black/10 text-ink-muted hover:bg-black/[0.03]">✕</button>
            <h3 className="mb-5 font-display text-xl font-bold text-ink">{editId ? 'Editar colaborador' : 'Novo colaborador'}</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Campo label="Nome" full><input className={inp} value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} autoFocus /></Campo>
              <Campo label="Cargo"><input className={inp} value={form.cargo} onChange={(e) => setForm({ ...form, cargo: e.target.value })} /></Campo>
              <Campo label="Departamento"><input className={inp} value={form.departamento} onChange={(e) => setForm({ ...form, departamento: e.target.value })} /></Campo>
              <Campo label="Salário (R$)"><input type="number" min={0} className={inp} value={form.salario} onChange={(e) => setForm({ ...form, salario: e.target.value })} /></Campo>
              <Campo label="Contrato"><select className={inp} value={form.contrato} onChange={(e) => setForm({ ...form, contrato: e.target.value })}>{CONTRATOS.map((c) => <option key={c.v} value={c.v}>{c.l}</option>)}</select></Campo>
              <Campo label="Status"><select className={inp} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>{STATUS.map((s) => <option key={s.v} value={s.v}>{s.l}</option>)}</select></Campo>
              <Campo label="Admissão"><input type="date" className={inp} value={form.admissao} onChange={(e) => setForm({ ...form, admissao: e.target.value })} /></Campo>
              <Campo label="Telefone" full><input className={inp} value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} /></Campo>
              <Campo label="Observações" full><textarea className={`${inp} min-h-[70px]`} value={form.obs} onChange={(e) => setForm({ ...form, obs: e.target.value })} /></Campo>
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
function Kpi({ label, value, color = 'text-ink' }: { label: string; value: string; color?: string }) {
  return <div className="rounded-2xl bg-white p-4 shadow-card"><div className="text-xs text-ink-muted">{label}</div><div className={`mt-2 text-xl font-bold ${color}`}>{value}</div></div>;
}
function Cel({ t, v }: { t: string; v: string }) {
  return <div><div className="text-ink-muted">{t}</div><div className="font-semibold text-ink-soft">{v}</div></div>;
}
function Campo({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return <label className={`block ${full ? 'sm:col-span-2' : ''}`}><span className="mb-1.5 block text-sm font-semibold text-ink-soft">{label}</span>{children}</label>;
}
