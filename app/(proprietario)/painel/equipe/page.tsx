'use client';

// Equipe — /painel/equipe.
// Gestão de equipe + motor de folha/encargos BR (CLT/Horista/MEI/Estágio).
// Tabela `equipe` escopada por usuario_id. Sem hardcode de "R$" — usa lib/format.

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { supabaseAny as sb } from '@/lib/supabase';
import { formatMoney, formatMoneyShort } from '@/lib/format';

// ─── Types ────────────────────────────────────────────────────────────────────
type Func = {
  id: number; nome: string; cargo: string | null; departamento: string | null;
  salario: number; contrato: string; status: string; admissao: string | null;
  telefone: string | null; obs: string | null;
};

type ChargeSet = Record<string, number>;
type Charges = { clt: ChargeSet; horista: ChargeSet; estagio: ChargeSet };
type TabId = 'equipe' | 'folha' | 'encargos';

// ─── Constants ────────────────────────────────────────────────────────────────
const CONTRATOS = [
  { v: 'clt', l: 'CLT' },
  { v: 'horista', l: 'Horista' },
  { v: 'mei', l: 'MEI/PJ' },
  { v: 'estagio', l: 'Estágio' },
];

const STATUS_LIST = [
  { v: 'ativo',    l: 'Ativo',    c: 'bg-emerald-50 text-emerald-700' },
  { v: 'ferias',   l: 'Férias',   c: 'bg-blue-50 text-blue-700' },
  { v: 'afastado', l: 'Afastado', c: 'bg-amber-50 text-amber-700' },
];
const STATUS_MAP  = Object.fromEntries(STATUS_LIST.map((s) => [s.v, s]));
const CONTRATO_MAP = Object.fromEntries(CONTRATOS.map((c) => [c.v, c.l]));
const AVATAR_CORES = ['#0ca678', '#f59e0b', '#ff385c', '#8b5cf6', '#1a73e8', '#fb923c'];

const DEFAULT_CHARGES: Charges = {
  clt: {
    inss: 20, fgts: 8, rat: 2, terceiros: 5.8,
    ferias: 11.11, decimoTerceiro: 8.33,
    valeTransporte: 6, valeAlimentacao: 10, planoSaude: 8, outros: 0,
  },
  horista: { inss: 20, fgts: 8, rat: 2, terceiros: 5.8, outros: 0 },
  estagio: { outros: 0 },
};

const CHARGE_LABELS: Record<string, string> = {
  inss: 'INSS Patronal', fgts: 'FGTS', rat: 'RAT (Risco)', terceiros: 'Terceiros (Sistema S)',
  ferias: 'Férias + 1/3', decimoTerceiro: '13º Salário',
  valeTransporte: 'Vale Transporte', valeAlimentacao: 'Vale Alimentação',
  planoSaude: 'Plano de Saúde', outros: 'Outros',
};

const EMPTY = {
  nome: '', cargo: '', departamento: 'Operações', salario: '', contrato: 'clt',
  status: 'ativo', admissao: '', telefone: '', obs: '',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
function inicial(n: string) {
  return n.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}

function calcCusto(salario: number, contrato: string, charges: Charges) {
  if (contrato === 'mei' || contrato === 'estagio') return { salario, encargos: 0, total: salario };
  const chargeSet = charges[contrato as keyof Charges] ?? charges.clt;
  const encargos = Object.values(chargeSet).reduce((s, p) => s + salario * (p / 100), 0);
  return { salario, encargos, total: salario + encargos };
}

function tenure(admissao: string | null): string {
  if (!admissao) return '—';
  const ms = Date.now() - new Date(admissao + 'T12:00:00').getTime();
  const months = Math.floor(ms / (1000 * 60 * 60 * 24 * 30.44));
  if (months < 1) return 'Novo';
  if (months < 12) return `${months}m`;
  const y = Math.floor(months / 12); const m = months % 12;
  return m ? `${y}a ${m}m` : `${y}a`;
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function EquipePage() {
  const [loading,    setLoading]    = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [userId,     setUserId]     = useState<string | null>(null);
  const [team,       setTeam]       = useState<Func[]>([]);
  const [tab,        setTab]        = useState<TabId>('equipe');
  const [fStatus,    setFStatus]    = useState('todos');
  const [fContrato,  setFContrato]  = useState('todos');
  const [busca,      setBusca]      = useState('');
  const [charges,    setCharges]    = useState<Charges>(DEFAULT_CHARGES);

  const [modal,   setModal]   = useState(false);
  const [editId,  setEditId]  = useState<number | null>(null);
  const [form,    setForm]    = useState({ ...EMPTY });
  const [saving,  setSaving]  = useState(false);

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
    const ativos = team.filter((e) => e.status === 'ativo').length;
    const folha  = team
      .filter((e) => e.status !== 'afastado' && e.contrato !== 'mei')
      .reduce((s, e) => s + e.salario, 0);
    const { encargos, custo } = team
      .filter((e) => e.status !== 'afastado')
      .reduce(
        (acc, e) => {
          const c = calcCusto(e.salario, e.contrato, charges);
          return { encargos: acc.encargos + c.encargos, custo: acc.custo + c.total };
        },
        { encargos: 0, custo: 0 },
      );
    const depts = new Set(team.map((e) => e.departamento).filter(Boolean)).size;
    return { total: team.length, ativos, folha, encargos, custo, depts };
  }, [team, charges]);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return team.filter((e) => {
      if (fStatus   !== 'todos' && e.status   !== fStatus)   return false;
      if (fContrato !== 'todos' && e.contrato !== fContrato) return false;
      if (q && !(`${e.nome} ${e.cargo ?? ''} ${e.departamento ?? ''}`).toLowerCase().includes(q)) return false;
      return true;
    });
  }, [team, fStatus, fContrato, busca]);

  function abrirNovo() {
    setEditId(null);
    setForm({ ...EMPTY, admissao: new Date().toISOString().split('T')[0] });
    setModal(true);
  }

  function abrirEdit(e: Func) {
    setEditId(e.id);
    setForm({
      nome: e.nome, cargo: e.cargo ?? '', departamento: e.departamento ?? 'Operações',
      salario: e.salario ? String(e.salario) : '', contrato: e.contrato ?? 'clt',
      status: e.status ?? 'ativo', admissao: e.admissao ?? '', telefone: e.telefone ?? '', obs: e.obs ?? '',
    });
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
    else        ({ error } = await sb.from('equipe').insert({ ...payload, usuario_id: userId }));
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

      {/* ── Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink sm:text-2xl">Equipe</h1>
          <p className="mt-1 text-sm text-ink-muted">Colaboradores, folha de pagamento e encargos do seu espaço.</p>
        </div>
        <button onClick={abrirNovo} className="rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-600">
          + Novo colaborador
        </button>
      </div>

      {needsSetup && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          A tabela de equipe ainda não foi criada no banco. Aplique a migration <code>equipe</code> para começar.
        </div>
      )}

      {/* ── KPIs ── */}
      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Kpi label="Colaboradores"  value={String(kpis.total)}                    />
        <Kpi label="Ativos"         value={String(kpis.ativos)}   tone="verde"    />
        <Kpi label="Folha bruta"    value={formatMoneyShort(kpis.folha)}  tone="azul"  />
        <Kpi label="Encargos est."  value={formatMoneyShort(kpis.encargos)} tone="gold" />
        <Kpi label="Custo total"    value={formatMoneyShort(kpis.custo)}  tone="vermelho" />
      </div>

      {/* ── Tabs ── */}
      <div className="mt-6 flex gap-1 rounded-2xl bg-black/[0.04] p-1">
        {([
          ['equipe',   'Equipe'],
          ['folha',    'Folha de Pagamento'],
          ['encargos', 'Encargos'],
        ] as [TabId, string][]).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex-1 rounded-xl py-2 text-sm font-semibold transition ${
              tab === id ? 'bg-white text-ink shadow-sm' : 'text-ink-muted hover:text-ink'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ══════════════ TAB: EQUIPE ══════════════ */}
      {tab === 'equipe' && (
        <>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <select
              value={fStatus}
              onChange={(e) => setFStatus(e.target.value)}
              className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm focus:border-brand focus:outline-none"
            >
              <option value="todos">Status: Todos</option>
              {STATUS_LIST.map((s) => <option key={s.v} value={s.v}>{s.l}</option>)}
            </select>
            <select
              value={fContrato}
              onChange={(e) => setFContrato(e.target.value)}
              className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm focus:border-brand focus:outline-none"
            >
              <option value="todos">Contrato: Todos</option>
              {CONTRATOS.map((c) => <option key={c.v} value={c.v}>{c.l}</option>)}
            </select>
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por nome, cargo, depto…"
              className="min-w-[220px] flex-1 rounded-xl border border-black/10 px-3.5 py-2 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
            />
          </div>

          {filtrados.length === 0 ? (
            <div className="mt-6 rounded-2xl bg-white p-12 text-center text-sm text-ink-muted shadow-card">
              Nenhum colaborador {fStatus !== 'todos' || fContrato !== 'todos' || busca ? 'com esse filtro' : 'ainda'}.
              {' '}Use <strong>+ Novo colaborador</strong> para começar.
            </div>
          ) : (
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtrados.map((e, i) => {
                const st = STATUS_MAP[e.status] ?? STATUS_LIST[0];
                const { total: custo, encargos } = calcCusto(e.salario, e.contrato, charges);
                return (
                  <div key={e.id} className="rounded-2xl bg-white p-5 shadow-card">
                    <div className="flex items-start gap-3">
                      <div
                        className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                        style={{ background: AVATAR_CORES[i % AVATAR_CORES.length] }}
                      >
                        {inicial(e.nome)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-bold text-ink">{e.nome}</div>
                        <div className="truncate text-xs text-ink-muted">
                          {e.cargo ?? '—'}{e.departamento ? ` · ${e.departamento}` : ''}
                        </div>
                      </div>
                      <span className={`flex-shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${st.c}`}>
                        {st.l}
                      </span>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                      <Cel t="Contrato" v={CONTRATO_MAP[e.contrato] ?? e.contrato} />
                      <Cel t="Salário"  v={e.contrato === 'mei' ? 'por evento' : formatMoneyShort(e.salario)} />
                      {e.contrato !== 'mei' && encargos > 0
                        ? <Cel t="Custo real" v={formatMoneyShort(custo)} highlight />
                        : <Cel t="Na empresa" v={tenure(e.admissao)} />
                      }
                      <Cel t="Admissão" v={e.admissao ? e.admissao.split('-').reverse().join('/') : '—'} />
                    </div>

                    {e.obs && (
                      <div className="mt-2.5 rounded-lg bg-black/[0.03] px-2.5 py-1.5 text-xs italic text-ink-muted">
                        {e.obs}
                      </div>
                    )}

                    <div className="mt-3 flex border-t border-black/[0.06] pt-2 text-xs">
                      <button
                        onClick={() => abrirEdit(e)}
                        className="flex-1 py-1.5 font-semibold text-ink-soft hover:text-brand"
                      >
                        Editar
                      </button>
                      <div className="w-px bg-black/[0.06]" />
                      <button
                        onClick={() => excluir(e.id)}
                        className="flex-1 py-1.5 font-semibold text-red-600 hover:text-red-700"
                      >
                        Excluir
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ══════════════ TAB: FOLHA ══════════════ */}
      {tab === 'folha' && (
        <div className="mt-4 rounded-2xl bg-white p-5 shadow-card">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-bold text-ink">Folha de Pagamento</h3>
            <span className="text-xs text-ink-muted">
              Encargos estimados — configure em{' '}
              <button onClick={() => setTab('encargos')} className="font-semibold text-brand underline">
                Encargos
              </button>
            </span>
          </div>

          {team.length === 0 ? (
            <div className="py-12 text-center text-sm text-ink-muted">
              Nenhum colaborador cadastrado ainda.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-black/[0.06] text-left text-xs text-ink-muted">
                    <th className="pb-2.5 font-semibold">Nome</th>
                    <th className="pb-2.5 font-semibold">Contrato</th>
                    <th className="pb-2.5 font-semibold">Status</th>
                    <th className="pb-2.5 text-right font-semibold">Salário</th>
                    <th className="pb-2.5 text-right font-semibold">Encargos</th>
                    <th className="pb-2.5 text-right font-semibold text-ink">Custo total</th>
                  </tr>
                </thead>
                <tbody>
                  {team.map((e, i) => {
                    const { salario, encargos, total } = calcCusto(e.salario, e.contrato, charges);
                    const st = STATUS_MAP[e.status] ?? STATUS_LIST[0];
                    return (
                      <tr
                        key={e.id}
                        className={`border-b border-black/[0.04] ${e.status === 'afastado' ? 'opacity-50' : ''}`}
                      >
                        <td className="py-3">
                          <div className="flex items-center gap-2.5">
                            <div
                              className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                              style={{ background: AVATAR_CORES[i % AVATAR_CORES.length] }}
                            >
                              {inicial(e.nome)}
                            </div>
                            <div>
                              <div className="font-semibold text-ink">{e.nome}</div>
                              {e.cargo && <div className="text-xs text-ink-muted">{e.cargo}</div>}
                            </div>
                          </div>
                        </td>
                        <td className="py-3 text-ink-soft">{CONTRATO_MAP[e.contrato] ?? e.contrato}</td>
                        <td className="py-3">
                          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${st.c}`}>{st.l}</span>
                        </td>
                        <td className="py-3 text-right text-ink-soft">
                          {e.contrato === 'mei' ? <span className="text-ink-muted">—</span> : formatMoney(salario)}
                        </td>
                        <td className="py-3 text-right text-amber-600">
                          {encargos > 0 ? formatMoney(encargos) : <span className="text-ink-muted">—</span>}
                        </td>
                        <td className="py-3 text-right font-bold text-ink">{formatMoney(total)}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-black/[0.08]">
                    <td colSpan={3} className="pt-3 font-bold text-ink">Total</td>
                    <td className="pt-3 text-right font-bold text-ink">
                      {formatMoney(team.reduce((s, e) => s + (e.contrato !== 'mei' ? e.salario : 0), 0))}
                    </td>
                    <td className="pt-3 text-right font-bold text-amber-600">
                      {formatMoney(team.reduce((s, e) => s + calcCusto(e.salario, e.contrato, charges).encargos, 0))}
                    </td>
                    <td className="pt-3 text-right font-bold text-ink">
                      {formatMoney(team.reduce((s, e) => s + calcCusto(e.salario, e.contrato, charges).total, 0))}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ══════════════ TAB: ENCARGOS ══════════════ */}
      {tab === 'encargos' && (
        <div className="mt-4 space-y-4">
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            ⚠️ Recomendamos consultar seu contador para preencher esses valores. Os encargos variam por região, sindicato e regime tributário.
          </div>

          <button
            onClick={() => setCharges(DEFAULT_CHARGES)}
            className="rounded-xl bg-ink px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-ink/80"
          >
            🇧🇷 Usar padrão Brasil
          </button>

          <ChargeCard
            title="CLT — Funcionários registrados"
            charges={charges.clt}
            onChange={(key, val) => setCharges((prev) => ({ ...prev, clt: { ...prev.clt, [key]: val } }))}
          />
          <ChargeCard
            title="Horista — Contrato por hora"
            charges={charges.horista}
            onChange={(key, val) => setCharges((prev) => ({ ...prev, horista: { ...prev.horista, [key]: val } }))}
          />
          <div className="rounded-2xl bg-white p-5 shadow-card">
            <h4 className="font-bold text-ink">MEI / PJ</h4>
            <p className="mt-1 text-sm text-ink-muted">Profissionais MEI/PJ são responsáveis pelos próprios encargos. Sem custo patronal.</p>
          </div>
          <div className="rounded-2xl bg-white p-5 shadow-card">
            <h4 className="font-bold text-ink">Estágio</h4>
            <p className="mt-1 text-sm text-ink-muted">Estagiários não geram FGTS/INSS patronal. A bolsa-auxílio não compõe folha CLT.</p>
          </div>
        </div>
      )}

      {/* ── Modal ── */}
      {modal && (
        <div className="fixed inset-0 z-[10000] flex items-start justify-center overflow-y-auto bg-black/50 p-4">
          <div className="relative my-8 w-full max-w-lg rounded-2xl bg-white p-6 shadow-pop">
            <button
              onClick={() => setModal(false)}
              className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full border border-black/10 text-ink-muted hover:bg-black/[0.03]"
            >
              ✕
            </button>
            <h3 className="mb-5 font-display text-xl font-bold text-ink">
              {editId ? 'Editar colaborador' : 'Novo colaborador'}
            </h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Campo label="Nome" full>
                <input className={inp} value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} autoFocus />
              </Campo>
              <Campo label="Cargo">
                <input className={inp} value={form.cargo} onChange={(e) => setForm({ ...form, cargo: e.target.value })} />
              </Campo>
              <Campo label="Departamento">
                <input className={inp} value={form.departamento} onChange={(e) => setForm({ ...form, departamento: e.target.value })} />
              </Campo>
              <Campo label="Salário (R$)">
                <input type="number" min={0} className={inp} value={form.salario} onChange={(e) => setForm({ ...form, salario: e.target.value })} />
              </Campo>
              <Campo label="Contrato">
                <select className={inp} value={form.contrato} onChange={(e) => setForm({ ...form, contrato: e.target.value })}>
                  {CONTRATOS.map((c) => <option key={c.v} value={c.v}>{c.l}</option>)}
                </select>
              </Campo>
              <Campo label="Status">
                <select className={inp} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  {STATUS_LIST.map((s) => <option key={s.v} value={s.v}>{s.l}</option>)}
                </select>
              </Campo>
              <Campo label="Admissão">
                <input type="date" className={inp} value={form.admissao} onChange={(e) => setForm({ ...form, admissao: e.target.value })} />
              </Campo>
              <Campo label="Telefone">
                <input className={inp} value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} />
              </Campo>
              <Campo label="Observações" full>
                <textarea className={`${inp} min-h-[70px]`} value={form.obs} onChange={(e) => setForm({ ...form, obs: e.target.value })} />
              </Campo>
            </div>
            <div className="mt-6 flex items-center gap-3">
              <button
                onClick={salvar}
                disabled={saving || !form.nome.trim()}
                className="rounded-xl bg-brand px-6 py-3 text-sm font-bold text-white transition hover:bg-brand-600 disabled:opacity-60"
              >
                {saving ? 'Salvando…' : 'Salvar'}
              </button>
              <button onClick={() => setModal(false)} className="ml-auto text-sm font-medium text-ink-muted hover:text-ink">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────
const inp = 'w-full rounded-xl border border-black/10 px-3.5 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20';

function Kpi({ label, value, tone }: { label: string; value: string; tone?: 'verde' | 'vermelho' | 'gold' | 'azul' }) {
  const color =
    tone === 'verde'    ? 'text-emerald-600' :
    tone === 'vermelho' ? 'text-red-600'     :
    tone === 'gold'     ? 'text-amber-600'   :
    tone === 'azul'     ? 'text-blue-600'    : 'text-ink';
  return (
    <div className="rounded-2xl bg-white p-4 shadow-card">
      <div className="text-xs text-ink-muted">{label}</div>
      <div className={`mt-2 text-xl font-bold ${color}`}>{value}</div>
    </div>
  );
}

function Cel({ t, v, highlight }: { t: string; v: string; highlight?: boolean }) {
  return (
    <div>
      <div className="text-ink-muted">{t}</div>
      <div className={`font-semibold ${highlight ? 'text-amber-700' : 'text-ink-soft'}`}>{v}</div>
    </div>
  );
}

function Campo({ label, children, full }: { label: string; children: ReactNode; full?: boolean }) {
  return (
    <label className={`block ${full ? 'sm:col-span-2' : ''}`}>
      <span className="mb-1.5 block text-sm font-semibold text-ink-soft">{label}</span>
      {children}
    </label>
  );
}

function ChargeCard({
  title,
  charges,
  onChange,
}: {
  title: string;
  charges: ChargeSet;
  onChange: (key: string, val: number) => void;
}) {
  const totalPct = Object.values(charges).reduce((s, p) => s + p, 0);
  return (
    <div className="rounded-2xl bg-white p-5 shadow-card">
      <div className="mb-4 flex items-center justify-between">
        <h4 className="font-bold text-ink">{title}</h4>
        <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
          {totalPct.toFixed(2)}% do salário
        </span>
      </div>
      <div className="space-y-2.5">
        {Object.entries(charges).map(([key, val]) => (
          <div key={key} className="flex items-center justify-between gap-4">
            <span className="text-sm text-ink-soft">{CHARGE_LABELS[key] ?? key}</span>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                min={0}
                max={100}
                step={0.01}
                value={val}
                onChange={(e) => onChange(key, Number(e.target.value))}
                className="w-20 rounded-lg border border-black/10 px-3 py-1.5 text-right text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
              />
              <span className="text-sm text-ink-muted">%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
