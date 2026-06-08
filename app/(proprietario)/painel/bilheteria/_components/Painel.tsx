'use client';

// Aba PAINEL — visão executiva da bilheteria: KPIs (receita, vendidos, ticket
// médio, lotação), curva de vendas (SVG puro), receita por categoria/lote e por
// canal, e mapa de lotação por categoria. Tudo derivado da engine pura
// lib/bilheteria.ts. Sem "R$" hardcoded — valores via lib/format.

import { useMemo, type ReactNode } from 'react';
import { formatMoney, formatMoneyShort, formatNumber, formatPercent } from '@/lib/format';
import {
  type BilheteriaEvento, type Categoria, type Pedido, type Ingresso,
  resumoVendas, lotacaoEvento, vendasPorCategoria, vendasPorCanal, curvaVendas, canalMeta,
} from '@/lib/bilheteria';
import { IcoMoney, IcoTicket, IcoUsers, IcoChart, IcoTag } from './Icons';

const PALETTE = ['#ff385c', '#0ea5e9', '#f59e0b', '#10b981', '#7c3aed', '#ef4444', '#14b8a6', '#f97316'];

export function Painel({ bilheteria, categorias, pedidos, ingressos, onIrConfig }: {
  bilheteria: BilheteriaEvento; categorias: Categoria[]; pedidos: Pedido[]; ingressos: Ingresso[]; onIrConfig: () => void;
}) {
  const resumo = useMemo(() => resumoVendas(pedidos, ingressos), [pedidos, ingressos]);
  const lot = useMemo(() => lotacaoEvento(bilheteria, categorias, ingressos), [bilheteria, categorias, ingressos]);
  const porCat = useMemo(() => vendasPorCategoria(categorias, ingressos), [categorias, ingressos]);
  const porCanal = useMemo(() => vendasPorCanal(pedidos), [pedidos]);
  const curva = useMemo(() => curvaVendas(pedidos), [pedidos]);

  if (categorias.length === 0) {
    return (
      <div className="mt-6 rounded-2xl border border-dashed border-black/10 bg-white px-6 py-14 text-center">
        <span className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand"><IcoTag size={28} /></span>
        <h3 className="text-base font-bold text-ink">Configure as categorias de ingresso</h3>
        <p className="mx-auto mt-1 max-w-sm text-sm text-ink-muted">Defina lotes, preços e quantidades para começar a vender. Os números aparecem aqui assim que as vendas acontecerem.</p>
        <button onClick={onIrConfig} className="mt-4 rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-600">Configurar ingressos</button>
      </div>
    );
  }

  const capacidadeEfetiva = lot.capacidadeEvento > 0 ? lot.capacidadeEvento : lot.capacidade;

  return (
    <div className="mt-5 space-y-5">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        <Kpi label="Receita" value={formatMoneyShort(resumo.receita)} sub={`${formatNumber(resumo.pedidosPagos)} pedidos pagos`} tone="verde" icon={<IcoMoney />} />
        <Kpi label="Ingressos vendidos" value={formatNumber(resumo.ingressosVendidos)} sub={capacidadeEfetiva > 0 ? `de ${formatNumber(capacidadeEfetiva)}` : 'sem teto'} tone="ink" icon={<IcoTicket />} />
        <Kpi label="Ticket médio" value={formatMoneyShort(resumo.ticketMedio)} sub="por pedido pago" tone="azul" icon={<IcoChart />} />
        <Kpi label="Conversão" value={formatPercent(resumo.conversao)} sub={`${formatNumber(resumo.pedidosPendentes)} pendentes`} tone="gold" icon={<IcoUsers />} />
        <Kpi label="Check-in" value={formatNumber(resumo.ingressosCheckin)} sub={resumo.ingressosVendidos ? formatPercent(resumo.ingressosCheckin / resumo.ingressosVendidos) + ' presentes' : '—'} tone="azul" icon={<IcoUsers />} />
      </div>

      {/* Lotação */}
      {capacidadeEfetiva > 0 && (
        <div className="rounded-2xl bg-white p-5 shadow-card">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-base font-bold text-ink">Lotação</h3>
            <span className="text-sm font-semibold text-ink-soft">{formatNumber(lot.vendidos)} / {formatNumber(capacidadeEfetiva)} · {formatPercent(lot.ratio)}</span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-black/[0.06]">
            <div className={`h-full rounded-full transition-all ${lot.ratio >= 1 ? 'bg-red-500' : lot.ratio >= 0.9 ? 'bg-orange-500' : lot.ratio >= 0.7 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min(100, lot.ratio * 100)}%` }} />
          </div>
          {lot.restante !== Infinity && <p className="mt-2 text-xs text-ink-muted">{formatNumber(lot.restante)} ingressos restantes.</p>}
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_360px]">
        {/* Curva de vendas */}
        <div className="rounded-2xl bg-white p-5 shadow-card">
          <h3 className="mb-1 text-base font-bold text-ink">Receita acumulada</h3>
          <p className="mb-3 text-xs text-ink-muted">Evolução das vendas pagas ao longo do tempo.</p>
          {curva.length < 2 ? (
            <p className="py-12 text-center text-sm text-ink-muted">Ainda sem vendas suficientes para o gráfico.</p>
          ) : (
            <Sparkline pontos={curva.map((c) => c.receita)} />
          )}
          {curva.length >= 1 && (
            <div className="mt-2 flex items-center justify-between text-xs text-ink-muted">
              <span>Total: <strong className="text-ink">{formatMoney(resumo.receita)}</strong></span>
              <span>{formatNumber(curva.length)} pagamentos</span>
            </div>
          )}
        </div>

        {/* Por canal (donut) */}
        <div className="rounded-2xl bg-white p-5 shadow-card">
          <h3 className="mb-3 text-base font-bold text-ink">Receita por canal</h3>
          {porCanal.length === 0 ? (
            <p className="py-10 text-center text-sm text-ink-muted">Sem vendas ainda.</p>
          ) : (
            <Donut dados={porCanal.map((c) => ({ label: canalMeta(c.canal).label, valor: c.receita, cor: canalMeta(c.canal).hex }))} />
          )}
        </div>
      </div>

      {/* Por categoria / lote */}
      <div className="rounded-2xl bg-white p-5 shadow-card">
        <h3 className="mb-3 text-base font-bold text-ink">Vendas por categoria / lote</h3>
        {porCat.every((c) => c.vendidos === 0) ? (
          <p className="py-10 text-center text-sm text-ink-muted">Nenhum ingresso vendido ainda.</p>
        ) : (
          <div className="space-y-3">
            {porCat.map((c, i) => {
              const cat = categorias.find((x) => x.id === c.categoria_id);
              const meta = cat ? `${formatNumber(c.vendidos)}${cat.quantidade > 0 ? ` / ${formatNumber(cat.quantidade)}` : ''}` : formatNumber(c.vendidos);
              const max = Math.max(...porCat.map((x) => x.receita), 1);
              return (
                <div key={c.categoria_id}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="font-medium text-ink">{c.nome}{cat?.lote_nome ? <span className="ml-1.5 text-xs text-ink-muted">{cat.lote_nome}</span> : null}</span>
                    <span className="text-ink-soft">{meta} · <strong>{formatMoney(c.receita)}</strong></span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-black/[0.05]">
                    <div className="h-full rounded-full" style={{ width: `${(c.receita / max) * 100}%`, background: PALETTE[i % PALETTE.length] }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── KPI card ──
function Kpi({ label, value, sub, tone, icon }: { label: string; value: string; sub?: string; tone: 'ink' | 'verde' | 'azul' | 'gold' | 'vermelho'; icon: ReactNode }) {
  const tones: Record<string, string> = {
    ink: 'bg-ink/5 text-ink', verde: 'bg-emerald-50 text-emerald-600', azul: 'bg-sky-50 text-sky-600',
    gold: 'bg-amber-50 text-amber-600', vermelho: 'bg-red-50 text-red-600',
  };
  return (
    <div className="rounded-2xl bg-white p-4 shadow-card">
      <div className="flex items-center justify-between">
        <span className="text-[0.7rem] font-semibold uppercase tracking-wide text-ink-muted">{label}</span>
        <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${tones[tone]}`}>{icon}</span>
      </div>
      <div className="mt-1.5 text-xl font-bold text-ink">{value}</div>
      {sub && <div className="mt-0.5 truncate text-xs text-ink-muted">{sub}</div>}
    </div>
  );
}

// ── Sparkline (área) ──
function Sparkline({ pontos }: { pontos: number[] }) {
  const W = 560, H = 140, pad = 6;
  const max = Math.max(...pontos, 1);
  const min = Math.min(...pontos, 0);
  const span = max - min || 1;
  const stepX = (W - pad * 2) / (pontos.length - 1);
  const coords = pontos.map((v, i) => [pad + i * stepX, H - pad - ((v - min) / span) * (H - pad * 2)] as const);
  const line = coords.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  const area = `${line} L${coords[coords.length - 1][0].toFixed(1)} ${H - pad} L${coords[0][0].toFixed(1)} ${H - pad} Z`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-36 w-full" preserveAspectRatio="none">
      <defs><linearGradient id="bilhArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#ff385c" stopOpacity="0.25" /><stop offset="100%" stopColor="#ff385c" stopOpacity="0" /></linearGradient></defs>
      <path d={area} fill="url(#bilhArea)" />
      <path d={line} fill="none" stroke="#ff385c" strokeWidth={2.2} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

// ── Donut ──
function Donut({ dados }: { dados: { label: string; valor: number; cor: string }[] }) {
  const total = dados.reduce((s, d) => s + d.valor, 0) || 1;
  let acc = 0;
  const R = 52, C = 2 * Math.PI * R;
  return (
    <div className="flex items-center gap-5">
      <svg viewBox="0 0 140 140" className="h-32 w-32 shrink-0 -rotate-90">
        <circle cx="70" cy="70" r={R} fill="none" stroke="#f1f1f3" strokeWidth="16" />
        {dados.map((d, i) => {
          const frac = d.valor / total;
          const dash = frac * C;
          const el = <circle key={i} cx="70" cy="70" r={R} fill="none" stroke={d.cor} strokeWidth="16" strokeDasharray={`${dash} ${C - dash}`} strokeDashoffset={-acc * C} />;
          acc += frac;
          return el;
        })}
      </svg>
      <div className="min-w-0 flex-1 space-y-1.5">
        {dados.map((d, i) => (
          <div key={i} className="flex items-center justify-between gap-2 text-sm">
            <span className="flex min-w-0 items-center gap-2"><span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: d.cor }} /><span className="truncate text-ink-soft">{d.label}</span></span>
            <span className="shrink-0 font-semibold text-ink">{formatMoneyShort(d.valor)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
