'use client';

// Aba "Visão geral" — posição consolidada de AP/AR num só lugar.
//   • A receber × A pagar × Saldo projetado
//   • Fluxo dos próximos 7 e 30 dias (entradas − saídas = líquido)
//   • Aging lado a lado (a receber × a pagar)
//   • Alertas: inadimplência (receber em atraso) e contas em atraso (pagar)
// Somente leitura/atalhos; ações ficam nas abas dedicadas.

import { useMemo } from 'react';
import { formatMoney, formatMoneyShort } from '@/lib/format';
import {
  type Parcela, type ContaPagar, AGING_BUCKETS,
  ymd, aging, efetivoReceber, efetivoPagar,
} from '../_lib';
import { Kpi, IcoArrowUp, IcoArrowDown, IcoScale, IcoAlert } from './ui';

type Tab = 'visao' | 'receber' | 'pagar' | 'agenda';

export default function VisaoGeral({ parcelas, contas, onGoTab }: {
  parcelas: Parcela[]; contas: ContaPagar[]; onGoTab: (t: Tab) => void;
}) {
  const hoje = ymd(new Date());

  const dados = useMemo(() => {
    const recAberto = parcelas.filter((p) => { const e = efetivoReceber(p, hoje); return e !== 'pago' && e !== 'cancelado'; });
    const pagAberto = contas.filter((c) => { const e = efetivoPagar(c, hoje); return e !== 'pago' && e !== 'cancelado'; });
    const aReceber = recAberto.reduce((s, p) => s + p.valor, 0);
    const aPagar = pagAberto.reduce((s, c) => s + c.valor, 0);
    const recVencido = recAberto.filter((p) => efetivoReceber(p, hoje) === 'atrasado').reduce((s, p) => s + p.valor, 0);
    const pagVencido = pagAberto.filter((c) => efetivoPagar(c, hoje) === 'atrasado').reduce((s, c) => s + c.valor, 0);
    const nRecVencido = recAberto.filter((p) => efetivoReceber(p, hoje) === 'atrasado').length;
    const nPagVencido = pagAberto.filter((c) => efetivoPagar(c, hoje) === 'atrasado').length;

    const janela = (itens: { vencimento: string | null; valor: number }[], dias: number) => {
      const base = new Date(hoje + 'T12:00:00'); const lim = new Date(base); lim.setDate(lim.getDate() + dias);
      const limStr = ymd(lim);
      return itens.filter((x) => x.vencimento && x.vencimento >= hoje && x.vencimento <= limStr).reduce((s, x) => s + x.valor, 0);
    };
    const j7 = { ent: janela(recAberto, 7), sai: janela(pagAberto, 7) };
    const j30 = { ent: janela(recAberto, 30), sai: janela(pagAberto, 30) };

    return {
      aReceber, aPagar, saldo: aReceber - aPagar, recVencido, pagVencido, nRecVencido, nPagVencido,
      agRec: aging(recAberto.map((p) => ({ vencimento: p.vencimento, valor: p.valor })), hoje),
      agPag: aging(pagAberto.map((c) => ({ vencimento: c.vencimento, valor: c.valor })), hoje),
      j7, j30,
    };
  }, [parcelas, contas, hoje]);

  return (
    <div>
      {/* Posição */}
      <div className="mt-1 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <button onClick={() => onGoTab('receber')} className="text-left"><Kpi label="Total a receber" value={formatMoney(dados.aReceber)} tone="azul" icon={<IcoArrowDown />} hint="parcelas de eventos em aberto" /></button>
        <button onClick={() => onGoTab('pagar')} className="text-left"><Kpi label="Total a pagar" value={formatMoney(dados.aPagar)} tone="roxo" icon={<IcoArrowUp />} hint="fornecedores, folha e recorrências" /></button>
        <Kpi label="Saldo projetado" value={formatMoney(dados.saldo)} tone={dados.saldo >= 0 ? 'verde' : 'vermelho'} icon={<IcoScale />} hint="a receber − a pagar" />
      </div>

      {/* Alertas de atraso */}
      {(dados.recVencido > 0 || dados.pagVencido > 0) && (
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {dados.recVencido > 0 && (
            <button onClick={() => onGoTab('receber')} className="flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50/50 p-4 text-left hover:bg-red-50">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600"><IcoAlert /></span>
              <div className="min-w-0">
                <p className="text-sm font-bold text-red-700">Inadimplência: {formatMoney(dados.recVencido)}</p>
                <p className="text-xs text-ink-muted">{dados.nRecVencido} parcela(s) vencida(s) a receber</p>
              </div>
            </button>
          )}
          {dados.pagVencido > 0 && (
            <button onClick={() => onGoTab('pagar')} className="flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50/50 p-4 text-left hover:bg-red-50">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600"><IcoAlert /></span>
              <div className="min-w-0">
                <p className="text-sm font-bold text-red-700">Em atraso a pagar: {formatMoney(dados.pagVencido)}</p>
                <p className="text-xs text-ink-muted">{dados.nPagVencido} conta(s) vencida(s)</p>
              </div>
            </button>
          )}
        </div>
      )}

      {/* Fluxo próximos 7 / 30 dias */}
      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
        {([['Próximos 7 dias', dados.j7], ['Próximos 30 dias', dados.j30]] as const).map(([titulo, j]) => {
          const liquido = j.ent - j.sai;
          return (
            <div key={titulo} className="rounded-2xl bg-white p-5 shadow-card">
              <h3 className="mb-3 text-base font-bold text-ink">{titulo}</h3>
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl bg-emerald-50 p-3">
                  <div className="text-[0.7rem] text-emerald-700">Entradas</div>
                  <div className="mt-1 text-base font-bold text-emerald-700">{formatMoneyShort(j.ent)}</div>
                </div>
                <div className="rounded-xl bg-red-50 p-3">
                  <div className="text-[0.7rem] text-red-700">Saídas</div>
                  <div className="mt-1 text-base font-bold text-red-700">{formatMoneyShort(j.sai)}</div>
                </div>
                <div className={`rounded-xl p-3 ${liquido >= 0 ? 'bg-blue-50' : 'bg-amber-50'}`}>
                  <div className={`text-[0.7rem] ${liquido >= 0 ? 'text-blue-700' : 'text-amber-700'}`}>Líquido</div>
                  <div className={`mt-1 text-base font-bold ${liquido >= 0 ? 'text-blue-700' : 'text-amber-700'}`}>{formatMoneyShort(liquido)}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Aging lado a lado */}
      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
        {([['A receber', dados.agRec, 'azul'], ['A pagar', dados.agPag, 'roxo']] as const).map(([titulo, a, tone]) => (
          <div key={titulo} className="rounded-2xl bg-white p-5 shadow-card">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-base font-bold text-ink">Aging · {titulo}</h3>
              <span className={`text-sm font-bold ${tone === 'azul' ? 'text-blue-600' : 'text-violet-600'}`}>{formatMoneyShort(a.total)}</span>
            </div>
            <div className="space-y-2">
              {AGING_BUCKETS.map((b) => {
                const v = a[b.key]; const pct = a.total > 0 ? Math.round((v / a.total) * 100) : 0;
                return (
                  <div key={b.key}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="text-ink-soft">{b.label}</span>
                      <span className={`font-semibold ${b.cls}`}>{formatMoneyShort(v)}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-black/[0.06]">
                      <div className={`h-full rounded-full transition-all duration-500 ${tone === 'azul' ? 'bg-blue-500' : 'bg-violet-500'}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
            {a.total === 0 && <p className="pt-2 text-center text-xs text-ink-muted">Nada em aberto.</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
