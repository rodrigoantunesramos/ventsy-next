'use client';

// Financeiro — /painel/financeiro.
// Substitui o módulo legado 100% MOCKADO por um financeiro real sobre a tabela
// `lancamentos` (receitas/despesas do dono). KPIs/categorias calculados dos dados.
// Requer a migration de `lancamentos` (ver tarefa). Tudo via lib/format (sem hardcode R$).

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabaseAny as sb } from '@/lib/supabase';
import { formatMoney, formatMoneyShort, formatDate } from '@/lib/format';

type Tipo = 'receita' | 'despesa';
type Status = 'pago' | 'pendente' | 'atrasado';
type Lancamento = {
  id: number;
  tipo: Tipo;
  categoria: string | null;
  descricao: string | null;
  valor: number;
  status: Status;
  data: string;
};

type Periodo = 'mes' | 'trimestre' | 'ano';
type Filtro = 'todos' | 'receita' | 'despesa' | 'pendente';

const CATEGORIAS = ['Aluguel de Espaço', 'Buffet / Catering', 'Decoração', 'Som / Iluminação', 'Manutenção', 'Limpeza', 'Impostos', 'Marketing', 'Outros'];
const STATUS_LABEL: Record<Status, string> = { pago: 'Pago', pendente: 'Pendente', atrasado: 'Atrasado' };
const STATUS_CLS: Record<Status, string> = {
  pago: 'bg-emerald-50 text-emerald-700',
  pendente: 'bg-amber-50 text-amber-700',
  atrasado: 'bg-red-50 text-red-700',
};

function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function periodoRange(p: Periodo): [string, string] {
  const now = new Date(); const y = now.getFullYear(); const m = now.getMonth();
  if (p === 'ano') return [`${y}-01-01`, `${y}-12-31`];
  if (p === 'trimestre') return [ymd(new Date(y, m - 2, 1)), ymd(new Date(y, m + 1, 0))];
  return [ymd(new Date(y, m, 1)), ymd(new Date(y, m + 1, 0))];
}

export default function FinanceiroPage() {
  const [loading, setLoading] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [periodo, setPeriodo] = useState<Periodo>('mes');
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [itens, setItens] = useState<Lancamento[]>([]);

  // modal
  const [modal, setModal] = useState<null | Tipo>(null);
  const [fData, setFData] = useState('');
  const [fValor, setFValor] = useState('');
  const [fDesc, setFDesc] = useState('');
  const [fCat, setFCat] = useState(CATEGORIAS[0]);
  const [fStatus, setFStatus] = useState<Status>('pago');
  const [saving, setSaving] = useState(false);

  const carregar = useCallback(async (uid: string, p: Periodo) => {
    const [ini, fim] = periodoRange(p);
    const { data, error } = await sb
      .from('lancamentos')
      .select('id,tipo,categoria,descricao,valor,status,data')
      .eq('usuario_id', uid)
      .gte('data', ini)
      .lte('data', fim)
      .order('data', { ascending: false });
    if (error) { setNeedsSetup(true); setItens([]); return; }
    setNeedsSetup(false);
    // numeric/bigint podem voltar como string do PostgREST → coagir
    setItens((data || []).map((r: Lancamento) => ({ ...r, id: Number(r.id), valor: Number(r.valor) })) as Lancamento[]);
  }, []);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await sb.auth.getSession();
      if (!session) { setLoading(false); return; }
      setUserId(session.user.id);
      await carregar(session.user.id, periodo);
      setLoading(false);
    })();
  }, [carregar, periodo]);

  const kpis = useMemo(() => {
    const receita = itens.filter((t) => t.tipo === 'receita').reduce((s, t) => s + (t.valor || 0), 0);
    const despesa = itens.filter((t) => t.tipo === 'despesa').reduce((s, t) => s + (t.valor || 0), 0);
    return { receita, despesa, lucro: receita - despesa, count: itens.length };
  }, [itens]);

  const porCategoria = useMemo(() => {
    const map = new Map<string, number>();
    itens.filter((t) => t.tipo === 'receita').forEach((t) => {
      const k = t.categoria || 'Outros';
      map.set(k, (map.get(k) || 0) + (t.valor || 0));
    });
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [itens]);
  const maxCat = porCategoria[0]?.[1] || 1;

  const filtrados = useMemo(() => {
    if (filtro === 'todos') return itens;
    if (filtro === 'pendente') return itens.filter((t) => t.status !== 'pago');
    return itens.filter((t) => t.tipo === filtro);
  }, [itens, filtro]);

  function abrirModal(tipo: Tipo) {
    setModal(tipo);
    setFData(ymd(new Date()));
    setFValor(''); setFDesc(''); setFCat(CATEGORIAS[0]); setFStatus('pago');
  }

  async function salvar() {
    if (!userId || !modal) return;
    const valor = Number(fValor);
    if (!valor || valor <= 0) return;
    setSaving(true);
    const { error } = await sb.from('lancamentos').insert({
      usuario_id: userId, tipo: modal, categoria: fCat, descricao: fDesc || null,
      valor, status: fStatus, data: fData,
    });
    setSaving(false);
    if (!error) { setModal(null); if (userId) await carregar(userId, periodo); }
  }

  async function remover(id: number) {
    if (!userId) return;
    await sb.from('lancamentos').delete().eq('id', id);
    setItens((arr) => arr.filter((t) => t.id !== id));
  }

  if (loading) return <div className="mx-auto h-[480px] max-w-6xl animate-pulse rounded-2xl bg-black/[0.05]" />;

  return (
    <div className="mx-auto max-w-6xl">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink sm:text-2xl">Financeiro</h1>
          <p className="mt-1 text-sm text-ink-muted">Receitas, despesas e resultado do seu espaço.</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={periodo} onChange={(e) => setPeriodo(e.target.value as Periodo)} className="rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm focus:border-brand focus:outline-none">
            <option value="mes">Este mês</option>
            <option value="trimestre">Trimestre</option>
            <option value="ano">Este ano</option>
          </select>
          <button onClick={() => abrirModal('despesa')} className="rounded-xl border border-black/10 px-4 py-2.5 text-sm font-semibold text-ink-soft hover:border-red-300 hover:text-red-600">+ Despesa</button>
          <button onClick={() => abrirModal('receita')} className="rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-600">+ Receita</button>
        </div>
      </div>

      {needsSetup && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          A tabela financeira ainda não foi criada no banco. Os lançamentos aparecerão aqui assim que a migration <code>lancamentos</code> for aplicada.
        </div>
      )}

      {/* KPIs */}
      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Receita" value={formatMoneyShort(kpis.receita)} tone="verde" />
        <Kpi label="Despesas" value={formatMoneyShort(kpis.despesa)} tone="vermelho" />
        <Kpi label="Lucro líquido" value={formatMoneyShort(kpis.lucro)} tone="gold" />
        <Kpi label="Lançamentos" value={String(kpis.count)} tone="azul" />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-[1fr_320px]">
        {/* Lançamentos */}
        <div className="rounded-2xl bg-white p-5 shadow-card">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h3 className="text-base font-bold text-ink">Lançamentos</h3>
            <div className="flex gap-1">
              {(['todos', 'receita', 'despesa', 'pendente'] as Filtro[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setFiltro(f)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold capitalize transition ${
                    filtro === f ? 'bg-ink text-white' : 'bg-black/[0.04] text-ink-muted hover:bg-black/[0.07]'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          {filtrados.length === 0 ? (
            <div className="py-12 text-center text-sm text-ink-muted">
              Nenhum lançamento neste período. Use <strong>+ Receita</strong> ou <strong>+ Despesa</strong> para começar.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-black/[0.06] text-left text-xs text-ink-muted">
                    <th className="pb-2 font-semibold">Data</th>
                    <th className="pb-2 font-semibold">Descrição</th>
                    <th className="pb-2 font-semibold">Categoria</th>
                    <th className="pb-2 font-semibold">Status</th>
                    <th className="pb-2 text-right font-semibold">Valor</th>
                    <th className="pb-2" />
                  </tr>
                </thead>
                <tbody>
                  {filtrados.map((t) => (
                    <tr key={t.id} className="border-b border-black/[0.04]">
                      <td className="py-2.5 text-ink-muted">{formatDate(t.data, { style: 'short' })}</td>
                      <td className="py-2.5 font-medium text-ink-soft">{t.descricao || '—'}</td>
                      <td className="py-2.5 text-ink-muted">{t.categoria || '—'}</td>
                      <td className="py-2.5"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_CLS[t.status]}`}>{STATUS_LABEL[t.status]}</span></td>
                      <td className={`py-2.5 text-right font-bold ${t.tipo === 'receita' ? 'text-emerald-600' : 'text-red-600'}`}>
                        {t.tipo === 'receita' ? '+' : '−'}{formatMoney(t.valor)}
                      </td>
                      <td className="py-2.5 pl-2 text-right">
                        <button onClick={() => remover(t.id)} title="Remover" className="text-ink-muted hover:text-red-600">✕</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Receita por categoria */}
        <div className="rounded-2xl bg-white p-5 shadow-card">
          <h3 className="text-base font-bold text-ink">Receita por categoria</h3>
          {porCategoria.length === 0 ? (
            <p className="mt-3 text-sm text-ink-muted">Sem receitas no período.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {porCategoria.map(([cat, val]) => (
                <div key={cat}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="text-ink-soft">{cat}</span>
                    <span className="font-semibold text-ink-muted">{formatMoneyShort(val)}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-black/[0.06]">
                    <div className="h-full rounded-full bg-brand" style={{ width: `${Math.round((val / maxCat) * 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 z-[10000] flex items-start justify-center overflow-y-auto bg-black/50 p-4">
          <div className="relative my-8 w-full max-w-md rounded-2xl bg-white p-6 shadow-pop">
            <button onClick={() => setModal(null)} className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full border border-black/10 text-ink-muted hover:bg-black/[0.03]">✕</button>
            <h3 className="mb-5 font-display text-xl font-bold text-ink">{modal === 'receita' ? 'Nova Receita' : 'Nova Despesa'}</h3>
            <div className="space-y-4">
              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold text-ink-soft">Valor (R$)</span>
                <input type="number" min={0} step="0.01" value={fValor} onChange={(e) => setFValor(e.target.value)} className={inp} autoFocus />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold text-ink-soft">Descrição</span>
                <input value={fDesc} onChange={(e) => setFDesc(e.target.value)} className={inp} placeholder="Ex: Casamento Silva — Salão Principal" />
              </label>
              <div className="grid grid-cols-2 gap-4">
                <label className="block">
                  <span className="mb-1.5 block text-sm font-semibold text-ink-soft">Categoria</span>
                  <select value={fCat} onChange={(e) => setFCat(e.target.value)} className={inp}>
                    {CATEGORIAS.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-sm font-semibold text-ink-soft">Data</span>
                  <input type="date" value={fData} onChange={(e) => setFData(e.target.value)} className={inp} />
                </label>
              </div>
              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold text-ink-soft">Status</span>
                <select value={fStatus} onChange={(e) => setFStatus(e.target.value as Status)} className={inp}>
                  <option value="pago">Pago</option>
                  <option value="pendente">Pendente</option>
                  <option value="atrasado">Atrasado</option>
                </select>
              </label>
            </div>
            <div className="mt-6 flex items-center gap-3">
              <button onClick={salvar} disabled={saving || !fValor} className="rounded-xl bg-brand px-6 py-3 text-sm font-bold text-white transition hover:bg-brand-600 disabled:opacity-60">
                {saving ? 'Salvando…' : 'Salvar lançamento'}
              </button>
              <button onClick={() => setModal(null)} className="ml-auto text-sm font-medium text-ink-muted hover:text-ink">Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const inp = 'w-full rounded-xl border border-black/10 px-3.5 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20';

function Kpi({ label, value, tone }: { label: string; value: string; tone: 'verde' | 'vermelho' | 'gold' | 'azul' }) {
  const color = tone === 'verde' ? 'text-emerald-600' : tone === 'vermelho' ? 'text-red-600' : tone === 'gold' ? 'text-amber-600' : 'text-blue-600';
  return (
    <div className="rounded-2xl bg-white p-4 shadow-card">
      <div className="text-xs text-ink-muted">{label}</div>
      <div className={`mt-2 text-xl font-bold ${color}`}>{value}</div>
    </div>
  );
}
