'use client';

// Financeiro — /painel/financeiro  (versão premium SaaS).
// Dados reais via Supabase (tabela `lancamentos`). Features:
//   • KPIs com ícones e comparativo vs período anterior (delta %)
//   • Gráfico de evolução mensal últimos 6 meses (SVG puro, zero dependências)
//   • Próximos eventos com valor esperado (tabela `reservas`)
//   • Metas financeiras derivadas dos dados reais
//   • Alerta de inadimplência destacado quando há status=atrasado
//   • Editar + remover lançamentos (confirmação inline; toast em todas as ações)
//   • Exportar CSV com BOM para Excel
//   • i18n-ready via lib/format

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabaseAny as sb } from '@/lib/supabase';
import { formatMoney, formatMoneyShort, formatDate } from '@/lib/format';
import { useToast } from '@/components/Toast';

// ── Types ─────────────────────────────────────────────────────────────────────
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
type MesData = { mes: string; label: string; receita: number; despesa: number };
type ProximoEvento = {
  id: string;
  nome: string | null;
  tipo_evento: string | null;
  data_inicio: string | null;
  valor_estimado: number | null;
  status: string;
};
type MetaItem = {
  nome: string;
  atual: number;
  alvo: number;
  cor: string;
  fmt: (v: number) => string;
};

// ── Constants ─────────────────────────────────────────────────────────────────
const CATEGORIAS = [
  'Aluguel de Espaço', 'Buffet / Catering', 'Decoração', 'Som / Iluminação',
  'Manutenção', 'Limpeza', 'Impostos', 'Marketing', 'Outros',
];
const STATUS_LABEL: Record<Status, string> = { pago: 'Pago', pendente: 'Pendente', atrasado: 'Atrasado' };
const STATUS_CLS: Record<Status, string> = {
  pago: 'bg-emerald-50 text-emerald-700',
  pendente: 'bg-amber-50 text-amber-700',
  atrasado: 'bg-red-50 text-red-700',
};
const MESES_PT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const EVT_STATUS: Record<string, { label: string; cls: string }> = {
  solicitada: { label: 'Solicitada', cls: 'bg-amber-100 text-amber-700' },
  aprovada: { label: 'Aprovada', cls: 'bg-emerald-100 text-emerald-700' },
  paga: { label: 'Paga', cls: 'bg-emerald-100 text-emerald-700' },
  confirmada: { label: 'Confirmada', cls: 'bg-blue-100 text-blue-700' },
};
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

function buildChartBase(): MesData[] {
  const now = new Date();
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
    const mes = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    return { mes, label: MESES_PT[d.getMonth()], receita: 0, despesa: 0 };
  });
}

function exportCSV(itens: Lancamento[]) {
  const header = 'Data,Tipo,Categoria,Descrição,Status,Valor\n';
  const rows = itens
    .map((t) => `${t.data},${t.tipo},"${t.categoria || ''}","${(t.descricao || '').replace(/"/g, '""')}",${t.status},${t.valor}`)
    .join('\n');
  const blob = new Blob(['﻿' + header + rows], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `financeiro-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function FinanceiroPage() {
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [periodo, setPeriodo] = useState<Periodo>('mes');
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [itens, setItens] = useState<Lancamento[]>([]);
  const [prevItens, setPrevItens] = useState<Lancamento[]>([]);
  const [chartData, setChartData] = useState<MesData[]>(buildChartBase());
  const [proxEventos, setProxEventos] = useState<ProximoEvento[]>([]);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);

  // modal
  const [modal, setModal] = useState<null | { tipo: Tipo; editando?: Lancamento }>(null);
  const [fData, setFData] = useState('');
  const [fValor, setFValor] = useState('');
  const [fDesc, setFDesc] = useState('');
  const [fCat, setFCat] = useState(CATEGORIAS[0]);
  const [fStatus, setFStatus] = useState<Status>('pago');
  const [saving, setSaving] = useState(false);

  const carregar = useCallback(async (uid: string, p: Periodo) => {
    const [ini, fim] = periodoRange(p);
    const [prevIni, prevFim] = periodoPrevio(p);
    const now = new Date();
    const sixMonthsAgo = ymd(new Date(now.getFullYear(), now.getMonth() - 5, 1));
    const today = ymd(now);

    // Buscar propriedade do usuário para filtrar reservas
    const { data: props } = await sb
      .from('propriedades')
      .select('id')
      .eq('usuario_id', uid);
    const propIds = (props || []).map((p: { id: number }) => p.id);

    const [mainRes, prevRes, chartRes, eventosRes] = await Promise.all([
      sb.from('lancamentos')
        .select('id,tipo,categoria,descricao,valor,status,data')
        .eq('usuario_id', uid)
        .gte('data', ini).lte('data', fim)
        .order('data', { ascending: false }),

      sb.from('lancamentos')
        .select('tipo,valor')
        .eq('usuario_id', uid)
        .gte('data', prevIni).lte('data', prevFim),

      sb.from('lancamentos')
        .select('tipo,valor,data')
        .eq('usuario_id', uid)
        .gte('data', sixMonthsAgo)
        .order('data'),

      propIds.length > 0
        ? sb.from('reservas')
          .select('id,nome,tipo_evento,data_inicio,valor_estimado,status')
          .in('propriedade_id', propIds)
          .gte('data_inicio', today)
          .in('status', ['aprovada', 'paga', 'confirmada', 'solicitada'])
          .order('data_inicio')
          .limit(4)
        : Promise.resolve({ data: [] }),
    ]);

    if (mainRes.error?.code === '42P01') {
      setNeedsSetup(true);
      setItens([]);
      return;
    }
    setNeedsSetup(false);

    const coerce = (r: Lancamento) => ({ ...r, id: Number(r.id), valor: Number(r.valor) });
    setItens((mainRes.data || []).map(coerce));
    setPrevItens(
      ((prevRes.data || []) as Lancamento[]).map((r) => ({ ...r, valor: Number(r.valor) })),
    );

    const base = buildChartBase();
    (chartRes.data || []).forEach((r: { tipo: string; valor: number; data: string }) => {
      const mes = r.data.slice(0, 7);
      const slot = base.find((b) => b.mes === mes);
      if (!slot) return;
      if (r.tipo === 'receita') slot.receita += Number(r.valor);
      else slot.despesa += Number(r.valor);
    });
    setChartData(base);
    setProxEventos((eventosRes.data || []) as ProximoEvento[]);
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

  // ── Derived ───────────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const receita = itens.filter((t) => t.tipo === 'receita').reduce((s, t) => s + t.valor, 0);
    const despesa = itens.filter((t) => t.tipo === 'despesa').reduce((s, t) => s + t.valor, 0);
    const atrasado = itens.filter((t) => t.status === 'atrasado').reduce((s, t) => s + t.valor, 0);
    const nAtrasado = itens.filter((t) => t.status === 'atrasado').length;
    return { receita, despesa, lucro: receita - despesa, count: itens.length, atrasado, nAtrasado };
  }, [itens]);

  const kpisPrev = useMemo(() => {
    const receita = prevItens.filter((t) => t.tipo === 'receita').reduce((s, t) => s + t.valor, 0);
    const despesa = prevItens.filter((t) => t.tipo === 'despesa').reduce((s, t) => s + t.valor, 0);
    return { receita, despesa, lucro: receita - despesa };
  }, [prevItens]);

  const porCategoria = useMemo(() => {
    const map = new Map<string, number>();
    itens.filter((t) => t.tipo === 'receita').forEach((t) => {
      const k = t.categoria || 'Outros';
      map.set(k, (map.get(k) || 0) + t.valor);
    });
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [itens]);
  const maxCat = porCategoria[0]?.[1] || 1;

  const filtrados = useMemo(() => {
    if (filtro === 'todos') return itens;
    if (filtro === 'pendente') return itens.filter((t) => t.status !== 'pago');
    return itens.filter((t) => t.tipo === filtro);
  }, [itens, filtro]);

  const metas = useMemo((): MetaItem[] => {
    const taxaAdimplencia = itens.length > 0
      ? (itens.filter((t) => t.status === 'pago').length / itens.length) * 100
      : 0;
    const metaReceita = kpisPrev.receita > 0 ? kpisPrev.receita * 1.1 : 10000;
    const metaLucro = kpisPrev.lucro > 0 ? kpisPrev.lucro * 1.1 : 5000;
    return [
      {
        nome: 'Meta de Receita',
        atual: kpis.receita,
        alvo: metaReceita,
        cor: '#10b981',
        fmt: formatMoneyShort,
      },
      {
        nome: 'Lucro Alvo',
        atual: Math.max(0, kpis.lucro),
        alvo: Math.max(metaLucro, 1),
        cor: '#f59e0b',
        fmt: formatMoneyShort,
      },
      {
        nome: 'Taxa de Adimplência',
        atual: taxaAdimplencia,
        alvo: 90,
        cor: '#1a73e8',
        fmt: (v) => `${v.toFixed(0)}%`,
      },
    ];
  }, [itens, kpis, kpisPrev]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  function abrirModal(tipo: Tipo, editando?: Lancamento) {
    if (editando) {
      setModal({ tipo, editando });
      setFData(editando.data);
      setFValor(String(editando.valor));
      setFDesc(editando.descricao || '');
      setFCat(editando.categoria || CATEGORIAS[0]);
      setFStatus(editando.status);
    } else {
      setModal({ tipo });
      setFData(ymd(new Date()));
      setFValor(''); setFDesc(''); setFCat(CATEGORIAS[0]); setFStatus('pago');
    }
  }

  async function salvar() {
    if (!userId || !modal) return;
    const valor = Number(fValor);
    if (!valor || valor <= 0) return;
    setSaving(true);
    const payload = {
      usuario_id: userId,
      tipo: modal.tipo,
      categoria: fCat,
      descricao: fDesc || null,
      valor,
      status: fStatus,
      data: fData,
    };
    const { error } = modal.editando
      ? await sb.from('lancamentos').update(payload).eq('id', modal.editando.id)
      : await sb.from('lancamentos').insert(payload);
    setSaving(false);
    if (error) { toast.error('Erro ao salvar. Tente novamente.'); return; }
    toast.success(modal.editando ? 'Lançamento atualizado!' : 'Lançamento registrado!');
    setModal(null);
    if (userId) await carregar(userId, periodo);
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

  // ── Skeleton ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="mx-auto max-w-6xl space-y-4">
        <div className="h-[72px] animate-pulse rounded-2xl bg-black/[0.05]" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-[90px] animate-pulse rounded-2xl bg-black/[0.05]" />
          ))}
        </div>
        <div className="h-[220px] animate-pulse rounded-2xl bg-black/[0.05]" />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="h-[200px] animate-pulse rounded-2xl bg-black/[0.05]" />
          <div className="h-[200px] animate-pulse rounded-2xl bg-black/[0.05]" />
        </div>
      </div>
    );
  }

  const periodoLabel = { mes: 'mês anterior', trimestre: 'trimestre anterior', ano: 'ano anterior' }[periodo];

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-6xl">

      {/* ── Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink sm:text-2xl">Financeiro</h1>
          <p className="mt-1 text-sm text-ink-muted">Receitas, despesas e resultado do seu espaço.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={periodo}
            onChange={(e) => setPeriodo(e.target.value as Periodo)}
            className="rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm focus:border-brand focus:outline-none"
          >
            <option value="mes">Este mês</option>
            <option value="trimestre">Trimestre</option>
            <option value="ano">Este ano</option>
          </select>
          {filtrados.length > 0 && (
            <button
              onClick={() => exportCSV(filtrados)}
              className="flex items-center gap-1.5 rounded-xl border border-black/10 px-3 py-2.5 text-sm text-ink-muted hover:border-brand/30 hover:text-brand"
            >
              <IcoDownload /> Exportar
            </button>
          )}
          <button
            onClick={() => abrirModal('despesa')}
            className="rounded-xl border border-black/10 px-4 py-2.5 text-sm font-semibold text-ink-soft hover:border-red-300 hover:text-red-600"
          >
            + Despesa
          </button>
          <button
            onClick={() => abrirModal('receita')}
            className="rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-600"
          >
            + Receita
          </button>
        </div>
      </div>

      {/* ── Alerta de Inadimplência ── */}
      {kpis.nAtrasado > 0 && (
        <div className="mt-4 flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600">
            <IcoAlert />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-red-800">
              {kpis.nAtrasado === 1 ? '1 lançamento atrasado' : `${kpis.nAtrasado} lançamentos atrasados`}
            </p>
            <p className="text-xs text-red-600">Total em atraso: {formatMoney(kpis.atrasado)}</p>
          </div>
          <button
            onClick={() => setFiltro('pendente')}
            className="shrink-0 text-xs font-semibold text-red-700 underline underline-offset-2 hover:text-red-900"
          >
            Ver pendentes
          </button>
        </div>
      )}

      {needsSetup && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          A tabela financeira ainda não foi criada. Os lançamentos aparecerão aqui após a migration{' '}
          <code className="rounded bg-amber-100 px-1 py-0.5">lancamentos</code>.
        </div>
      )}

      {/* ── KPIs ── */}
      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi
          label="Receita"
          value={formatMoneyShort(kpis.receita)}
          delta={variacao(kpis.receita, kpisPrev.receita)}
          vs={periodoLabel}
          tone="verde"
          icon={<IcoReceita />}
        />
        <Kpi
          label="Despesas"
          value={formatMoneyShort(kpis.despesa)}
          delta={variacao(kpis.despesa, kpisPrev.despesa)}
          vs={periodoLabel}
          tone="vermelho"
          icon={<IcoDespesa />}
          invertDelta
        />
        <Kpi
          label="Lucro líquido"
          value={formatMoneyShort(kpis.lucro)}
          delta={variacao(kpis.lucro, kpisPrev.lucro)}
          vs={periodoLabel}
          tone={kpis.lucro >= 0 ? 'gold' : 'vermelho'}
          icon={<IcoLucro />}
        />
        <Kpi
          label="Lançamentos"
          value={String(kpis.count)}
          tone="azul"
          icon={<IcoCount />}
        />
      </div>

      {/* ── Gráfico + Categoria ── */}
      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-[1fr_300px]">
        <div className="rounded-2xl bg-white p-5 shadow-card">
          <h3 className="mb-4 text-base font-bold text-ink">Evolução mensal</h3>
          <GraficoEvolucao dados={chartData} />
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-card">
          <h3 className="mb-4 text-base font-bold text-ink">Receita por categoria</h3>
          {porCategoria.length === 0 ? (
            <div className="flex h-[140px] items-center justify-center">
              <p className="text-sm text-ink-muted">Sem receitas no período.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {porCategoria.map(([cat, val]) => (
                <div key={cat}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="text-ink-soft">{cat}</span>
                    <span className="font-semibold text-ink-muted">{formatMoneyShort(val)}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-black/[0.06]">
                    <div
                      className="h-full rounded-full bg-brand transition-all duration-500"
                      style={{ width: `${Math.round((val / maxCat) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Próximos Eventos + Metas ── */}
      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">

        {/* Próximos Eventos */}
        <div className="rounded-2xl bg-white p-5 shadow-card">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-base font-bold text-ink">Próximos eventos</h3>
            <span className="text-xs text-ink-muted">Valor estimado</span>
          </div>
          {proxEventos.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-black/[0.04] text-ink-muted">
                <IcoCalendar />
              </div>
              <p className="text-sm text-ink-muted">Nenhum evento agendado.</p>
              <p className="mt-1 text-xs text-ink-muted">Eventos aprovados aparecem aqui com o valor estimado.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {proxEventos.map((evt) => {
                const st = EVT_STATUS[evt.status] ?? { label: evt.status, cls: 'bg-gray-100 text-gray-600' };
                const dia = evt.data_inicio
                  ? new Date(evt.data_inicio + 'T12:00:00')
                  : null;
                return (
                  <div key={evt.id} className="flex items-center gap-3 rounded-xl border border-black/[0.05] p-3 transition hover:border-brand/20 hover:bg-brand-50/30">
                    <div className="flex min-w-[40px] flex-col items-center rounded-lg bg-brand-50 px-1.5 py-1.5 text-center">
                      <span className="text-[0.6rem] font-bold uppercase tracking-wide text-brand">
                        {dia ? MESES_PT[dia.getMonth()] : '—'}
                      </span>
                      <span className="text-lg font-bold leading-none text-brand">
                        {dia ? dia.getDate() : '—'}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-ink">{evt.nome || 'Evento'}</p>
                      <p className="text-xs text-ink-muted">{evt.tipo_evento || '—'}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      {evt.valor_estimado != null && evt.valor_estimado > 0 && (
                        <p className="text-sm font-bold text-emerald-600">{formatMoneyShort(evt.valor_estimado)}</p>
                      )}
                      <span className={`mt-0.5 inline-block rounded-full px-1.5 py-0.5 text-[0.6rem] font-semibold ${st.cls}`}>
                        {st.label}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Metas Financeiras */}
        <div className="rounded-2xl bg-white p-5 shadow-card">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-base font-bold text-ink">Metas financeiras</h3>
            <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-[0.65rem] font-bold uppercase tracking-wide text-brand">
              {periodo === 'mes' ? 'Mês' : periodo === 'trimestre' ? 'Trimestre' : 'Ano'}
            </span>
          </div>
          {itens.length === 0 && !needsSetup ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <p className="text-sm text-ink-muted">Adicione lançamentos para ativar as metas.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {metas.map((meta) => {
                const pct = Math.min(100, Math.round((meta.atual / meta.alvo) * 100));
                return (
                  <div key={meta.nome}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="font-semibold text-ink-soft">{meta.nome}</span>
                      <span className={`font-bold ${pct >= 75 ? 'text-emerald-600' : pct >= 40 ? 'text-amber-600' : 'text-red-500'}`}>
                        {pct}%
                      </span>
                    </div>
                    <div className="mb-1.5 flex justify-between text-[0.68rem] text-ink-muted">
                      <span>{meta.fmt(meta.atual)}</span>
                      <span>Meta: {meta.fmt(meta.alvo)}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-black/[0.06]">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${pct}%`, background: meta.cor }}
                      />
                    </div>
                  </div>
                );
              })}
              <p className="pt-1 text-[0.68rem] text-ink-muted">
                Baseado em +10% do período anterior. Atualiza automaticamente.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── Tabela de Lançamentos ── */}
      <div className="mt-5 rounded-2xl bg-white p-5 shadow-card">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-base font-bold text-ink">Lançamentos</h3>
          <div className="flex flex-wrap gap-1">
            {(['todos', 'receita', 'despesa', 'pendente'] as Filtro[]).map((f) => (
              <button
                key={f}
                onClick={() => setFiltro(f)}
                className={`rounded-full px-3 py-1 text-xs font-semibold capitalize transition ${
                  filtro === f ? 'bg-ink text-white' : 'bg-black/[0.04] text-ink-muted hover:bg-black/[0.07]'
                }`}
              >
                {f === 'pendente' ? 'Em aberto' : f}
              </button>
            ))}
          </div>
        </div>

        {filtrados.length === 0 ? (
          <EmptyLancamentos
            onReceita={() => abrirModal('receita')}
            onDespesa={() => abrirModal('despesa')}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-black/[0.06] text-left text-xs text-ink-muted">
                  <th className="pb-2 font-semibold">Data</th>
                  <th className="pb-2 font-semibold">Descrição</th>
                  <th className="hidden pb-2 font-semibold sm:table-cell">Categoria</th>
                  <th className="pb-2 font-semibold">Status</th>
                  <th className="pb-2 text-right font-semibold">Valor</th>
                  <th className="w-16 pb-2" />
                </tr>
              </thead>
              <tbody>
                {filtrados.map((t) => (
                  <tr key={t.id} className="group border-b border-black/[0.04] last:border-0">
                    <td className="py-2.5 text-ink-muted">{formatDate(t.data, { style: 'short' })}</td>
                    <td className="py-2.5 font-medium text-ink-soft">{t.descricao || '—'}</td>
                    <td className="hidden py-2.5 text-ink-muted sm:table-cell">{t.categoria || '—'}</td>
                    <td className="py-2.5">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_CLS[t.status]}`}>
                        {STATUS_LABEL[t.status]}
                      </span>
                    </td>
                    <td className={`py-2.5 text-right font-bold ${t.tipo === 'receita' ? 'text-emerald-600' : 'text-red-600'}`}>
                      {t.tipo === 'receita' ? '+' : '−'}{formatMoney(t.valor)}
                    </td>
                    <td className="py-2.5 pl-2">
                      <div className="flex items-center justify-end gap-0.5 opacity-0 transition group-hover:opacity-100">
                        <button
                          onClick={() => abrirModal(t.tipo, t)}
                          title="Editar"
                          className="rounded p-1.5 text-ink-muted hover:bg-black/[0.04] hover:text-brand"
                        >
                          <IcoEdit />
                        </button>
                        <button
                          onClick={() => handleRemover(t.id)}
                          title={confirmDelete === t.id ? 'Clique para confirmar exclusão' : 'Remover'}
                          className={`rounded px-1.5 py-1 text-xs font-bold transition ${
                            confirmDelete === t.id
                              ? 'bg-red-50 text-red-600'
                              : 'text-ink-muted hover:bg-black/[0.04] hover:text-red-600'
                          }`}
                        >
                          {confirmDelete === t.id ? 'Confirmar?' : <IcoTrash />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Modal Nova/Editar Receita/Despesa ── */}
      {modal && (
        <div className="fixed inset-0 z-[10000] flex items-start justify-center overflow-y-auto bg-black/50 p-4">
          <div className="relative my-8 w-full max-w-md rounded-2xl bg-white p-6 shadow-pop">
            <button
              onClick={() => setModal(null)}
              className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full border border-black/10 text-ink-muted hover:bg-black/[0.03]"
            >
              ✕
            </button>
            <div className="mb-5 flex items-center gap-3">
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${modal.tipo === 'receita' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                {modal.tipo === 'receita' ? <IcoReceita /> : <IcoDespesa />}
              </span>
              <h3 className="font-display text-xl font-bold text-ink">
                {modal.editando
                  ? (modal.tipo === 'receita' ? 'Editar Receita' : 'Editar Despesa')
                  : (modal.tipo === 'receita' ? 'Nova Receita' : 'Nova Despesa')}
              </h3>
            </div>
            <div className="space-y-4">
              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold text-ink-soft">Valor (R$)</span>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={fValor}
                  onChange={(e) => setFValor(e.target.value)}
                  className={inp}
                  autoFocus
                  placeholder="0,00"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold text-ink-soft">Descrição</span>
                <input
                  value={fDesc}
                  onChange={(e) => setFDesc(e.target.value)}
                  className={inp}
                  placeholder="Ex: Casamento Silva — Salão Principal"
                />
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
              <button
                onClick={salvar}
                disabled={saving || !fValor}
                className="rounded-xl bg-brand px-6 py-3 text-sm font-bold text-white transition hover:bg-brand-600 disabled:opacity-60"
              >
                {saving ? 'Salvando…' : modal.editando ? 'Salvar alterações' : 'Salvar lançamento'}
              </button>
              <button onClick={() => setModal(null)} className="ml-auto text-sm font-medium text-ink-muted hover:text-ink">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function Kpi({
  label, value, delta, vs, tone, icon, invertDelta,
}: {
  label: string;
  value: string;
  delta?: number;
  vs?: string;
  tone: 'verde' | 'vermelho' | 'gold' | 'azul';
  icon?: React.ReactNode;
  invertDelta?: boolean;
}) {
  const color = {
    verde: 'text-emerald-600',
    vermelho: 'text-red-600',
    gold: 'text-amber-600',
    azul: 'text-blue-600',
  }[tone];
  const iconBg = {
    verde: 'bg-emerald-50 text-emerald-600',
    vermelho: 'bg-red-50 text-red-600',
    gold: 'bg-amber-50 text-amber-600',
    azul: 'bg-blue-50 text-blue-600',
  }[tone];

  const isGood = delta !== undefined && (invertDelta ? delta < 0 : delta > 0);
  const isBad = delta !== undefined && (invertDelta ? delta > 0 : delta < 0);

  return (
    <div className="rounded-2xl bg-white p-4 shadow-card">
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs text-ink-muted">{label}</span>
        {icon && (
          <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${iconBg}`}>
            {icon}
          </span>
        )}
      </div>
      <div className={`mt-2 text-xl font-bold ${color}`}>{value}</div>
      {delta !== undefined && (
        <div className={`mt-1.5 flex items-center gap-1 text-[0.68rem] font-semibold leading-none ${
          isGood ? 'text-emerald-600' : isBad ? 'text-red-500' : 'text-ink-muted'
        }`}>
          <span>{isGood ? '↑' : isBad ? '↓' : '→'}</span>
          <span>{Math.abs(delta)}%</span>
          <span className="font-normal text-ink-muted">vs {vs}</span>
        </div>
      )}
    </div>
  );
}

function GraficoEvolucao({ dados }: { dados: MesData[] }) {
  const W = 500; const H = 200;
  const PAD = { t: 28, r: 16, b: 42, l: 62 };
  const innerW = W - PAD.l - PAD.r;
  const innerH = H - PAD.t - PAD.b;

  const maxVal = Math.max(...dados.flatMap((d) => [d.receita, d.despesa]), 1);
  const slotW = innerW / dados.length;
  const barW = slotW * 0.28;
  const gap = slotW * 0.05;
  const yTicks = [0, 0.25, 0.5, 0.75, 1];
  const floor = PAD.t + innerH;

  const isEmpty = dados.every((d) => d.receita === 0 && d.despesa === 0);
  if (isEmpty) {
    return (
      <div className="flex h-[180px] items-center justify-center">
        <p className="text-sm text-ink-muted">Adicione lançamentos para ver a evolução mensal.</p>
      </div>
    );
  }

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      preserveAspectRatio="xMidYMid meet"
      aria-label="Gráfico de evolução mensal"
    >
      {/* Grid lines + Y axis labels */}
      {yTicks.map((f) => {
        const y = PAD.t + innerH * (1 - f);
        const label = f === 0
          ? '0'
          : formatMoneyShort(maxVal * f).replace(/ /g, ' ');
        return (
          <g key={f}>
            <line x1={PAD.l} y1={y} x2={W - PAD.r} y2={y} stroke="#f3f4f6" strokeWidth="1" />
            <text x={PAD.l - 6} y={y + 3.5} textAnchor="end" fontSize="8.5" fill="#9ca3af">{label}</text>
          </g>
        );
      })}

      {/* Bars */}
      {dados.map((d, i) => {
        const xSlot = PAD.l + i * slotW;
        const xR = xSlot + slotW * 0.14;
        const xD = xR + barW + gap;
        const hR = (d.receita / maxVal) * innerH;
        const hD = (d.despesa / maxVal) * innerH;
        return (
          <g key={d.mes}>
            {hR > 1 && (
              <rect x={xR} y={floor - hR} width={barW} height={hR} rx="3" fill="#10b981" opacity="0.85" />
            )}
            {hD > 1 && (
              <rect x={xD} y={floor - hD} width={barW} height={hD} rx="3" fill="#ef4444" opacity="0.72" />
            )}
            <text
              x={xSlot + slotW * 0.5}
              y={H - 8}
              textAnchor="middle"
              fontSize="9.5"
              fill="#9ca3af"
            >
              {d.label}
            </text>
          </g>
        );
      })}

      {/* Legend */}
      <rect x={PAD.l} y={8} width={9} height={9} rx="2" fill="#10b981" opacity="0.85" />
      <text x={PAD.l + 13} y={16} fontSize="9" fill="#6b7280">Receita</text>
      <rect x={PAD.l + 65} y={8} width={9} height={9} rx="2" fill="#ef4444" opacity="0.72" />
      <text x={PAD.l + 78} y={16} fontSize="9" fill="#6b7280">Despesa</text>
    </svg>
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
        <button onClick={onReceita} className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600">
          + Receita
        </button>
        <button onClick={onDespesa} className="rounded-xl border border-black/10 px-4 py-2 text-sm font-semibold text-ink-soft hover:border-red-300 hover:text-red-600">
          + Despesa
        </button>
      </div>
    </div>
  );
}

// ── Icons ──────────────────────────────────────────────────────────────────────
function IcoReceita() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 19V5M5 12l7-7 7 7" />
    </svg>
  );
}
function IcoDespesa() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5v14M19 12l-7 7-7-7" />
    </svg>
  );
}
function IcoLucro() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  );
}
function IcoCount() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2" />
    </svg>
  );
}
function IcoAlert() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 9v4M12 17h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
    </svg>
  );
}
function IcoEdit() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4Z" />
    </svg>
  );
}
function IcoTrash() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
    </svg>
  );
}
function IcoCalendar() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9h18M7 3v4M17 3v4M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" />
    </svg>
  );
}
function IcoDownload() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
    </svg>
  );
}
