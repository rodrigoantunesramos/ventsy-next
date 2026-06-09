'use client';

// Aba "Decisão" — a leitura gerencial: para onde vai a ação. Distribuição das
// recomendações (manter · renegociar · trocar · internalizar), o ranking por
// urgência com o porquê de cada uma, os alertas acionáveis (contrato vencendo,
// custo subindo, SLA caindo) e a exportação em CSV. Tudo derivado do motor puro.

import { useMemo } from 'react';
import { formatMoney, formatMoneyShort, formatNumber, formatPercent } from '@/lib/format';
import {
  type TerceiroAgg, type Decisao as DecisaoT,
  DECISOES, decisaoMeta, categoriaLabel, rankearDecisao, exportCSV, modeloLabel,
} from '../_lib';
import type { TerceirosBag } from './shared';
import {
  Kpi, EmptyState, Chip, Farol, btnSecondary,
  IcoGauge, IcoAlert, IcoDownload, IcoTrend, IcoScale, IcoArrowUp, IcoExchange,
} from './ui';

export default function Decisao({ bag, onAbrirFicha }: { bag: TerceirosBag; onAbrirFicha: (id: string) => void }) {
  const { aggs, resumo } = bag;

  const ranking = useMemo(() => rankearDecisao(aggs), [aggs]);
  const alertas = useMemo(() => {
    return aggs
      .flatMap((a) => a.alertas.map((al) => ({ agg: a, al })))
      .filter((x) => x.al.nivel === 'vermelho' || x.al.nivel === 'amarelo')
      .sort((x, y) => peso(y.al.nivel) - peso(x.al.nivel));
  }, [aggs]);

  const exportar = () => {
    exportCSV(
      `decisao-terceiros-${new Date().toISOString().slice(0, 10)}.csv`,
      ['Servico', 'Categoria', 'Modelo', 'Custo mensal', 'Indice de valor', 'SLA cumprido %', 'Decisao', 'Motivo'],
      ranking.map((a) => [
        a.terceiro.servico, categoriaLabel(a.terceiro.categoria), modeloLabel(a.terceiro.modelo_custo),
        a.custoMensal ?? 0, a.indiceValor == null ? '' : Number(a.indiceValor.toFixed(2)),
        a.slaCumpridoPct ?? '', decisaoMeta(a.recomendacao.decisao).label, a.recomendacao.motivo,
      ]),
    );
  };

  if (aggs.length === 0) {
    return (
      <EmptyState icon={<IcoGauge />} title="Sem terceiros para decidir">
        Cadastre terceirizados e registre medições de custo×retorno para receber recomendações de manter, renegociar, trocar ou internalizar.
      </EmptyState>
    );
  }

  return (
    <div className="space-y-5">
      {/* Distribuição das decisões */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {DECISOES.map((d) => (
          <Kpi key={d.v} label={d.label} value={String(resumo.decisoes[d.v as DecisaoT])} tone={toneDe(d.v)} icon={iconDe(d.v)} sub={subDe(d.v)} />
        ))}
      </div>

      {/* Alertas acionáveis */}
      <div className="rounded-2xl bg-white p-4 shadow-card">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-ink"><IcoAlert /> Alertas acionáveis</h3>
        {alertas.length === 0 ? (
          <p className="text-sm text-ink-muted">Nenhum alerta no momento — contratos em dia, custos estáveis e SLA dentro da meta.</p>
        ) : (
          <div className="space-y-1.5">
            {alertas.slice(0, 10).map(({ agg, al }, i) => (
              <button key={`${agg.terceiro.id}-${i}`} onClick={() => onAbrirFicha(agg.terceiro.id)}
                className="flex w-full items-center justify-between gap-3 rounded-lg border border-black/[0.05] px-3 py-2 text-left text-sm hover:bg-black/[0.02]">
                <span className="flex min-w-0 items-center gap-2">
                  <Farol nivel={al.nivel} />
                  <span className="truncate font-medium text-ink">{agg.terceiro.servico}</span>
                </span>
                <span className={`shrink-0 text-xs ${al.nivel === 'vermelho' ? 'text-red-600' : 'text-amber-700'}`}>{al.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Ranking de decisão */}
      <div className="rounded-2xl bg-white p-4 shadow-card">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-ink">Ranking — o que decidir primeiro</h3>
          <button onClick={exportar} className={btnSecondary}><IcoDownload /> CSV</button>
        </div>
        <div className="space-y-2">
          {ranking.map((a) => <LinhaDecisao key={a.terceiro.id} agg={a} onClick={() => onAbrirFicha(a.terceiro.id)} />)}
        </div>
      </div>
    </div>
  );
}

function peso(n: string): number { return n === 'vermelho' ? 2 : n === 'amarelo' ? 1 : 0; }
function toneDe(d: DecisaoT): 'verde' | 'gold' | 'roxo' | 'vermelho' {
  return d === 'manter' ? 'verde' : d === 'renegociar' ? 'gold' : d === 'internalizar' ? 'roxo' : 'vermelho';
}
function iconDe(d: DecisaoT) {
  return d === 'manter' ? <IcoScale /> : d === 'renegociar' ? <IcoTrend /> : d === 'internalizar' ? <IcoExchange /> : <IcoArrowUp />;
}
function subDe(d: DecisaoT): string {
  return d === 'manter' ? 'no rumo' : d === 'renegociar' ? 'rever termos' : d === 'internalizar' ? 'trazer p/ dentro' : 'substituir';
}

function LinhaDecisao({ agg, onClick }: { agg: TerceiroAgg; onClick: () => void }) {
  const dec = decisaoMeta(agg.recomendacao.decisao);
  return (
    <button onClick={onClick} className="flex w-full flex-col gap-2 rounded-xl border border-black/[0.05] p-3 text-left transition hover:bg-black/[0.02] sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white" style={{ background: dec.cor }}>{dec.verbo[0]}</span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate font-semibold text-ink">{agg.terceiro.servico}</span>
            <Chip className="bg-black/[0.04] text-ink-soft">{categoriaLabel(agg.terceiro.categoria)}</Chip>
            <Chip className={dec.chip}>{dec.label}</Chip>
          </div>
          <p className="mt-0.5 truncate text-xs text-ink-muted">{agg.recomendacao.motivo}</p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-4 pl-11 sm:pl-0">
        <div className="text-right">
          <div className="text-[0.62rem] uppercase tracking-wide text-ink-muted">Custo/mês</div>
          <div className="text-sm font-bold text-ink">{agg.custoMensal == null ? '—' : formatMoneyShort(agg.custoMensal)}</div>
        </div>
        <div className="text-right">
          <div className="text-[0.62rem] uppercase tracking-wide text-ink-muted">Valor</div>
          <div className={`text-sm font-semibold ${agg.indiceValor == null ? 'text-ink-muted' : agg.indiceValor >= 1 ? 'text-emerald-600' : 'text-red-600'}`}>{agg.indiceValor == null ? '—' : `${formatNumber(agg.indiceValor, { maximumFractionDigits: 1 })}×`}</div>
        </div>
        <div className="hidden text-right sm:block">
          <div className="text-[0.62rem] uppercase tracking-wide text-ink-muted">SLA</div>
          <div className="flex items-center justify-end gap-1 text-sm font-semibold text-ink-soft">
            <Farol nivel={agg.slaNivel} />{agg.slaCumpridoPct == null ? '—' : formatPercent(agg.slaCumpridoPct / 100, { maximumFractionDigits: 0 })}
          </div>
        </div>
      </div>
    </button>
  );
}
