'use client';

// Kit visual do módulo Pesquisas & NPS (/painel/pesquisas): medidor de NPS,
// barra de categorias, evolução mensal e barras por chave — tudo em SVG puro
// (sem libs de chart/ícone). Espelha o design system (00-contexto-base) e o
// padrão do financeiro/feedbacks. Toda formatação i18n vem de lib/format.

import { type ReactNode } from 'react';
import { formatNumber, formatPercent, formatMonth } from '@/lib/format';
import { CATEGORIAS_NPS, zonaNps } from '@/lib/pesquisas';

// ── KPI ───────────────────────────────────────────────────────────────────────
export function Kpi({ label, value, foot, delta, accent }: { label: string; value: string; foot?: ReactNode; delta?: number; accent?: string }) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-card">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-ink-muted">{label}</span>
        {delta !== undefined && Math.abs(delta) >= 1 && (
          <span className={`text-xs font-semibold ${delta >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{delta >= 0 ? '▲' : '▼'} {formatNumber(Math.abs(delta))}</span>
        )}
      </div>
      <div className={`mt-1 text-2xl font-bold ${accent || 'text-ink'}`}>{value}</div>
      {foot && <div className="mt-1.5">{foot}</div>}
    </div>
  );
}

// ── Medidor de NPS (semicircular, −100…100) ───────────────────────────────────
export function NpsGauge({ score, total }: { score: number; total: number }) {
  const z = zonaNps(score);
  // semicírculo de 180°: ângulo do ponteiro mapeia −100→180° (esq) … 100→0° (dir)
  const cx = 110, cy = 104, R = 84;
  const frac = (Math.max(-100, Math.min(100, score)) + 100) / 200; // 0..1
  const ang = Math.PI * (1 - frac); // π (esq) … 0 (dir)
  const px = cx + R * Math.cos(ang), py = cy - R * Math.sin(ang);
  const arc = (a0: number, a1: number) => {
    const x0 = cx + R * Math.cos(a0), y0 = cy - R * Math.sin(a0);
    const x1 = cx + R * Math.cos(a1), y1 = cy - R * Math.sin(a1);
    return `M ${x0.toFixed(1)} ${y0.toFixed(1)} A ${R} ${R} 0 0 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`;
  };
  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 220 124" className="w-full max-w-[240px]" aria-label={`NPS ${score}`}>
        {/* faixas: detrator (esq), neutro (meio), promotor (dir) */}
        <path d={arc(Math.PI, Math.PI * 0.62)} fill="none" stroke="currentColor" className="text-red-400" strokeWidth="12" strokeLinecap="round" />
        <path d={arc(Math.PI * 0.6, Math.PI * 0.4)} fill="none" stroke="currentColor" className="text-amber-300" strokeWidth="12" />
        <path d={arc(Math.PI * 0.38, 0)} fill="none" stroke="currentColor" className="text-emerald-400" strokeWidth="12" strokeLinecap="round" />
        {/* ponteiro */}
        <line x1={cx} y1={cy} x2={px.toFixed(1)} y2={py.toFixed(1)} stroke="currentColor" className="text-ink" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx={cx} cy={cy} r="4" className="fill-ink" />
        <text x="14" y="120" className="fill-ink-muted" fontSize="9">−100</text>
        <text x="196" y="120" className="fill-ink-muted" fontSize="9">100</text>
      </svg>
      <div className="-mt-2 text-center">
        <div className="text-4xl font-bold text-ink tabular-nums">{total ? formatNumber(score) : '—'}</div>
        <div className={`text-xs font-semibold ${z.cls}`}>{total ? z.label : 'Sem respostas ainda'}</div>
      </div>
    </div>
  );
}

// ── Barra empilhada de categorias (promotor/neutro/detrator) ──────────────────
export function BarraCategorias({ dist }: { dist: { promotor: number; neutro: number; detrator: number; total: number } }) {
  const t = dist.total || 1;
  const segs = CATEGORIAS_NPS.map((c) => ({ ...c, n: dist[c.v], pct: dist[c.v] / t }));
  return (
    <div>
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-black/[0.06]">
        {segs.map((s) => s.n > 0 && <div key={s.v} className={s.bar} style={{ width: `${s.pct * 100}%` }} title={`${s.label}: ${s.n}`} />)}
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {segs.map((s) => (
          <div key={s.v} className="text-center">
            <div className={`mx-auto mb-1 h-1.5 w-1.5 rounded-full ${s.dot}`} />
            <div className="text-sm font-bold text-ink tabular-nums">{dist.total ? formatPercent(s.pct) : '—'}</div>
            <div className="text-[11px] text-ink-muted">{s.label} · {formatNumber(s.n)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Evolução mensal do NPS (barras de volume + linha de score −100…100) ───────
export function EvolucaoNps({ serie }: { serie: { ym: string; nps: number; n: number }[] }) {
  const W = 100 * serie.length, H = 140, pad = 24;
  const maxN = Math.max(1, ...serie.map((s) => s.n));
  const cw = (W - pad) / serie.length;
  const x = (i: number) => pad + (i + 0.5) * cw;
  const yN = (n: number) => H - pad - (n / maxN) * (H - pad * 2);
  const yScore = (s: number) => pad + (1 - (Math.max(-100, Math.min(100, s)) + 100) / 200) * (H - pad * 2);
  const pts = serie.filter((s) => s.n > 0);
  const linePts = pts.map((s) => `${x(serie.indexOf(s))},${yScore(s.nps).toFixed(1)}`).join(' ');
  const zeroY = yScore(0);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="xMidYMid meet" aria-label="Evolução mensal do NPS">
      <line x1={pad} y1={zeroY} x2={W} y2={zeroY} stroke="currentColor" className="text-black/[0.08]" strokeWidth="1" strokeDasharray="3 3" />
      {serie.map((s, i) => <rect key={`b${i}`} x={x(i) - cw * 0.22} y={yN(s.n)} width={cw * 0.44} height={Math.max(0, H - pad - yN(s.n))} rx="3" className="fill-brand/12" />)}
      {linePts && <polyline points={linePts} fill="none" stroke="#ff385c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />}
      {pts.map((s) => { const i = serie.indexOf(s); return <circle key={`c${i}`} cx={x(i)} cy={yScore(s.nps)} r="2.8" className="fill-brand" />; })}
      {serie.map((s, i) => <text key={`t${i}`} x={x(i)} y={H - 6} textAnchor="middle" className="fill-ink-muted" fontSize="9">{formatMonth(s.ym, { withYear: false })}</text>)}
    </svg>
  );
}

// ── Barra de NPS por chave (propriedade/tipo) — diverge no zero ───────────────
export function NpsBar({ label, score, n }: { label: string; score: number; n: number }) {
  const z = zonaNps(score);
  const frac = (Math.max(-100, Math.min(100, score)) + 100) / 200; // 0..1, 0.5 = score 0
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="min-w-0 flex-1 truncate text-ink-soft" title={label}>{label}</span>
      <div className="relative h-2.5 w-24 overflow-hidden rounded-full bg-black/[0.06]">
        <div className="absolute left-1/2 top-0 h-full w-px bg-black/15" />
        {score >= 0
          ? <div className="absolute left-1/2 h-full rounded-r-full bg-emerald-400" style={{ width: `${(frac - 0.5) * 100}%` }} />
          : <div className="absolute h-full rounded-l-full bg-red-400" style={{ right: '50%', width: `${(0.5 - frac) * 100}%` }} />}
      </div>
      <span className={`w-8 text-right font-semibold tabular-nums ${z.cls}`}>{n ? formatNumber(score) : '—'}</span>
      <span className="w-9 text-right tabular-nums text-ink-muted">({formatNumber(n)})</span>
    </div>
  );
}

// ── Chip de categoria ─────────────────────────────────────────────────────────
export function CategoriaChip({ categoria, nps }: { categoria: string | null; nps: number | null }) {
  const c = categoria ? CATEGORIAS_NPS.find((x) => x.v === categoria) : null;
  if (!c) return <span className="rounded-lg bg-black/[0.05] px-2 py-0.5 text-xs font-semibold text-ink-muted">Sem NPS</span>;
  return (
    <span className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-xs font-semibold ${c.cls}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} /> {c.label}{nps != null ? ` · ${nps}` : ''}
    </span>
  );
}

// ── Ícones (SVG inline) ───────────────────────────────────────────────────────
const svg = (path: ReactNode, size = 15, sw = 2) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">{path}</svg>;
export const IcoPoll = ({ size = 15 }: { size?: number }) => svg(<path d="M4 20V4M4 20h16M8 20v-6M12 20V8M16 20v-9" />, size);
export const IcoPlus = () => svg(<path d="M12 5v14M5 12h14" />, 15);
export const IcoSearch = () => svg(<path d="M21 21l-4.3-4.3M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16Z" />, 14);
export const IcoDownload = () => svg(<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />, 13);
export const IcoSparkles = () => svg(<path d="M12 3l1.9 4.6L18.5 9.5l-4.6 1.9L12 16l-1.9-4.6L5.5 9.5l4.6-1.9L12 3ZM19 14l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8.8-2Z" />, 14);
export const IcoQr = () => svg(<path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 14h2v2h-2zM14 18h2v2h-2zM18 18h2v2h-2z" />, 15);
export const IcoCopy = () => svg(<><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></>, 14);
export const IcoCheck = () => svg(<path d="M20 6 9 17l-5-5" />, 14);
export const IcoAlert = () => svg(<path d="M12 9v4M12 17h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />, 14);
export const IcoEdit = () => svg(<path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />, 14);
export const IcoTrash = () => svg(<path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />, 14);
export const IcoLink = () => svg(<path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" />, 14);
export const IcoThumbUp = () => svg(<path d="M7 10v11M2 13v6a2 2 0 0 0 2 2h13.3a2 2 0 0 0 2-1.7l1.3-8A2 2 0 0 0 18 9h-5l1-5a2 2 0 0 0-2-2L7 10" />, 13);
export const IcoChevron = ({ open }: { open?: boolean }) => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform ${open ? 'rotate-180' : ''}`}><path d="m6 9 6 6 6-6" /></svg>;
export const IcoPower = () => svg(<path d="M12 2v10M18.4 6.6a9 9 0 1 1-12.8 0" />, 14);
