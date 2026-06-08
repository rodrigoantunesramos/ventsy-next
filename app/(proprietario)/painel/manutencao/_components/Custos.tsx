'use client';

// Aba "Custos" — onde o dinheiro da manutenção é gasto e a decisão consertar ×
// repor mora.
//   • Custo por mês (últimos 6) — barras SVG puras.
//   • Custo acumulado por ativo/espaço (ranking) — quem mais custa.
//   • Peças mais usadas (volume e custo).
//   • MTTR e custo médio por OS.
// Tudo deriva do motor puro lib/manutencao; formatação só por lib/format.

import { useMemo } from 'react';
import { formatMoney, formatMoneyShort, formatMonth, formatNumber } from '@/lib/format';
import {
  type OS, type PropriedadeLite, type EspacoLite,
  custoPorMes, custoPorAtivo, pecasMaisUsadas, mttrDias, custoOS, exportCSV, ymd,
} from '../_lib';
import { Kpi, Bars, IcoWallet, IcoGauge, IcoBox, IcoDownload, IcoWrench } from './ui';

export default function Custos({ os, props, espacos }: { os: OS[]; props: PropriedadeLite[]; espacos: EspacoLite[] }) {
  const nowMs = useMemo(() => Date.now(), []);
  const hoje = ymd(new Date(nowMs));
  const propMap = useMemo(() => new Map(props.map((p) => [p.id, p.nome])), [props]);
  const espMap = useMemo(() => new Map(espacos.map((e) => [e.id, e.nome])), [espacos]);

  const concluidas = useMemo(() => os.filter((o) => o.status === 'concluida'), [os]);
  const naoCanceladas = useMemo(() => os.filter((o) => o.status !== 'cancelada'), [os]);

  const serieMes = useMemo(() => custoPorMes(os, nowMs, 6), [os, nowMs]);
  const porAtivo = useMemo(() => custoPorAtivo(os), [os]);
  const pecas = useMemo(() => pecasMaisUsadas(os), [os]);
  const mttr = useMemo(() => mttrDias(os), [os]);

  const custoTotal = useMemo(() => naoCanceladas.reduce((s, o) => s + custoOS(o), 0), [naoCanceladas]);
  const custoConcluidas = useMemo(() => concluidas.reduce((s, o) => s + custoOS(o), 0), [concluidas]);
  const custoMedio = concluidas.length ? custoConcluidas / concluidas.length : 0;

  function alvoNome(c: (typeof porAtivo)[number]): string {
    if (c.ativo_nome) return c.ativo_nome;
    if (c.propriedade_id != null && propMap.has(c.propriedade_id)) return propMap.get(c.propriedade_id)!;
    return 'Ativo';
  }
  const maxAtivo = Math.max(1, ...porAtivo.map((a) => a.custo));

  function exportarAtivos() {
    const header = ['Ativo / espaço', 'Nº de OS', 'Custo acumulado', 'Última manutenção'];
    const rows = porAtivo.map((a) => [alvoNome(a), a.n, a.custo, a.ultima || ''] as (string | number)[]);
    exportCSV(`custos-manutencao-${hoje}.csv`, header, rows);
  }

  if (naoCanceladas.length === 0) {
    return (
      <div className="rounded-2xl bg-white p-10 text-center shadow-card">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-50 text-brand"><IcoWallet /></div>
        <h2 className="text-lg font-bold text-ink">Sem custos de manutenção ainda</h2>
        <p className="mx-auto mt-1 max-w-md text-sm text-ink-muted">Conforme você registra peças e mão de obra nas OS, este painel mostra onde o dinheiro vai e ajuda a decidir entre consertar e repor cada ativo.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Custo total" value={formatMoneyShort(custoTotal)} sub={`${naoCanceladas.length} OS`} tone="gold" icon={<IcoWallet />} />
        <Kpi label="Custo concluído" value={formatMoneyShort(custoConcluidas)} sub={`${concluidas.length} concluída(s)`} tone="verde" icon={<IcoWrench />} />
        <Kpi label="Custo médio / OS" value={formatMoney(custoMedio)} sub="concluídas" tone="azul" icon={<IcoBox />} />
        <Kpi label="MTTR (corretivas)" value={mttr.n ? `${mttr.dias.toFixed(1)} d` : '—'} sub={mttr.n ? `${mttr.n} reparo(s)` : 'sem histórico'} tone="roxo" icon={<IcoGauge />} />
      </div>

      {/* Custo por mês */}
      <div className="rounded-2xl bg-white p-5 shadow-card">
        <h3 className="mb-4 text-base font-bold text-ink">Custo por mês</h3>
        <Bars data={serieMes.map((b) => ({ label: formatMonth(b.mes, { withYear: false }), value: b.custo }))} fmt={(v) => formatMoneyShort(v)} />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Custo por ativo/espaço */}
        <div className="rounded-2xl bg-white p-5 shadow-card">
          <div className="mb-1 flex items-center justify-between gap-2">
            <h3 className="text-base font-bold text-ink">Custo por ativo / espaço</h3>
            <button onClick={exportarAtivos} className="inline-flex items-center gap-1.5 rounded-lg border border-black/10 px-2.5 py-1.5 text-xs font-medium text-ink-muted hover:border-brand/30 hover:text-brand"><IcoDownload /> CSV</button>
          </div>
          <p className="mb-4 text-xs text-ink-muted">Quem mais consome manutenção — base para decidir <strong>consertar × repor</strong>.</p>
          {porAtivo.length === 0 ? (
            <p className="py-8 text-center text-sm text-ink-muted">Vincule OS a um ativo/espaço para ver o ranking.</p>
          ) : (
            <div className="space-y-2.5">
              {porAtivo.slice(0, 8).map((a, i) => (
                <div key={a.chave} className="flex items-center gap-3">
                  <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${i === 0 ? 'bg-amber-100 text-amber-700' : 'bg-black/[0.05] text-ink-muted'}`}>{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-semibold text-ink">{alvoNome(a)}</span>
                      <span className="shrink-0 text-sm font-bold text-ink-soft">{formatMoney(a.custo)}</span>
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-black/[0.06]"><div className="h-full rounded-full bg-brand/80" style={{ width: `${Math.round((a.custo / maxAtivo) * 100)}%` }} /></div>
                      <span className="shrink-0 text-[0.68rem] text-ink-muted">{a.n} OS</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Peças mais usadas */}
        <div className="rounded-2xl bg-white p-5 shadow-card">
          <h3 className="mb-1 text-base font-bold text-ink">Peças mais usadas</h3>
          <p className="mb-4 text-xs text-ink-muted">Volume e custo das peças aplicadas nas OS.</p>
          {pecas.length === 0 ? (
            <p className="py-8 text-center text-sm text-ink-muted">Nenhuma peça registrada nas OS.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-black/[0.06] text-left text-xs text-ink-muted">
                    <th className="pb-2 font-semibold">Peça</th>
                    <th className="pb-2 text-right font-semibold">Qtd.</th>
                    <th className="pb-2 text-right font-semibold">OS</th>
                    <th className="pb-2 text-right font-semibold">Custo</th>
                  </tr>
                </thead>
                <tbody>
                  {pecas.slice(0, 8).map((p, i) => (
                    <tr key={i} className="border-b border-black/[0.04] last:border-0">
                      <td className="py-2 font-medium text-ink-soft">{p.descricao}</td>
                      <td className="py-2 text-right text-ink-muted">{formatNumber(p.quantidade)}</td>
                      <td className="py-2 text-right text-ink-muted">{p.n}</td>
                      <td className="py-2 text-right font-bold text-ink-soft">{formatMoney(p.custo)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
