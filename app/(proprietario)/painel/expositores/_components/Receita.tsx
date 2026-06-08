'use client';

// Aba "Receita" — visão consolidada da comercialização do evento: estandes +
// patrocínio, realizado vs. forecast vs. potencial, com META de venda e a
// composição em barra (SVG puro). Sem "R$" hardcoded — tudo via lib/format.

import { useMemo, useState } from 'react';
import { formatMoneyShort, formatPercent } from '@/lib/format';
import {
  type ExpoBag,
  resumoMapa, resumoPatrocinio, receitaEvento, progressoMeta,
  salvarMeta, exportCSV,
} from '../_lib';
import { Kpi, Progress, IcoMoney, IcoTarget, IcoChart, IcoBooth, IcoHandshake, IcoDownload, btnSecondary } from './ui';

export default function Receita({ bag }: { bag: ExpoBag }) {
  const { estandes, cotas, patrocinadores, precoM2 } = bag;
  const [meta, setMeta] = useState<number>(bag ? lerMetaInicial(bag) : 0);

  const mapa = useMemo(() => resumoMapa(estandes, precoM2), [estandes, precoM2]);
  const patro = useMemo(() => resumoPatrocinio(cotas, patrocinadores), [cotas, patrocinadores]);
  const rec = useMemo(() => receitaEvento(estandes, cotas, patrocinadores, precoM2), [estandes, cotas, patrocinadores, precoM2]);
  const pctMeta = progressoMeta(rec.realizado, meta);

  // Segmentos da barra de composição (sobre o potencial total).
  const base = Math.max(rec.potencialTotal, 1);
  const segs = [
    { label: 'Estandes vendidos', valor: rec.estandesVendido, cor: '#ff385c' },
    { label: 'Patrocínio realizado', valor: rec.patrocinioRealizado, cor: '#7c3aed' },
    { label: 'Estandes reservados', valor: rec.estandesReservado, cor: '#f59e0b' },
    { label: 'Patrocínio em pipeline', valor: rec.patrocinioPipeline, cor: '#0ea5e9' },
  ].filter((s) => s.valor > 0);
  const realizadoFrac = rec.potencialTotal > 0 ? rec.realizado / rec.potencialTotal : 0;

  const onExport = () => {
    exportCSV(`receita-expositores-${bag.evento.id}.csv`,
      ['Linha', 'Valor'],
      [
        ['Estandes — vendidos', mapa.receitaVendida],
        ['Estandes — reservados', mapa.receitaReservada],
        ['Estandes — disponíveis (potencial)', mapa.receitaDisponivel],
        ['Patrocínio — realizado', patro.receitaRealizada],
        ['Patrocínio — pipeline', patro.receitaPipeline],
        ['Patrocínio — vagas abertas (potencial)', patro.receitaPotencialMapa],
        ['Realizado total', rec.realizado],
        ['Forecast', rec.forecast],
        ['Potencial total', rec.potencialTotal],
        ['Meta', meta],
      ]);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Realizado" value={formatMoneyShort(rec.realizado)} tone="verde" icon={<IcoMoney />} sub="no bolso hoje" />
        <Kpi label="Forecast" value={formatMoneyShort(rec.forecast)} tone="sky" icon={<IcoChart />} sub="+ reservas e pipeline" />
        <Kpi label="Potencial total" value={formatMoneyShort(rec.potencialTotal)} tone="roxo" icon={<IcoTarget />} sub="mapa + cotas cheios" />
        <Kpi label="% do mapa vendido" value={formatPercent(mapa.pctVendidoArea)} tone="brand" icon={<IcoBooth />} sub={`${formatPercent(mapa.pctVendidoContagem)} por contagem`} />
      </div>

      {/* Composição da receita */}
      <div className="rounded-2xl bg-white p-5 shadow-card">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wide text-ink-muted">Composição da receita</h2>
          <button onClick={onExport} className={btnSecondary}><IcoDownload /> CSV</button>
        </div>
        <div className="flex h-6 w-full overflow-hidden rounded-full bg-black/[0.05]">
          {segs.map((s, i) => (
            <div key={i} title={`${s.label}: ${formatMoneyShort(s.valor)}`} style={{ width: `${(s.valor / base) * 100}%`, background: s.cor }} className="h-full" />
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
          {segs.map((s, i) => (
            <div key={i} className="flex items-center gap-1.5 text-xs text-ink-soft">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: s.cor }} />
              {s.label}: <span className="font-semibold text-ink">{formatMoneyShort(s.valor)}</span>
            </div>
          ))}
          {segs.length === 0 && <div className="text-sm text-ink-muted">Sem receita ainda. Venda estandes e cotas para ver a composição aqui.</div>}
        </div>
        <div className="mt-2 text-[0.72rem] text-ink-muted">
          Barra proporcional ao potencial total ({formatMoneyShort(rec.potencialTotal)}). Realizado = {formatPercent(realizadoFrac)} do teto.
        </div>
      </div>

      {/* Meta de comercialização */}
      <div className="rounded-2xl bg-white p-5 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-bold uppercase tracking-wide text-ink-muted">Meta de comercialização</h2>
          <label className="flex items-center gap-2 text-sm text-ink-soft">
            Meta
            <input type="number" min={0} defaultValue={meta || ''} placeholder="0"
              onChange={(e) => { const v = Math.max(0, Number(e.target.value) || 0); setMeta(v); salvarMeta(bag.evento.id, v); }}
              className="w-36 rounded-lg border border-black/10 px-2.5 py-1.5 text-sm focus:border-brand focus:outline-none" />
          </label>
        </div>
        <div className="mt-3 flex items-end justify-between text-sm">
          <span className="text-ink-soft">{formatMoneyShort(rec.realizado)} de {meta > 0 ? formatMoneyShort(meta) : '—'}</span>
          <span className="font-bold text-brand">{meta > 0 ? formatPercent(pctMeta) : '—'}</span>
        </div>
        <Progress value={pctMeta} tone={pctMeta >= 1 ? 'verde' : 'brand'} className="mt-2 h-3" />
        {meta > 0 && rec.realizado < meta && (
          <div className="mt-2 text-[0.72rem] text-ink-muted">Faltam {formatMoneyShort(meta - rec.realizado)} para a meta. Forecast atual: {formatMoneyShort(rec.forecast)}.</div>
        )}
      </div>

      {/* Quebra por fonte */}
      <div className="grid gap-3 sm:grid-cols-2">
        <FonteCard titulo="Estandes" icon={<IcoBooth />} linhas={[
          { k: 'Vendidos', v: mapa.receitaVendida, tone: 'text-emerald-600' },
          { k: 'Reservados', v: mapa.receitaReservada, tone: 'text-amber-600' },
          { k: 'Disponíveis (potencial)', v: mapa.receitaDisponivel, tone: 'text-ink-muted' },
        ]} />
        <FonteCard titulo="Patrocínio" icon={<IcoHandshake />} linhas={[
          { k: 'Realizado', v: patro.receitaRealizada, tone: 'text-emerald-600' },
          { k: 'Pipeline', v: patro.receitaPipeline, tone: 'text-sky-600' },
          { k: 'Vagas abertas (potencial)', v: patro.receitaPotencialMapa, tone: 'text-ink-muted' },
        ]} />
      </div>
    </div>
  );
}

function FonteCard({ titulo, icon, linhas }: { titulo: string; icon: React.ReactNode; linhas: { k: string; v: number; tone: string }[] }) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-card">
      <div className="mb-2 flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-50 text-brand">{icon}</span>
        <span className="text-sm font-bold text-ink">{titulo}</span>
      </div>
      <div className="divide-y divide-black/[0.05]">
        {linhas.map((l) => (
          <div key={l.k} className="flex items-center justify-between py-1.5 text-sm">
            <span className="text-ink-soft">{l.k}</span>
            <span className={`font-semibold ${l.tone}`}>{formatMoneyShort(l.v)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function lerMetaInicial(bag: ExpoBag): number {
  if (typeof window === 'undefined') return 0;
  try { return Number(JSON.parse(window.localStorage.getItem('ventsy_expo_meta') || '{}')[bag.evento.id]) || 0; } catch { return 0; }
}
