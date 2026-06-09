'use client';

// Aba "Custos" — onde o dinheiro de seguro vai: prêmio por escopo (donut),
// custo de seguro por evento (prêmio dedicado + rateio das gerais) e o índice
// de sinistralidade por escopo. Exporta o custo por evento em CSV.

import { useMemo } from 'react';
import { formatMoney, formatMoneyShort, formatPercent, formatDate } from '@/lib/format';
import {
  ESCOPOS, escopoLabel, escopoCor,
  resumoCarteira, resumoSinistros, sinistralidade, rateioPremioEvento, eventoLabel,
  exportCSV,
} from '../_lib';
import type { SegurosBag } from './shared';
import { Kpi, EmptyState, btnSecondary, IcoMoney, IcoShield, IcoAlert, IcoDownload, IcoCalendar } from './ui';

export default function Custos({ bag }: { bag: SegurosBag }) {
  const { seguros, sinistros, eventos, hoje } = bag;

  const resumo = useMemo(() => resumoCarteira(seguros, hoje), [seguros, hoje]);
  const resSin = useMemo(() => resumoSinistros(sinistros), [sinistros]);
  const premioTotal = useMemo(() => seguros.reduce((a, s) => a + s.premio_num, 0), [seguros]);
  const indiceGeral = sinistralidade(premioTotal, resSin.indenizado);
  const custoMedio = resumo.vigentes > 0 ? resumo.premioVigente / resumo.vigentes : 0;

  // Custo de seguro por evento (dedicado + rateio das apólices gerais).
  const porEvento = useMemo(() => {
    const gerais = seguros.filter((s) => !s.evento_id && (s.escopo === 'patrimonial' || s.escopo === 'rc' || s.escopo === 'frota' || s.escopo === 'equipamento'));
    return eventos
      .map((ev) => {
        const dedicado = seguros.filter((s) => s.evento_id === ev.id).reduce((a, s) => a + s.premio_num, 0);
        const rateio = gerais.reduce((a, s) => a + (rateioPremioEvento(s, ev.data_inicio, ev.data_fim) ?? 0), 0);
        return { ev, dedicado, rateio, total: dedicado + rateio };
      })
      .filter((x) => x.total > 0)
      .sort((a, b) => b.total - a.total);
  }, [seguros, eventos]);

  // Sinistralidade por escopo.
  const porEscopoSin = useMemo(() => {
    return ESCOPOS
      .map((e) => {
        const segs = seguros.filter((s) => s.escopo === e.v);
        const premio = segs.reduce((a, s) => a + s.premio_num, 0);
        const ids = new Set(segs.map((s) => s.id));
        const indeniz = sinistros.filter((x) => ids.has(x.seguro_id)).reduce((a, x) => a + x.valor_indenizado_num, 0);
        return { escopo: e.v, premio, indeniz, indice: sinistralidade(premio, indeniz) };
      })
      .filter((x) => x.premio > 0 || x.indeniz > 0);
  }, [seguros, sinistros]);

  const donut = resumo.porEscopo.filter((e) => e.premio > 0).map((e) => ({ label: escopoLabel(e.escopo), valor: e.premio, cor: escopoCor(e.escopo) }));

  const exportar = () => {
    exportCSV(
      'custo-seguro-por-evento.csv',
      ['Evento', 'Data', 'Premio dedicado', 'Rateio geral', 'Custo total'],
      porEvento.map((x) => [eventoLabel(x.ev), x.ev.data_inicio || '', x.dedicado, x.rateio, x.total]),
    );
  };

  if (seguros.length === 0) {
    return (
      <EmptyState icon={<IcoMoney />} title="Sem custos para analisar ainda">
        Cadastre apólices na aba <strong>Carteira</strong> para ver o prêmio por escopo, o custo de seguro por evento e a sinistralidade.
      </EmptyState>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Prêmio vigente" value={formatMoneyShort(resumo.premioVigente)} tone="brand" icon={<IcoMoney />} sub={`${resumo.vigentes} apólice(s)`} />
        <Kpi label="Custo médio / apólice" value={formatMoneyShort(custoMedio)} tone="azul" icon={<IcoShield />} />
        <Kpi label="Indenizado (histórico)" value={formatMoneyShort(resSin.indenizado)} tone="verde" icon={<IcoMoney />} />
        <Kpi label="Sinistralidade geral" value={indiceGeral == null ? '—' : formatPercent(indiceGeral)} tone={indiceGeral != null && indiceGeral > 0.7 ? 'vermelho' : 'ink'} icon={<IcoAlert />} sub="indenizado ÷ prêmio" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Donut prêmio por escopo */}
        <div className="rounded-2xl bg-white p-4 shadow-card">
          <h3 className="mb-3 text-sm font-bold text-ink">Prêmio vigente por escopo</h3>
          {donut.length === 0 ? (
            <p className="text-sm text-ink-muted">Nenhuma apólice vigente com prêmio.</p>
          ) : (
            <div className="flex items-center gap-5">
              <Donut data={donut} centro={formatMoneyShort(resumo.premioVigente)} />
              <div className="min-w-0 flex-1 space-y-1.5">
                {donut.map((d) => (
                  <div key={d.label} className="flex items-center justify-between gap-2 text-sm">
                    <span className="flex min-w-0 items-center gap-2 text-ink-soft">
                      <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: d.cor }} />
                      <span className="truncate">{d.label}</span>
                    </span>
                    <span className="shrink-0 font-semibold text-ink">{formatMoney(d.valor)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sinistralidade por escopo */}
        <div className="rounded-2xl bg-white p-4 shadow-card">
          <h3 className="mb-3 text-sm font-bold text-ink">Sinistralidade por escopo</h3>
          {porEscopoSin.length === 0 ? (
            <p className="text-sm text-ink-muted">Sem dados de prêmio/indenização ainda.</p>
          ) : (
            <div className="space-y-3">
              {porEscopoSin.map((x) => {
                const frac = x.indice == null ? 0 : Math.min(1, x.indice);
                const alto = x.indice != null && x.indice > 0.7;
                return (
                  <div key={x.escopo}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="font-medium text-ink-soft">{escopoLabel(x.escopo)}</span>
                      <span className={`font-semibold ${alto ? 'text-red-600' : 'text-ink'}`}>{x.indice == null ? '—' : formatPercent(x.indice)}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-black/[0.05]">
                      <div className={`h-full rounded-full ${alto ? 'bg-red-500' : 'bg-emerald-500'}`} style={{ width: `${Math.max(2, frac * 100)}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Custo de seguro por evento */}
      <div className="rounded-2xl bg-white p-4 shadow-card">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-ink">Custo de seguro por evento</h3>
          {porEvento.length > 0 && <button onClick={exportar} className={btnSecondary}><IcoDownload /> CSV</button>}
        </div>
        {porEvento.length === 0 ? (
          <div className="py-6 text-center text-sm text-ink-muted">
            <span className="mb-2 inline-flex h-10 w-10 items-center justify-center rounded-full bg-black/[0.04] text-ink-muted"><IcoCalendar /></span>
            <p>Nenhum custo de seguro recai sobre eventos ainda. Vincule apólices a eventos na aba <strong>Por evento</strong>.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-black/[0.06] text-left text-xs uppercase tracking-wide text-ink-muted">
                  <th className="pb-2 pr-3 font-semibold">Evento</th>
                  <th className="pb-2 pr-3 text-right font-semibold">Dedicado</th>
                  <th className="hidden pb-2 pr-3 text-right font-semibold sm:table-cell">Rateio</th>
                  <th className="pb-2 text-right font-semibold">Total</th>
                </tr>
              </thead>
              <tbody>
                {porEvento.map((x) => (
                  <tr key={x.ev.id} className="border-b border-black/[0.04]">
                    <td className="py-2 pr-3">
                      <div className="font-medium text-ink">{eventoLabel(x.ev)}</div>
                      <div className="text-xs text-ink-muted">{x.ev.data_inicio ? formatDate(x.ev.data_inicio, { style: 'short' }) : '—'}{x.ev.tipo_evento ? ` · ${x.ev.tipo_evento}` : ''}</div>
                    </td>
                    <td className="py-2 pr-3 text-right text-ink-soft">{x.dedicado > 0 ? formatMoney(x.dedicado) : '—'}</td>
                    <td className="hidden py-2 pr-3 text-right text-ink-soft sm:table-cell">{x.rateio > 0 ? formatMoney(x.rateio) : '—'}</td>
                    <td className="py-2 text-right font-bold text-ink">{formatMoney(x.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Donut SVG puro ──────────────────────────────────────────────────────────
function Donut({ data, centro }: { data: { label: string; valor: number; cor: string }[]; centro: string }) {
  const total = data.reduce((a, d) => a + d.valor, 0);
  const R = 54;
  const C = 2 * Math.PI * R;
  let off = 0;
  return (
    <div className="relative h-36 w-36 shrink-0">
      <svg viewBox="0 0 140 140" className="h-36 w-36 -rotate-90">
        <circle cx={70} cy={70} r={R} fill="none" stroke="#0000000d" strokeWidth={16} />
        {total > 0 && data.map((d, i) => {
          const len = (d.valor / total) * C;
          const el = (
            <circle key={i} cx={70} cy={70} r={R} fill="none" stroke={d.cor} strokeWidth={16}
              strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-off} strokeLinecap="butt" />
          );
          off += len;
          return el;
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[0.65rem] text-ink-muted">Total</span>
        <span className="text-sm font-bold text-ink">{centro}</span>
      </div>
    </div>
  );
}
