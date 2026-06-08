'use client';

// Aba "Agenda" — calendário de vencimentos unificado (entradas + saídas).
//   • Mês navegável; cada dia soma entradas (verde) e saídas (vermelho) em aberto
//   • Clicar num dia filtra a lista; total líquido do mês no topo
//   • Exporta a agenda do mês (CSV)
// Considera apenas itens EM ABERTO (não pagos/cancelados) — é uma previsão.

import { useMemo, useState } from 'react';
import { formatMoney, formatMoneyShort, formatDate } from '@/lib/format';
import { type Parcela, type Evento, type ContaPagar, MESES_PT, ymd, exportAgendaCSV } from '../_lib';
import { IcoChevronLeft, IcoChevronRight, IcoDownload } from './ui';

type Lin = { data: string; tipo: 'entrada' | 'saida'; descricao: string; valor: number };
const SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export default function Agenda({ parcelas, eventos, contas }: { parcelas: Parcela[]; eventos: Evento[]; contas: ContaPagar[] }) {
  const inicio = new Date();
  const [ref, setRef] = useState<{ y: number; m: number }>({ y: inicio.getFullYear(), m: inicio.getMonth() });
  const [diaSel, setDiaSel] = useState<string | null>(null);
  const hoje = ymd(inicio);

  const linhas = useMemo<Lin[]>(() => {
    const out: Lin[] = [];
    parcelas.forEach((p) => {
      if (p.status === 'pago' || p.status === 'cancelado' || !p.vencimento) return;
      const ev = eventos.find((e) => e.id === p.evento_id);
      out.push({ data: p.vencimento, tipo: 'entrada', descricao: `${ev?.nome_evento || 'Evento'}${p.descricao ? ' — ' + p.descricao : ''}`, valor: p.valor });
    });
    contas.forEach((c) => {
      if (c.status === 'pago' || c.status === 'cancelado' || !c.vencimento) return;
      out.push({ data: c.vencimento, tipo: 'saida', descricao: c.descricao, valor: c.valor });
    });
    return out;
  }, [parcelas, eventos, contas]);

  const monthKey = `${ref.y}-${String(ref.m + 1).padStart(2, '0')}`;
  const doMes = useMemo(() => linhas.filter((l) => l.data.slice(0, 7) === monthKey), [linhas, monthKey]);

  // Mapa por dia + totais do mês.
  const { porDia, totEnt, totSai } = useMemo(() => {
    const m = new Map<string, { ent: number; sai: number }>();
    let te = 0, ts = 0;
    doMes.forEach((l) => {
      const slot = m.get(l.data) || { ent: 0, sai: 0 };
      if (l.tipo === 'entrada') { slot.ent += l.valor; te += l.valor; } else { slot.sai += l.valor; ts += l.valor; }
      m.set(l.data, slot);
    });
    return { porDia: m, totEnt: te, totSai: ts };
  }, [doMes]);

  const grade = useMemo(() => {
    const first = new Date(ref.y, ref.m, 1);
    const offset = first.getDay();
    const nDias = new Date(ref.y, ref.m + 1, 0).getDate();
    const cells: (string | null)[] = [];
    for (let i = 0; i < offset; i++) cells.push(null);
    for (let d = 1; d <= nDias; d++) cells.push(ymd(new Date(ref.y, ref.m, d)));
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [ref]);

  function navega(delta: number) {
    setDiaSel(null);
    setRef((r) => { const d = new Date(r.y, r.m + delta, 1); return { y: d.getFullYear(), m: d.getMonth() }; });
  }
  function irHoje() { setDiaSel(null); setRef({ y: inicio.getFullYear(), m: inicio.getMonth() }); }

  const lista = useMemo(() => {
    const base = diaSel ? doMes.filter((l) => l.data === diaSel) : doMes;
    return [...base].sort((a, b) => a.data.localeCompare(b.data) || (a.tipo === b.tipo ? 0 : a.tipo === 'saida' ? 1 : -1));
  }, [doMes, diaSel]);

  const liquido = totEnt - totSai;

  return (
    <div>
      {/* Cabeçalho do mês */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button onClick={() => navega(-1)} aria-label="Mês anterior" className="flex h-9 w-9 items-center justify-center rounded-lg border border-black/10 text-ink-soft hover:bg-black/[0.03]"><IcoChevronLeft /></button>
          <h3 className="min-w-[140px] text-center text-base font-bold text-ink">{MESES_PT[ref.m]} {ref.y}</h3>
          <button onClick={() => navega(1)} aria-label="Próximo mês" className="flex h-9 w-9 items-center justify-center rounded-lg border border-black/10 text-ink-soft hover:bg-black/[0.03]"><IcoChevronRight /></button>
          <button onClick={irHoje} className="ml-1 rounded-lg border border-black/10 px-3 py-1.5 text-xs font-semibold text-ink-soft hover:bg-black/[0.03]">Hoje</button>
        </div>
        <button onClick={() => exportAgendaCSV(doMes, hoje)} disabled={doMes.length === 0}
          className="inline-flex items-center gap-1.5 rounded-xl border border-black/10 bg-white px-3.5 py-2.5 text-sm font-medium text-ink-soft hover:bg-black/[0.03] disabled:opacity-50"><IcoDownload /> Exportar mês</button>
      </div>

      {/* Totais do mês */}
      <div className="mt-4 grid grid-cols-3 gap-3">
        <div className="rounded-2xl bg-white p-4 shadow-card"><div className="text-xs text-ink-muted">Entradas previstas</div><div className="mt-1 text-lg font-bold text-emerald-600">{formatMoneyShort(totEnt)}</div></div>
        <div className="rounded-2xl bg-white p-4 shadow-card"><div className="text-xs text-ink-muted">Saídas previstas</div><div className="mt-1 text-lg font-bold text-red-600">{formatMoneyShort(totSai)}</div></div>
        <div className="rounded-2xl bg-white p-4 shadow-card"><div className="text-xs text-ink-muted">Líquido do mês</div><div className={`mt-1 text-lg font-bold ${liquido >= 0 ? 'text-blue-600' : 'text-amber-600'}`}>{formatMoneyShort(liquido)}</div></div>
      </div>

      {/* Calendário */}
      <div className="mt-5 rounded-2xl bg-white p-4 shadow-card sm:p-5">
        <div className="mb-2 grid grid-cols-7 gap-1 text-center text-[0.65rem] font-semibold uppercase tracking-wide text-ink-muted">
          {SEMANA.map((s) => <div key={s}>{s}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {grade.map((dia, i) => {
            if (!dia) return <div key={`b${i}`} className="aspect-square rounded-lg bg-transparent" />;
            const tot = porDia.get(dia);
            const isHoje = dia === hoje;
            const sel = dia === diaSel;
            const num = Number(dia.slice(8, 10));
            return (
              <button key={dia} onClick={() => setDiaSel(sel ? null : dia)}
                className={`flex aspect-square flex-col items-stretch rounded-lg border p-1 text-left transition ${sel ? 'border-brand ring-2 ring-brand/20' : 'border-black/[0.05] hover:border-brand/30'} ${isHoje ? 'bg-brand-50/40' : 'bg-white'}`}>
                <span className={`text-[0.7rem] font-semibold ${isHoje ? 'text-brand' : 'text-ink-soft'}`}>{num}</span>
                <span className="mt-auto space-y-0.5">
                  {!!tot?.ent && <span className="block truncate text-[0.6rem] font-bold text-emerald-600">+{formatMoneyShort(tot.ent)}</span>}
                  {!!tot?.sai && <span className="block truncate text-[0.6rem] font-bold text-red-600">−{formatMoneyShort(tot.sai)}</span>}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Lista do mês / dia */}
      <div className="mt-5 rounded-2xl bg-white p-5 shadow-card">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-bold text-ink">{diaSel ? `Vencimentos em ${formatDate(diaSel, { style: 'medium' })}` : 'Vencimentos do mês'}</h3>
          {diaSel && <button onClick={() => setDiaSel(null)} className="text-xs font-semibold text-brand hover:underline">Ver o mês todo</button>}
        </div>
        {lista.length === 0 ? (
          <p className="py-10 text-center text-sm text-ink-muted">Nenhum vencimento em aberto neste período.</p>
        ) : (
          <div className="space-y-1.5">
            {lista.map((l, i) => (
              <div key={i} className="flex items-center gap-3 rounded-xl border border-black/[0.05] px-3 py-2.5">
                <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${l.tipo === 'entrada' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>{l.tipo === 'entrada' ? '+' : '−'}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink-soft">{l.descricao}</p>
                  <p className="text-xs text-ink-muted">{formatDate(l.data, { style: 'short' })} · {l.tipo === 'entrada' ? 'A receber' : 'A pagar'}</p>
                </div>
                <span className={`shrink-0 text-sm font-bold ${l.tipo === 'entrada' ? 'text-emerald-600' : 'text-red-600'}`}>{formatMoney(l.valor)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
