'use client';

// Financeiro — /painel/financeiro  (SaaS premium completo).
// Dados reais via Supabase (`lancamentos`, `reservas`, `metas_financeiras`).
//
// PILAR 1 — Leitura instantânea: KPIs com ticket médio + margem % + sparkline,
//   projeção de fechamento do mês, gráfico combo (barras receita/despesa + linha de lucro).
// PILAR 2 — Fluxo de caixa: contas a receber com aging (a vencer / 0-30d / +30d),
//   a pagar, saldo a liquidar, status rápido (clique no badge).
// PILAR 3 — Pipeline → Receita: receita projetada de eventos confirmados,
//   pipeline por tipo de evento.
// TABELA: busca, ordenação por coluna, paginação, donut por categoria.
// LANÇAMENTO: observação, método de pagamento, vínculo com reserva, recorrência.
// METAS: customizáveis por período (persistidas), fallback para auto +10%.

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { supabaseAny as sb } from '@/lib/supabase';
import { formatMoney, formatMoneyShort, formatPercent, formatDate } from '@/lib/format';
import { useToast } from '@/components/Toast';

// ── Types ─────────────────────────────────────────────────────────────────────
type Tipo = 'receita' | 'despesa';
type Status = 'pago' | 'pendente' | 'atrasado';
type Lancamento = {
  id: number;
  tipo: Tipo;
  categoria: string | null;
  descricao: string | null;
  tipo_evento: string | null;
  valor: number;
  status: Status;
  data: string;
  observacao: string | null;
  metodo_pagamento: string | null;
  recorrente: boolean;
  reserva_id: string | null;
  prop_id: number | null;
};
type Periodo = 'mes' | 'trimestre' | 'ano';
type Filtro = 'todos' | 'receita' | 'despesa' | 'pendente';
type SortKey = 'data' | 'valor' | 'status';
type MesData = { mes: string; label: string; receita: number; despesa: number };
type Reserva = {
  id: string;
  nome: string | null;
  tipo_evento: string | null;
  data_inicio: string | null;
  valor_estimado: number | null;
  status: string;
};
type Prop = { id: number; nome: string | null };
type Meta = { metrica: string; periodo: string; alvo: number };

// ── Constants ─────────────────────────────────────────────────────────────────
const CATEGORIAS = [
  'Aluguel de Espaço', 'Buffet / Catering', 'Decoração', 'Som / Iluminação',
  'Manutenção', 'Limpeza', 'Impostos', 'Marketing', 'Outros',
];
const METODOS = ['Pix', 'Cartão de crédito', 'Cartão de débito', 'Transferência', 'Dinheiro', 'Boleto', 'Outro'];
const TIPOS_EVENTO = ['Casamento', 'Aniversário', 'Formatura', 'Corporativo', 'Confraternização', 'Outro'];
const STATUS_LABEL: Record<Status, string> = { pago: 'Pago', pendente: 'Pendente', atrasado: 'Atrasado' };
const STATUS_CLS: Record<Status, string> = {
  pago: 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100',
  pendente: 'bg-amber-50 text-amber-700 hover:bg-amber-100',
  atrasado: 'bg-red-50 text-red-700 hover:bg-red-100',
};
const STATUS_CICLO: Record<Status, Status> = { pago: 'pendente', pendente: 'atrasado', atrasado: 'pago' };
const MESES_PT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const EVT_STATUS: Record<string, { label: string; cls: string }> = {
  solicitada: { label: 'Solicitada', cls: 'bg-amber-100 text-amber-700' },
  aprovada: { label: 'Aprovada', cls: 'bg-emerald-100 text-emerald-700' },
  paga: { label: 'Paga', cls: 'bg-emerald-100 text-emerald-700' },
  confirmada: { label: 'Confirmada', cls: 'bg-blue-100 text-blue-700' },
};
const PIPELINE_STATUS = ['aprovada', 'paga', 'confirmada'];
const PALETTE = ['#ff385c', '#10b981', '#f59e0b', '#1a73e8', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#94a3b8'];
const PAGE_SIZE = 20;
const inp = 'w-full rounded-xl border border-black/10 px-3.5 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20';

// ── Helpers ───────────────────────────────────────────────────────────────────
function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function periodoRange(p: Periodo): [string, string] {
  const now = new Date(); const y = now.getFullYear(); const m = now.getMonth();
  if (p === 'ano') return [`${y}-01-01`, `${y}-12-31`];
  if (p === 'trimestre') return [ymd(new Date(y, m - 2, 1)), ymd(new Date(y, m + 1, 0))];
  return [ymd(new Date(y, m, 1)), ymd(new Date(y, m + 1, 0))];
}
function periodoPrevio(p: Periodo): [string, string] {
  const now = new Date(); const y = now.getFullYear(); const m = now.getMonth();
  if (p === 'ano') return [`${y - 1}-01-01`, `${y - 1}-12-31`];
  if (p === 'trimestre') return [ymd(new Date(y, m - 5, 1)), ymd(new Date(y, m - 2, 0))];
  return [ymd(new Date(y, m - 1, 1)), ymd(new Date(y, m, 0))];
}
function variacao(atual: number, anterior: number): number {
  if (anterior === 0) return atual > 0 ? 100 : 0;
  return Math.round(((atual - anterior) / Math.abs(anterior)) * 100);
}
function daysInMonth(y: number, m: number) { return new Date(y, m + 1, 0).getDate(); }
function diffDias(a: string, b: Date) {
  const da = new Date(a + 'T12:00:00');
  return Math.floor((b.getTime() - da.getTime()) / 86400000);
}
function buildChartBase(): MesData[] {
  const now = new Date();
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
    const mes = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    return { mes, label: MESES_PT[d.getMonth()], receita: 0, despesa: 0 };
  });
}
function exportCSV(itens: Lancamento[]) {
  const header = 'Data,Tipo,Categoria,Descrição,Tipo de evento,Método,Status,Valor\n';
  const esc = (s: string) => `"${(s || '').replace(/"/g, '""')}"`;
  const rows = itens
    .map((t) => [t.data, t.tipo, esc(t.categoria || ''), esc(t.descricao || ''), esc(t.tipo_evento || ''), esc(t.metodo_pagamento || ''), t.status, t.valor].join(','))
    .join('\n');
  const blob = new Blob(['﻿' + header + rows], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `financeiro-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click(); URL.revokeObjectURL(url);
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function FinanceiroPage() {
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [periodo, setPeriodo] = useState<Periodo>('mes');
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [busca, setBusca] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('data');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(0);
  const [catView, setCatView] = useState<Tipo>('receita');

  const [itens, setItens] = useState<Lancamento[]>([]);
  const [prevItens, setPrevItens] = useState<Lancamento[]>([]);
  const [chartData, setChartData] = useState<MesData[]>(buildChartBase());
  const [reservas, setReservas] = useState<Reserva[]>([]);
  const [props, setProps] = useState<Prop[]>([]);
  const [metas, setMetas] = useState<Meta[]>([]);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);

  // modal lançamento
  const [modal, setModal] = useState<null | { tipo: Tipo; editando?: Lancamento }>(null);
  const [fData, setFData] = useState('');
  const [fValor, setFValor] = useState('');
  const [fDesc, setFDesc] = useState('');
  const [fCat, setFCat] = useState(CATEGORIAS[0]);
  const [fStatus, setFStatus] = useState<Status>('pago');
  const [fEvento, setFEvento] = useState('');
  const [fMetodo, setFMetodo] = useState('');
  const [fObs, setFObs] = useState('');
  const [fReserva, setFReserva] = useState('');
  const [fRecorrente, setFRecorrente] = useState(false);
  const [fRepetir, setFRepetir] = useState('12');
  const [saving, setSaving] = useState(false);

  // modal metas
  const [goalsOpen, setGoalsOpen] = useState(false);
  const [gReceita, setGReceita] = useState('');
  const [gLucro, setGLucro] = useState('');
  const [gAdimpl, setGAdimpl] = useState('');
  const [gSaving, setGSaving] = useState(false);

  const carregar = useCallback(async (uid: string, p: Periodo) => {
    const [ini, fim] = periodoRange(p);
    const [prevIni, prevFim] = periodoPrevio(p);
    const now = new Date();
    const sixMonthsAgo = ymd(new Date(now.getFullYear(), now.getMonth() - 5, 1));

    const { data: propsData } = await sb.from('propriedades').select('id,nome').eq('usuario_id', uid);
    const propsList: Prop[] = (propsData || []).map((r: { id: number; nome: string | null }) => ({ id: Number(r.id), nome: r.nome }));
    const propIds = propsList.map((r) => r.id);
    setProps(propsList);

    const [mainRes, prevRes, chartRes, reservasRes, metasRes] = await Promise.all([
      sb.from('lancamentos')
        .select('id,tipo,categoria,descricao,tipo_evento,valor,status,data,observacao,metodo_pagamento,recorrente,reserva_id,prop_id')
        .eq('usuario_id', uid).gte('data', ini).lte('data', fim).order('data', { ascending: false }),
      sb.from('lancamentos').select('tipo,valor').eq('usuario_id', uid).gte('data', prevIni).lte('data', prevFim),
      sb.from('lancamentos').select('tipo,valor,data').eq('usuario_id', uid).gte('data', sixMonthsAgo).order('data'),
      propIds.length > 0
        ? sb.from('reservas').select('id,nome,tipo_evento,data_inicio,valor_estimado,status')
          .in('propriedade_id', propIds).order('data_inicio', { ascending: false }).limit(100)
        : Promise.resolve({ data: [] }),
      sb.from('metas_financeiras').select('metrica,periodo,alvo').eq('usuario_id', uid),
    ]);

    if (mainRes.error?.code === '42P01') { setNeedsSetup(true); setItens([]); return; }
    setNeedsSetup(false);

    const coerce = (r: Lancamento) => ({ ...r, id: Number(r.id), valor: Number(r.valor) });
    setItens((mainRes.data || []).map(coerce));
    setPrevItens(((prevRes.data || []) as Lancamento[]).map((r) => ({ ...r, valor: Number(r.valor) })));

    const base = buildChartBase();
    (chartRes.data || []).forEach((r: { tipo: string; valor: number; data: string }) => {
      const slot = base.find((b) => b.mes === r.data.slice(0, 7));
      if (!slot) return;
      if (r.tipo === 'receita') slot.receita += Number(r.valor);
      else slot.despesa += Number(r.valor);
    });
    setChartData(base);

    setReservas(((reservasRes.data || []) as Reserva[]).map((r) => ({ ...r, valor_estimado: r.valor_estimado != null ? Number(r.valor_estimado) : null })));
    setMetas(((metasRes.data || []) as Meta[]).map((m) => ({ ...m, alvo: Number(m.alvo) })));
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

  useEffect(() => { setPage(0); }, [filtro, busca, periodo]);

  // ── Derived ───────────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const rec = itens.filter((t) => t.tipo === 'receita');
    const receita = rec.reduce((s, t) => s + t.valor, 0);
    const despesa = itens.filter((t) => t.tipo === 'despesa').reduce((s, t) => s + t.valor, 0);
    const nAtrasado = itens.filter((t) => t.status === 'atrasado').length;
    const atrasado = itens.filter((t) => t.status === 'atrasado').reduce((s, t) => s + t.valor, 0);
    const lucro = receita - despesa;
    return {
      receita, despesa, lucro, count: itens.length,
      ticket: rec.length ? receita / rec.length : 0,
      margem: receita > 0 ? lucro / receita : 0,
      adimpl: itens.length ? itens.filter((t) => t.status === 'pago').length / itens.length : 0,
      nAtrasado, atrasado,
    };
  }, [itens]);

  const kpisPrev = useMemo(() => {
    const receita = prevItens.filter((t) => t.tipo === 'receita').reduce((s, t) => s + t.valor, 0);
    const despesa = prevItens.filter((t) => t.tipo === 'despesa').reduce((s, t) => s + t.valor, 0);
    return { receita, despesa, lucro: receita - despesa };
  }, [prevItens]);

  const projecao = useMemo(() => {
    if (periodo !== 'mes') return null;
    const now = new Date();
    const dia = now.getDate();
    const total = daysInMonth(now.getFullYear(), now.getMonth());
    if (dia >= total) return null;
    const f = total / dia;
    return { receita: kpis.receita * f, despesa: kpis.despesa * f, lucro: kpis.lucro * f };
  }, [periodo, kpis]);

  const sparks = useMemo(() => ({
    receita: chartData.map((d) => d.receita),
    despesa: chartData.map((d) => d.despesa),
    lucro: chartData.map((d) => d.receita - d.despesa),
  }), [chartData]);

  // Fluxo de caixa — contas a receber (aging) e a pagar
  const fluxo = useMemo(() => {
    const now = new Date();
    let aVencer = 0, venc030 = 0, venc30 = 0, aPagar = 0;
    itens.forEach((t) => {
      if (t.status === 'pago') return;
      if (t.tipo === 'receita') {
        const atraso = diffDias(t.data, now);
        if (atraso <= 0) aVencer += t.valor;
        else if (atraso <= 30) venc030 += t.valor;
        else venc30 += t.valor;
      } else {
        aPagar += t.valor;
      }
    });
    const aReceber = aVencer + venc030 + venc30;
    return { aVencer, venc030, venc30, aReceber, aPagar, saldo: aReceber - aPagar };
  }, [itens]);

  // Pipeline (reservas confirmadas futuras)
  const pipeline = useMemo(() => {
    const now = ymd(new Date());
    const futuras = reservas.filter((r) => r.data_inicio && r.data_inicio >= now && PIPELINE_STATUS.includes(r.status));
    const total = futuras.reduce((s, r) => s + (r.valor_estimado || 0), 0);
    const porTipo = new Map<string, number>();
    futuras.forEach((r) => {
      const k = r.tipo_evento || 'Outros';
      porTipo.set(k, (porTipo.get(k) || 0) + (r.valor_estimado || 0));
    });
    const proximos = [...futuras].sort((a, b) => (a.data_inicio || '').localeCompare(b.data_inicio || '')).slice(0, 5);
    return { total, porTipo: [...porTipo.entries()].sort((a, b) => b[1] - a[1]), proximos, count: futuras.length };
  }, [reservas]);

  const porCategoria = useMemo(() => {
    const map = new Map<string, number>();
    itens.filter((t) => t.tipo === catView).forEach((t) => {
      const k = t.categoria || 'Outros';
      map.set(k, (map.get(k) || 0) + t.valor);
    });
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [itens, catView]);

  const metaMap = useMemo(() => {
    const m = new Map<string, number>();
    metas.forEach((x) => m.set(`${x.metrica}:${x.periodo}`, x.alvo));
    return m;
  }, [metas]);

  const metasView = useMemo(() => {
    const alvo = (metrica: string, fallback: number) => metaMap.get(`${metrica}:${periodo}`) ?? fallback;
    return [
      { metrica: 'receita', nome: 'Meta de Receita', atual: kpis.receita, alvo: alvo('receita', kpisPrev.receita > 0 ? kpisPrev.receita * 1.1 : 10000), cor: '#10b981', fmt: (v: number) => formatMoneyShort(v) },
      { metrica: 'lucro', nome: 'Lucro Alvo', atual: Math.max(0, kpis.lucro), alvo: Math.max(alvo('lucro', kpisPrev.lucro > 0 ? kpisPrev.lucro * 1.1 : 5000), 1), cor: '#f59e0b', fmt: (v: number) => formatMoneyShort(v) },
      { metrica: 'adimplencia', nome: 'Taxa de Adimplência', atual: kpis.adimpl * 100, alvo: alvo('adimplencia', 90), cor: '#1a73e8', fmt: (v: number) => `${Math.round(v)}%` },
    ];
  }, [metaMap, periodo, kpis, kpisPrev]);

  const filtrados = useMemo(() => {
    let arr = itens;
    if (filtro === 'pendente') arr = arr.filter((t) => t.status !== 'pago');
    else if (filtro !== 'todos') arr = arr.filter((t) => t.tipo === filtro);
    const q = busca.trim().toLowerCase();
    if (q) arr = arr.filter((t) =>
      (t.descricao || '').toLowerCase().includes(q) ||
      (t.categoria || '').toLowerCase().includes(q) ||
      (t.observacao || '').toLowerCase().includes(q));
    const dir = sortDir === 'asc' ? 1 : -1;
    const ord = [...arr].sort((a, b) => {
      if (sortKey === 'valor') return (a.valor - b.valor) * dir;
      if (sortKey === 'status') return a.status.localeCompare(b.status) * dir;
      return a.data.localeCompare(b.data) * dir;
    });
    return ord;
  }, [itens, filtro, busca, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtrados.length / PAGE_SIZE));
  const pageItems = filtrados.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  // ── Handlers ──────────────────────────────────────────────────────────────
  function abrirModal(tipo: Tipo, editando?: Lancamento) {
    setModal({ tipo, editando });
    setFData(editando?.data ?? ymd(new Date()));
    setFValor(editando ? String(editando.valor) : '');
    setFDesc(editando?.descricao ?? '');
    setFCat(editando?.categoria ?? CATEGORIAS[0]);
    setFStatus(editando?.status ?? 'pago');
    setFEvento(editando?.tipo_evento ?? '');
    setFMetodo(editando?.metodo_pagamento ?? '');
    setFObs(editando?.observacao ?? '');
    setFReserva(editando?.reserva_id ?? '');
    setFRecorrente(false);
    setFRepetir('12');
  }

  function prefillFromReserva(id: string) {
    setFReserva(id);
    const r = reservas.find((x) => x.id === id);
    if (!r) return;
    if (r.valor_estimado) setFValor(String(r.valor_estimado));
    if (r.tipo_evento) setFEvento(r.tipo_evento);
    if (r.data_inicio) setFData(r.data_inicio);
    if (r.nome && !fDesc) setFDesc(`${r.tipo_evento || 'Evento'} — ${r.nome}`);
  }

  async function salvar() {
    if (!userId || !modal) return;
    const valor = Number(fValor);
    if (!valor || valor <= 0) return;
    setSaving(true);
    const payload = {
      usuario_id: userId, tipo: modal.tipo, categoria: fCat, descricao: fDesc || null,
      tipo_evento: fEvento || null, valor, status: fStatus, data: fData,
      observacao: fObs || null, metodo_pagamento: fMetodo || null,
      recorrente: fRecorrente, reserva_id: fReserva || null,
    };

    let error;
    if (modal.editando) {
      ({ error } = await sb.from('lancamentos').update(payload).eq('id', modal.editando.id));
    } else if (fRecorrente) {
      const n = Math.min(Math.max(parseInt(fRepetir, 10) || 1, 1), 36);
      const base = new Date(fData + 'T12:00:00');
      const rows = Array.from({ length: n }, (_, i) => {
        const d = new Date(base.getFullYear(), base.getMonth() + i, base.getDate());
        return { ...payload, data: ymd(d) };
      });
      ({ error } = await sb.from('lancamentos').insert(rows));
    } else {
      ({ error } = await sb.from('lancamentos').insert(payload));
    }

    setSaving(false);
    if (error) { toast.error('Erro ao salvar. Tente novamente.'); return; }
    toast.success(modal.editando ? 'Lançamento atualizado!' : fRecorrente ? 'Lançamentos recorrentes criados!' : 'Lançamento registrado!');
    setModal(null);
    await carregar(userId, periodo);
  }

  function handleRemover(id: number) {
    if (confirmDelete === id) {
      sb.from('lancamentos').delete().eq('id', id).then(() => {
        setItens((arr) => arr.filter((t) => t.id !== id));
        toast.success('Lançamento removido.');
        setConfirmDelete(null);
      });
    } else {
      setConfirmDelete(id);
      setTimeout(() => setConfirmDelete((c) => (c === id ? null : c)), 3000);
    }
  }

  async function ciclarStatus(t: Lancamento) {
    const novo = STATUS_CICLO[t.status];
    setItens((arr) => arr.map((x) => (x.id === t.id ? { ...x, status: novo } : x)));
    const { error } = await sb.from('lancamentos').update({ status: novo }).eq('id', t.id);
    if (error) {
      setItens((arr) => arr.map((x) => (x.id === t.id ? { ...x, status: t.status } : x)));
      toast.error('Não foi possível atualizar o status.');
    }
  }

  function abrirMetas() {
    setGReceita(String(Math.round(metasView[0].alvo)));
    setGLucro(String(Math.round(metasView[1].alvo)));
    setGAdimpl(String(Math.round(metasView[2].alvo)));
    setGoalsOpen(true);
  }

  async function salvarMetas() {
    if (!userId) return;
    setGSaving(true);
    const rows = [
      { usuario_id: userId, metrica: 'receita', periodo, alvo: Number(gReceita) || 0 },
      { usuario_id: userId, metrica: 'lucro', periodo, alvo: Number(gLucro) || 0 },
      { usuario_id: userId, metrica: 'adimplencia', periodo, alvo: Number(gAdimpl) || 0 },
    ];
    const { error } = await sb.from('metas_financeiras').upsert(rows, { onConflict: 'usuario_id,metrica,periodo' });
    setGSaving(false);
    if (error) { toast.error('Erro ao salvar metas.'); return; }
    toast.success('Metas atualizadas!');
    setGoalsOpen(false);
    await carregar(userId, periodo);
  }

  function toggleSort(k: SortKey) {
    if (sortKey === k) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(k); setSortDir(k === 'data' ? 'desc' : 'desc'); }
  }

  // ── Skeleton ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="mx-auto max-w-6xl space-y-4">
        <div className="h-[72px] animate-pulse rounded-2xl bg-black/[0.05]" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => <div key={i} className="h-[104px] animate-pulse rounded-2xl bg-black/[0.05]" />)}
        </div>
        <div className="h-[240px] animate-pulse rounded-2xl bg-black/[0.05]" />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="h-[200px] animate-pulse rounded-2xl bg-black/[0.05]" />
          <div className="h-[200px] animate-pulse rounded-2xl bg-black/[0.05]" />
        </div>
      </div>
    );
  }

  const periodoLabel = { mes: 'mês anterior', trimestre: 'trim. anterior', ano: 'ano anterior' }[periodo];
  const periodoTag = { mes: 'Mês', trimestre: 'Trimestre', ano: 'Ano' }[periodo];

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-6xl">

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink sm:text-2xl">Financeiro</h1>
          <p className="mt-1 text-sm text-ink-muted">Receitas, despesas e resultado do seu espaço.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select value={periodo} onChange={(e) => setPeriodo(e.target.value as Periodo)}
            className="rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm focus:border-brand focus:outline-none">
            <option value="mes">Este mês</option>
            <option value="trimestre">Trimestre</option>
            <option value="ano">Este ano</option>
          </select>
          {filtrados.length > 0 && (
            <button onClick={() => exportCSV(filtrados)}
              className="flex items-center gap-1.5 rounded-xl border border-black/10 px-3 py-2.5 text-sm text-ink-muted hover:border-brand/30 hover:text-brand">
              <IcoDownload /> Exportar
            </button>
          )}
          <button onClick={() => abrirModal('despesa')}
            className="rounded-xl border border-black/10 px-4 py-2.5 text-sm font-semibold text-ink-soft hover:border-red-300 hover:text-red-600">
            + Despesa
          </button>
          <button onClick={() => abrirModal('receita')}
            className="rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-600">
            + Receita
          </button>
        </div>
      </div>

      {/* Alerta inadimplência */}
      {kpis.nAtrasado > 0 && (
        <div className="mt-4 flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600"><IcoAlert /></span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-red-800">{kpis.nAtrasado === 1 ? '1 lançamento atrasado' : `${kpis.nAtrasado} lançamentos atrasados`}</p>
            <p className="text-xs text-red-600">Total em atraso: {formatMoney(kpis.atrasado)}</p>
          </div>
          <button onClick={() => setFiltro('pendente')} className="shrink-0 text-xs font-semibold text-red-700 underline underline-offset-2 hover:text-red-900">Ver pendentes</button>
        </div>
      )}

      {needsSetup && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          A tabela financeira ainda não foi criada. Os lançamentos aparecerão aqui após a migration <code className="rounded bg-amber-100 px-1 py-0.5">lancamentos</code>.
        </div>
      )}

      {/* KPIs */}
      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Receita" value={formatMoneyShort(kpis.receita)} delta={variacao(kpis.receita, kpisPrev.receita)} vs={periodoLabel} tone="verde" icon={<IcoReceita />} spark={sparks.receita} />
        <Kpi label="Despesas" value={formatMoneyShort(kpis.despesa)} delta={variacao(kpis.despesa, kpisPrev.despesa)} vs={periodoLabel} tone="vermelho" icon={<IcoDespesa />} invertDelta spark={sparks.despesa} />
        <Kpi label="Lucro líquido" value={formatMoneyShort(kpis.lucro)} sub={`margem ${formatPercent(kpis.margem)}`} delta={variacao(kpis.lucro, kpisPrev.lucro)} vs={periodoLabel} tone={kpis.lucro >= 0 ? 'gold' : 'vermelho'} icon={<IcoLucro />} spark={sparks.lucro} />
        <Kpi label="Ticket médio" value={formatMoneyShort(kpis.ticket)} sub={`${kpis.count} lançamentos`} tone="azul" icon={<IcoTicket />} />
      </div>

      {/* Gráfico combo + Distribuição por categoria */}
      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-[1fr_320px]">
        <div className="rounded-2xl bg-white p-5 shadow-card">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-base font-bold text-ink">Evolução mensal</h3>
            {projecao && (
              <span className="rounded-full bg-brand-50 px-2.5 py-1 text-[0.7rem] font-semibold text-brand">
                Projeção do mês: {formatMoneyShort(projecao.receita)} receita · {formatMoneyShort(projecao.lucro)} lucro
              </span>
            )}
          </div>
          <ComboChart dados={chartData} />
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-card">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-base font-bold text-ink">Por categoria</h3>
            <div className="flex gap-1 rounded-full bg-black/[0.04] p-0.5">
              {(['receita', 'despesa'] as Tipo[]).map((t) => (
                <button key={t} onClick={() => setCatView(t)}
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize transition ${catView === t ? 'bg-white text-ink shadow-sm' : 'text-ink-muted'}`}>
                  {t}
                </button>
              ))}
            </div>
          </div>
          {porCategoria.length === 0 ? (
            <div className="flex h-[180px] items-center justify-center">
              <p className="text-sm text-ink-muted">Sem {catView === 'receita' ? 'receitas' : 'despesas'} no período.</p>
            </div>
          ) : (
            <Donut data={porCategoria} />
          )}
        </div>
      </div>

      {/* Fluxo de caixa + Pipeline */}
      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Contas a receber / pagar */}
        <div className="rounded-2xl bg-white p-5 shadow-card">
          <h3 className="mb-4 text-base font-bold text-ink">Fluxo de caixa</h3>
          <div className="grid grid-cols-3 gap-3">
            <FluxoCell label="A receber" value={fluxo.aReceber} tone="verde" />
            <FluxoCell label="A pagar" value={fluxo.aPagar} tone="vermelho" />
            <FluxoCell label="Saldo a liquidar" value={fluxo.saldo} tone={fluxo.saldo >= 0 ? 'azul' : 'vermelho'} />
          </div>
          <div className="mt-5">
            <p className="mb-2 text-xs font-semibold text-ink-soft">Contas a receber por vencimento</p>
            {fluxo.aReceber === 0 ? (
              <p className="text-sm text-ink-muted">Nada a receber no momento.</p>
            ) : (
              <div className="space-y-2.5">
                <AgingBar label="A vencer" value={fluxo.aVencer} total={fluxo.aReceber} cor="#10b981" />
                <AgingBar label="Atrasado até 30 dias" value={fluxo.venc030} total={fluxo.aReceber} cor="#f59e0b" />
                <AgingBar label="Atrasado +30 dias" value={fluxo.venc30} total={fluxo.aReceber} cor="#ef4444" />
              </div>
            )}
          </div>
        </div>

        {/* Pipeline */}
        <div className="rounded-2xl bg-white p-5 shadow-card">
          <div className="mb-1 flex items-center justify-between">
            <h3 className="text-base font-bold text-ink">Pipeline de eventos</h3>
            <span className="text-xs text-ink-muted">{pipeline.count} confirmados</span>
          </div>
          <p className="mb-4 text-2xl font-bold text-emerald-600">{formatMoneyShort(pipeline.total)}<span className="ml-1 text-xs font-medium text-ink-muted">previstos</span></p>

          {pipeline.proximos.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-black/[0.04] text-ink-muted"><IcoCalendar /></div>
              <p className="text-sm text-ink-muted">Nenhum evento confirmado à frente.</p>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                {pipeline.proximos.map((evt) => {
                  const st = EVT_STATUS[evt.status] ?? { label: evt.status, cls: 'bg-gray-100 text-gray-600' };
                  const dia = evt.data_inicio ? new Date(evt.data_inicio + 'T12:00:00') : null;
                  return (
                    <div key={evt.id} className="flex items-center gap-3 rounded-xl border border-black/[0.05] p-2.5 transition hover:border-brand/20 hover:bg-brand-50/30">
                      <div className="flex min-w-[38px] flex-col items-center rounded-lg bg-brand-50 px-1.5 py-1 text-center">
                        <span className="text-[0.58rem] font-bold uppercase tracking-wide text-brand">{dia ? MESES_PT[dia.getMonth()] : '—'}</span>
                        <span className="text-base font-bold leading-none text-brand">{dia ? dia.getDate() : '—'}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-ink">{evt.nome || 'Evento'}</p>
                        <p className="text-xs text-ink-muted">{evt.tipo_evento || '—'}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        {evt.valor_estimado ? <p className="text-sm font-bold text-emerald-600">{formatMoneyShort(evt.valor_estimado)}</p> : null}
                        <span className={`mt-0.5 inline-block rounded-full px-1.5 py-0.5 text-[0.58rem] font-semibold ${st.cls}`}>{st.label}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
              {pipeline.porTipo.length > 0 && (
                <div className="mt-4 border-t border-black/[0.05] pt-3">
                  <p className="mb-2 text-xs font-semibold text-ink-soft">Por tipo de evento</p>
                  <div className="space-y-2">
                    {pipeline.porTipo.slice(0, 4).map(([tipo, val], i) => (
                      <AgingBar key={tipo} label={tipo} value={val} total={pipeline.total || 1} cor={PALETTE[i % PALETTE.length]} />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Metas */}
      <div className="mt-5 rounded-2xl bg-white p-5 shadow-card">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-ink">Metas financeiras</h3>
            <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-[0.65rem] font-bold uppercase tracking-wide text-brand">{periodoTag}</span>
          </div>
          <button onClick={abrirMetas} className="flex items-center gap-1.5 rounded-lg border border-black/10 px-3 py-1.5 text-xs font-semibold text-ink-soft hover:border-brand/30 hover:text-brand">
            <IcoCog /> Definir metas
          </button>
        </div>
        {itens.length === 0 && !needsSetup ? (
          <p className="py-4 text-center text-sm text-ink-muted">Adicione lançamentos para acompanhar as metas.</p>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
            {metasView.map((meta) => {
              const pct = Math.min(100, Math.round((meta.atual / meta.alvo) * 100));
              return (
                <div key={meta.metrica}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="font-semibold text-ink-soft">{meta.nome}</span>
                    <span className={`font-bold ${pct >= 75 ? 'text-emerald-600' : pct >= 40 ? 'text-amber-600' : 'text-red-500'}`}>{pct}%</span>
                  </div>
                  <div className="mb-1.5 flex justify-between text-[0.68rem] text-ink-muted">
                    <span>{meta.fmt(meta.atual)}</span>
                    <span>Meta: {meta.fmt(meta.alvo)}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-black/[0.06]">
                    <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: meta.cor }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Tabela */}
      <div className="mt-5 rounded-2xl bg-white p-5 shadow-card">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-base font-bold text-ink">Lançamentos</h3>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-muted"><IcoSearch /></span>
              <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar…"
                className="w-40 rounded-full border border-black/10 py-1.5 pl-8 pr-3 text-xs focus:border-brand focus:outline-none sm:w-52" />
            </div>
            <div className="flex flex-wrap gap-1">
              {(['todos', 'receita', 'despesa', 'pendente'] as Filtro[]).map((f) => (
                <button key={f} onClick={() => setFiltro(f)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold capitalize transition ${filtro === f ? 'bg-ink text-white' : 'bg-black/[0.04] text-ink-muted hover:bg-black/[0.07]'}`}>
                  {f === 'pendente' ? 'Em aberto' : f}
                </button>
              ))}
            </div>
          </div>
        </div>

        {filtrados.length === 0 ? (
          busca || filtro !== 'todos' ? (
            <p className="py-12 text-center text-sm text-ink-muted">Nenhum lançamento corresponde ao filtro.</p>
          ) : (
            <EmptyLancamentos onReceita={() => abrirModal('receita')} onDespesa={() => abrirModal('despesa')} />
          )
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-black/[0.06] text-left text-xs text-ink-muted">
                    <SortableTh label="Data" k="data" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                    <th className="pb-2 font-semibold">Descrição</th>
                    <th className="hidden pb-2 font-semibold sm:table-cell">Categoria</th>
                    <SortableTh label="Status" k="status" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                    <SortableTh label="Valor" k="valor" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} align="right" />
                    <th className="w-16 pb-2" />
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map((t) => (
                    <tr key={t.id} className="group border-b border-black/[0.04] last:border-0">
                      <td className="py-2.5 text-ink-muted">{formatDate(t.data, { style: 'short' })}</td>
                      <td className="py-2.5 font-medium text-ink-soft">
                        <span className="flex items-center gap-1.5">
                          {t.descricao || '—'}
                          {t.recorrente && <span title="Recorrente" className="text-ink-muted"><IcoRepeat /></span>}
                          {t.reserva_id && <span title="Vinculado a uma reserva" className="text-brand"><IcoLink /></span>}
                        </span>
                      </td>
                      <td className="hidden py-2.5 text-ink-muted sm:table-cell">{t.categoria || '—'}</td>
                      <td className="py-2.5">
                        <button onClick={() => ciclarStatus(t)} title="Clique para alterar o status"
                          className={`rounded-full px-2 py-0.5 text-xs font-semibold transition ${STATUS_CLS[t.status]}`}>
                          {STATUS_LABEL[t.status]}
                        </button>
                      </td>
                      <td className={`py-2.5 text-right font-bold ${t.tipo === 'receita' ? 'text-emerald-600' : 'text-red-600'}`}>
                        {t.tipo === 'receita' ? '+' : '−'}{formatMoney(t.valor)}
                      </td>
                      <td className="py-2.5 pl-2">
                        <div className="flex items-center justify-end gap-0.5 opacity-0 transition group-hover:opacity-100">
                          <button onClick={() => abrirModal(t.tipo, t)} title="Editar" className="rounded p-1.5 text-ink-muted hover:bg-black/[0.04] hover:text-brand"><IcoEdit /></button>
                          <button onClick={() => handleRemover(t.id)} title={confirmDelete === t.id ? 'Confirmar exclusão' : 'Remover'}
                            className={`rounded px-1.5 py-1 text-xs font-bold transition ${confirmDelete === t.id ? 'bg-red-50 text-red-600' : 'text-ink-muted hover:bg-black/[0.04] hover:text-red-600'}`}>
                            {confirmDelete === t.id ? 'Confirmar?' : <IcoTrash />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div className="mt-4 flex items-center justify-between text-xs text-ink-muted">
                <span>{filtrados.length} lançamentos · página {page + 1} de {totalPages}</span>
                <div className="flex gap-1">
                  <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}
                    className="rounded-lg border border-black/10 px-3 py-1.5 font-semibold disabled:opacity-40 enabled:hover:border-brand/30 enabled:hover:text-brand">Anterior</button>
                  <button onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
                    className="rounded-lg border border-black/10 px-3 py-1.5 font-semibold disabled:opacity-40 enabled:hover:border-brand/30 enabled:hover:text-brand">Próxima</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal lançamento */}
      {modal && (
        <div className="fixed inset-0 z-[10000] flex items-start justify-center overflow-y-auto bg-black/50 p-4">
          <div className="relative my-8 w-full max-w-md rounded-2xl bg-white p-6 shadow-pop">
            <button onClick={() => setModal(null)} className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full border border-black/10 text-ink-muted hover:bg-black/[0.03]">✕</button>
            <div className="mb-5 flex items-center gap-3">
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${modal.tipo === 'receita' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                {modal.tipo === 'receita' ? <IcoReceita /> : <IcoDespesa />}
              </span>
              <h3 className="font-display text-xl font-bold text-ink">
                {modal.editando ? (modal.tipo === 'receita' ? 'Editar Receita' : 'Editar Despesa') : (modal.tipo === 'receita' ? 'Nova Receita' : 'Nova Despesa')}
              </h3>
            </div>
            <div className="space-y-4">
              {modal.tipo === 'receita' && reservas.length > 0 && !modal.editando && (
                <label className="block">
                  <span className="mb-1.5 block text-sm font-semibold text-ink-soft">Vincular a uma reserva <span className="font-normal text-ink-muted">(opcional)</span></span>
                  <select value={fReserva} onChange={(e) => prefillFromReserva(e.target.value)} className={inp}>
                    <option value="">— Nenhuma —</option>
                    {reservas.slice(0, 50).map((r) => (
                      <option key={r.id} value={r.id}>{r.nome || 'Reserva'} · {r.data_inicio ? formatDate(r.data_inicio, { style: 'short' }) : ''}</option>
                    ))}
                  </select>
                </label>
              )}
              <div className="grid grid-cols-2 gap-4">
                <label className="block">
                  <span className="mb-1.5 block text-sm font-semibold text-ink-soft">Valor (R$)</span>
                  <input type="number" min={0} step="0.01" value={fValor} onChange={(e) => setFValor(e.target.value)} className={inp} autoFocus placeholder="0,00" />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-sm font-semibold text-ink-soft">Data</span>
                  <input type="date" value={fData} onChange={(e) => setFData(e.target.value)} className={inp} />
                </label>
              </div>
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
                  <span className="mb-1.5 block text-sm font-semibold text-ink-soft">Status</span>
                  <select value={fStatus} onChange={(e) => setFStatus(e.target.value as Status)} className={inp}>
                    <option value="pago">Pago</option>
                    <option value="pendente">Pendente</option>
                    <option value="atrasado">Atrasado</option>
                  </select>
                </label>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <label className="block">
                  <span className="mb-1.5 block text-sm font-semibold text-ink-soft">Tipo de evento</span>
                  <select value={fEvento} onChange={(e) => setFEvento(e.target.value)} className={inp}>
                    <option value="">—</option>
                    {TIPOS_EVENTO.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-sm font-semibold text-ink-soft">Método</span>
                  <select value={fMetodo} onChange={(e) => setFMetodo(e.target.value)} className={inp}>
                    <option value="">—</option>
                    {METODOS.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </label>
              </div>
              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold text-ink-soft">Observação <span className="font-normal text-ink-muted">(opcional)</span></span>
                <textarea value={fObs} onChange={(e) => setFObs(e.target.value)} rows={2} className={inp} placeholder="Nº do contrato, fornecedor, detalhes…" />
              </label>
              {!modal.editando && (
                <div className="rounded-xl border border-black/[0.06] bg-black/[0.015] p-3">
                  <label className="flex cursor-pointer items-center gap-2">
                    <input type="checkbox" checked={fRecorrente} onChange={(e) => setFRecorrente(e.target.checked)} className="h-4 w-4 rounded border-black/20 text-brand focus:ring-brand/30" />
                    <span className="text-sm font-semibold text-ink-soft">Repetir mensalmente</span>
                  </label>
                  {fRecorrente && (
                    <div className="mt-3 flex items-center gap-2 text-sm">
                      <span className="text-ink-muted">por</span>
                      <input type="number" min={1} max={36} value={fRepetir} onChange={(e) => setFRepetir(e.target.value)} className="w-16 rounded-lg border border-black/10 px-2 py-1.5 text-center focus:border-brand focus:outline-none" />
                      <span className="text-ink-muted">meses (cria um lançamento por mês)</span>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="mt-6 flex items-center gap-3">
              <button onClick={salvar} disabled={saving || !fValor} className="rounded-xl bg-brand px-6 py-3 text-sm font-bold text-white transition hover:bg-brand-600 disabled:opacity-60">
                {saving ? 'Salvando…' : modal.editando ? 'Salvar alterações' : 'Salvar lançamento'}
              </button>
              <button onClick={() => setModal(null)} className="ml-auto text-sm font-medium text-ink-muted hover:text-ink">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal metas */}
      {goalsOpen && (
        <div className="fixed inset-0 z-[10000] flex items-start justify-center overflow-y-auto bg-black/50 p-4">
          <div className="relative my-8 w-full max-w-sm rounded-2xl bg-white p-6 shadow-pop">
            <button onClick={() => setGoalsOpen(false)} className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full border border-black/10 text-ink-muted hover:bg-black/[0.03]">✕</button>
            <h3 className="mb-1 font-display text-xl font-bold text-ink">Definir metas</h3>
            <p className="mb-5 text-sm text-ink-muted">Metas para <strong>{periodoTag.toLowerCase()}</strong>. Em branco, voltam ao automático (+10%).</p>
            <div className="space-y-4">
              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold text-ink-soft">Meta de receita (R$)</span>
                <input type="number" min={0} value={gReceita} onChange={(e) => setGReceita(e.target.value)} className={inp} />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold text-ink-soft">Lucro alvo (R$)</span>
                <input type="number" min={0} value={gLucro} onChange={(e) => setGLucro(e.target.value)} className={inp} />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold text-ink-soft">Taxa de adimplência (%)</span>
                <input type="number" min={0} max={100} value={gAdimpl} onChange={(e) => setGAdimpl(e.target.value)} className={inp} />
              </label>
            </div>
            <div className="mt-6 flex items-center gap-3">
              <button onClick={salvarMetas} disabled={gSaving} className="rounded-xl bg-brand px-6 py-3 text-sm font-bold text-white transition hover:bg-brand-600 disabled:opacity-60">
                {gSaving ? 'Salvando…' : 'Salvar metas'}
              </button>
              <button onClick={() => setGoalsOpen(false)} className="ml-auto text-sm font-medium text-ink-muted hover:text-ink">Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function Kpi({ label, value, sub, delta, vs, tone, icon, invertDelta, spark }: {
  label: string; value: string; sub?: string; delta?: number; vs?: string;
  tone: 'verde' | 'vermelho' | 'gold' | 'azul'; icon?: ReactNode; invertDelta?: boolean; spark?: number[];
}) {
  const color = { verde: 'text-emerald-600', vermelho: 'text-red-600', gold: 'text-amber-600', azul: 'text-blue-600' }[tone];
  const iconBg = { verde: 'bg-emerald-50 text-emerald-600', vermelho: 'bg-red-50 text-red-600', gold: 'bg-amber-50 text-amber-600', azul: 'bg-blue-50 text-blue-600' }[tone];
  const sparkColor = { verde: '#10b981', vermelho: '#ef4444', gold: '#f59e0b', azul: '#3b82f6' }[tone];
  const isGood = delta !== undefined && (invertDelta ? delta < 0 : delta > 0);
  const isBad = delta !== undefined && (invertDelta ? delta > 0 : delta < 0);

  return (
    <div className="rounded-2xl bg-white p-4 shadow-card">
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs text-ink-muted">{label}</span>
        {icon && <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${iconBg}`}>{icon}</span>}
      </div>
      <div className={`mt-2 text-xl font-bold ${color}`}>{value}</div>
      <div className="mt-1.5 flex items-end justify-between gap-2">
        <div>
          {sub && <div className="text-[0.68rem] font-medium text-ink-muted">{sub}</div>}
          {delta !== undefined && (
            <div className={`flex items-center gap-1 text-[0.68rem] font-semibold leading-none ${isGood ? 'text-emerald-600' : isBad ? 'text-red-500' : 'text-ink-muted'}`}>
              <span>{isGood ? '↑' : isBad ? '↓' : '→'}</span><span>{Math.abs(delta)}%</span>
              <span className="font-normal text-ink-muted">vs {vs}</span>
            </div>
          )}
        </div>
        {spark && spark.some((v) => v > 0) && <Sparkline values={spark} color={sparkColor} />}
      </div>
    </div>
  );
}

function Sparkline({ values, color }: { values: number[]; color: string }) {
  const w = 60, h = 22, pad = 2;
  const max = Math.max(...values, 1), min = Math.min(...values, 0);
  const range = max - min || 1;
  const n = values.length;
  const pts = values.map((v, i) => {
    const x = pad + (i * (w - 2 * pad)) / (n - 1 || 1);
    const y = h - pad - ((v - min) / range) * (h - 2 * pad);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  return (
    <svg width={w} height={h} className="shrink-0">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.85" />
    </svg>
  );
}

function ComboChart({ dados }: { dados: MesData[] }) {
  const W = 520, H = 210;
  const PAD = { t: 28, r: 16, b: 42, l: 64 };
  const innerW = W - PAD.l - PAD.r, innerH = H - PAD.t - PAD.b;
  const lucros = dados.map((d) => d.receita - d.despesa);
  const yMax = Math.max(...dados.flatMap((d) => [d.receita, d.despesa]), ...lucros, 1);
  const yMin = Math.min(0, ...lucros);
  const span = yMax - yMin || 1;
  const scaleY = (v: number) => PAD.t + innerH * (1 - (v - yMin) / span);
  const zeroY = scaleY(0);
  const slotW = innerW / dados.length;
  const barW = slotW * 0.26, gap = slotW * 0.05;

  const isEmpty = dados.every((d) => d.receita === 0 && d.despesa === 0);
  if (isEmpty) {
    return <div className="flex h-[180px] items-center justify-center"><p className="text-sm text-ink-muted">Adicione lançamentos para ver a evolução mensal.</p></div>;
  }

  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => yMin + span * f);
  const lucroPts = dados.map((d, i) => `${(PAD.l + i * slotW + slotW * 0.5).toFixed(1)},${scaleY(d.receita - d.despesa).toFixed(1)}`).join(' ');

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="xMidYMid meet" aria-label="Evolução mensal de receita, despesa e lucro">
      {ticks.map((t, i) => {
        const y = scaleY(t);
        return (
          <g key={i}>
            <line x1={PAD.l} y1={y} x2={W - PAD.r} y2={y} stroke={Math.abs(t) < 0.01 ? '#e5e7eb' : '#f3f4f6'} strokeWidth="1" />
            <text x={PAD.l - 6} y={y + 3.5} textAnchor="end" fontSize="8.5" fill="#9ca3af">{t === 0 ? '0' : formatMoneyShort(t)}</text>
          </g>
        );
      })}
      {dados.map((d, i) => {
        const xSlot = PAD.l + i * slotW;
        const xR = xSlot + slotW * 0.16, xD = xR + barW + gap;
        const yR = scaleY(d.receita), yD = scaleY(d.despesa);
        return (
          <g key={d.mes}>
            {d.receita > 0 && <rect x={xR} y={yR} width={barW} height={zeroY - yR} rx="3" fill="#10b981" opacity="0.85" />}
            {d.despesa > 0 && <rect x={xD} y={yD} width={barW} height={zeroY - yD} rx="3" fill="#ef4444" opacity="0.7" />}
            <text x={xSlot + slotW * 0.5} y={H - 8} textAnchor="middle" fontSize="9.5" fill="#9ca3af">{d.label}</text>
          </g>
        );
      })}
      {/* Linha de lucro */}
      <polyline points={lucroPts} fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {dados.map((d, i) => (
        <circle key={d.mes} cx={PAD.l + i * slotW + slotW * 0.5} cy={scaleY(d.receita - d.despesa)} r="2.6" fill="#fff" stroke="#f59e0b" strokeWidth="1.5" />
      ))}
      {/* Legenda */}
      <rect x={PAD.l} y={8} width={9} height={9} rx="2" fill="#10b981" opacity="0.85" /><text x={PAD.l + 13} y={16} fontSize="9" fill="#6b7280">Receita</text>
      <rect x={PAD.l + 62} y={8} width={9} height={9} rx="2" fill="#ef4444" opacity="0.7" /><text x={PAD.l + 75} y={16} fontSize="9" fill="#6b7280">Despesa</text>
      <line x1={PAD.l + 128} y1={12} x2={PAD.l + 142} y2={12} stroke="#f59e0b" strokeWidth="2" /><text x={PAD.l + 146} y={16} fontSize="9" fill="#6b7280">Lucro</text>
    </svg>
  );
}

function Donut({ data }: { data: [string, number][] }) {
  const total = data.reduce((s, [, v]) => s + v, 0) || 1;
  const top = data.slice(0, 8);
  const r = 52, sw = 16, C = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="flex items-center gap-4">
      <svg width="128" height="128" viewBox="0 0 128 128" className="shrink-0 -rotate-90">
        <circle cx="64" cy="64" r={r} fill="none" stroke="#f1f5f9" strokeWidth={sw} />
        {top.map(([cat, val], i) => {
          const len = (val / total) * C;
          const el = (
            <circle key={cat} cx="64" cy="64" r={r} fill="none" stroke={PALETTE[i % PALETTE.length]} strokeWidth={sw}
              strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-offset} />
          );
          offset += len;
          return el;
        })}
      </svg>
      <div className="min-w-0 flex-1 space-y-1.5">
        {top.map(([cat, val], i) => (
          <div key={cat} className="flex items-center gap-2 text-xs">
            <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: PALETTE[i % PALETTE.length] }} />
            <span className="min-w-0 flex-1 truncate text-ink-soft">{cat}</span>
            <span className="shrink-0 font-semibold text-ink-muted">{Math.round((val / total) * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function FluxoCell({ label, value, tone }: { label: string; value: number; tone: 'verde' | 'vermelho' | 'azul' }) {
  const color = { verde: 'text-emerald-600', vermelho: 'text-red-600', azul: 'text-blue-600' }[tone];
  return (
    <div className="rounded-xl bg-black/[0.02] p-3 text-center">
      <div className="text-[0.68rem] text-ink-muted">{label}</div>
      <div className={`mt-1 text-base font-bold ${color}`}>{formatMoneyShort(value)}</div>
    </div>
  );
}

function AgingBar({ label, value, total, cor }: { label: string; value: number; total: number; cor: string }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="text-ink-soft">{label}</span>
        <span className="font-semibold text-ink-muted">{formatMoneyShort(value)}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-black/[0.06]">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: cor }} />
      </div>
    </div>
  );
}

function SortableTh({ label, k, sortKey, sortDir, onSort, align }: {
  label: string; k: SortKey; sortKey: SortKey; sortDir: 'asc' | 'desc'; onSort: (k: SortKey) => void; align?: 'right';
}) {
  const active = sortKey === k;
  return (
    <th className={`pb-2 font-semibold ${align === 'right' ? 'text-right' : ''}`}>
      <button onClick={() => onSort(k)} className={`inline-flex items-center gap-1 transition hover:text-ink ${active ? 'text-ink' : ''}`}>
        {label}<span className="text-[0.6rem]">{active ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}</span>
      </button>
    </th>
  );
}

function EmptyLancamentos({ onReceita, onDespesa }: { onReceita: () => void; onDespesa: () => void }) {
  return (
    <div className="py-12 text-center">
      <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2H3Zm0 0v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2H5M16 13h.01" />
        </svg>
      </div>
      <p className="mb-1 text-sm font-semibold text-ink">Nenhum lançamento neste período</p>
      <p className="mb-5 text-xs text-ink-muted">Registre receitas e despesas para visualizar seu resultado financeiro.</p>
      <div className="flex items-center justify-center gap-2">
        <button onClick={onReceita} className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600">+ Receita</button>
        <button onClick={onDespesa} className="rounded-xl border border-black/10 px-4 py-2 text-sm font-semibold text-ink-soft hover:border-red-300 hover:text-red-600">+ Despesa</button>
      </div>
    </div>
  );
}

// ── Icons ──────────────────────────────────────────────────────────────────────
const svg = (path: ReactNode, size = 15, sw = 2) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">{path}</svg>
);
const IcoReceita = () => svg(<path d="M12 19V5M5 12l7-7 7 7" />, 15, 2.2);
const IcoDespesa = () => svg(<path d="M12 5v14M19 12l-7 7-7-7" />, 15, 2.2);
const IcoLucro = () => svg(<path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />);
const IcoTicket = () => svg(<path d="M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4Zm10-2v12" />);
const IcoAlert = () => svg(<path d="M12 9v4M12 17h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />, 16);
const IcoEdit = () => svg(<><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4Z" /></>, 13);
const IcoTrash = () => svg(<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />, 13);
const IcoCalendar = () => svg(<path d="M3 9h18M7 3v4M17 3v4M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" />, 20, 1.8);
const IcoDownload = () => svg(<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />, 13);
const IcoSearch = () => svg(<path d="M21 21l-4.3-4.3M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16Z" />, 14, 2);
const IcoCog = () => svg(<><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" /></>, 13, 1.8);
const IcoRepeat = () => svg(<path d="M17 2l4 4-4 4M3 11V9a4 4 0 0 1 4-4h14M7 22l-4-4 4-4M21 13v2a4 4 0 0 1-4 4H3" />, 12);
const IcoLink = () => svg(<path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" />, 12);
