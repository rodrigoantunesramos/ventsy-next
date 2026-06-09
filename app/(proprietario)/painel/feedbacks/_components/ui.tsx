'use client';

// Kit visual do módulo Feedbacks (/painel/feedbacks): gráficos em SVG puro
// (radar de critérios, evolução do CSAT), estrelas, KPIs e ícones inline.
// Sem libs de chart/ícone — espelha o design system (00-contexto-base) e o
// padrão do financeiro/avaliações. Toda formatação i18n vem de lib/format.

import { type ReactNode, useState } from 'react';
import { formatNumber, formatMonth } from '@/lib/format';

// ── Estrelas (display) ────────────────────────────────────────────────────────
export const STAR_PATH = 'M12 3.5l2.6 5.27 5.82.85-4.21 4.1.99 5.79L12 16.77l-5.2 2.73.99-5.79-4.21-4.1 5.82-.85L12 3.5Z';
export function Stars({ value, size = 16 }: { value: number; size?: number }) {
  const full = Math.round(value);
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${formatNumber(value, { maximumFractionDigits: 1 })} de 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <svg key={i} width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={i <= full ? 'text-amber-400' : 'text-black/[0.13]'}><path d={STAR_PATH} /></svg>
      ))}
    </span>
  );
}

// ── Estrelas (input clicável) — registro manual e critérios ───────────────────
export function StarInput({ value, onChange, size = 24 }: { value: number; onChange: (n: number) => void; size?: number }) {
  const [hover, setHover] = useState(0);
  const active = hover || value;
  return (
    <div className="inline-flex items-center gap-0.5" role="radiogroup">
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i} type="button" role="radio" aria-checked={value === i} aria-label={`${i} estrela${i > 1 ? 's' : ''}`}
          onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(0)} onClick={() => onChange(value === i ? 0 : i)}
          className="transition-transform hover:scale-110"
        >
          <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={i <= active ? 'text-amber-400' : 'text-black/[0.15]'}><path d={STAR_PATH} /></svg>
        </button>
      ))}
    </div>
  );
}

// ── KPI ───────────────────────────────────────────────────────────────────────
export function Kpi({ label, value, foot, delta }: { label: string; value: string; foot?: ReactNode; delta?: number }) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-card">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-ink-muted">{label}</span>
        {delta !== undefined && Math.abs(delta) >= 0.05 && (
          <span className={`text-xs font-semibold ${delta >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{delta >= 0 ? '▲' : '▼'} {formatNumber(Math.abs(delta), { maximumFractionDigits: 1 })}</span>
        )}
      </div>
      <div className="mt-1 text-2xl font-bold text-ink">{value}</div>
      {foot && <div className="mt-1.5">{foot}</div>}
    </div>
  );
}

// ── Barra de média (0–5) — por critério/propriedade/tipo ──────────────────────
export function MediaBar({ label, value, n }: { label: string; value: number; n: number }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="min-w-0 flex-1 truncate text-ink-soft" title={label}>{label}</span>
      <div className="h-2 w-20 overflow-hidden rounded-full bg-black/[0.06]"><div className="h-full rounded-full bg-amber-400" style={{ width: `${(value / 5) * 100}%` }} /></div>
      <span className="w-8 text-right font-semibold tabular-nums text-ink">{value ? formatNumber(value, { maximumFractionDigits: 1 }) : '—'}</span>
      <span className="w-9 text-right tabular-nums text-ink-muted">({formatNumber(n)})</span>
    </div>
  );
}

// ── Radar de critérios (SVG puro, N eixos) ────────────────────────────────────
export function RadarCriterios({ data }: { data: { label: string; media: number; n: number }[] }) {
  const N = data.length;
  const cx = 130, cy = 116, R = 78;
  const ang = (i: number) => (-90 + (360 / N) * i) * (Math.PI / 180);
  const pt = (i: number, r: number): [number, number] => [cx + r * Math.cos(ang(i)), cy + r * Math.sin(ang(i))];
  const rings = [1, 2, 3, 4, 5];
  const ringPoly = (level: number) => data.map((_, i) => pt(i, (R * level) / 5).map((v) => v.toFixed(1)).join(',')).join(' ');
  const dataPoly = data.map((d, i) => pt(i, (R * Math.min(5, Math.max(0, d.media))) / 5).map((v) => v.toFixed(1)).join(',')).join(' ');
  const anyData = data.some((d) => d.n > 0);
  return (
    <svg viewBox="0 0 260 232" className="w-full" preserveAspectRatio="xMidYMid meet" aria-label="Notas médias por critério (radar)">
      {/* grelha */}
      {rings.map((lvl) => <polygon key={lvl} points={ringPoly(lvl)} fill="none" stroke="currentColor" className="text-black/[0.07]" strokeWidth="1" />)}
      {data.map((_, i) => { const [x, y] = pt(i, R); return <line key={i} x1={cx} y1={cy} x2={x.toFixed(1)} y2={y.toFixed(1)} stroke="currentColor" className="text-black/[0.07]" strokeWidth="1" />; })}
      {/* dados */}
      {anyData && <polygon points={dataPoly} className="fill-brand/15 stroke-brand" strokeWidth="2" strokeLinejoin="round" />}
      {anyData && data.map((d, i) => { if (!d.n) return null; const [x, y] = pt(i, (R * Math.min(5, d.media)) / 5); return <circle key={i} cx={x.toFixed(1)} cy={y.toFixed(1)} r="2.6" className="fill-brand" />; })}
      {/* rótulos */}
      {data.map((d, i) => {
        const [x, y] = pt(i, R + 16);
        const c = Math.cos(ang(i));
        const anchor = c > 0.3 ? 'start' : c < -0.3 ? 'end' : 'middle';
        return (
          <text key={i} x={x.toFixed(1)} y={y.toFixed(1)} textAnchor={anchor} dominantBaseline="middle" className="fill-ink-soft" fontSize="10.5" fontWeight="600">
            <tspan>{d.label}</tspan>
            <tspan x={x.toFixed(1)} dy="12" className="fill-ink-muted" fontWeight="400">{d.n ? formatNumber(d.media, { maximumFractionDigits: 1 }) : '—'}</tspan>
          </text>
        );
      })}
    </svg>
  );
}

// ── Evolução mensal do CSAT (barras de volume + linha de média) ───────────────
export function EvolucaoMensal({ serie }: { serie: { ym: string; media: number; n: number }[] }) {
  const W = 100 * serie.length, H = 130, pad = 22;
  const maxN = Math.max(1, ...serie.map((s) => s.n));
  const cw = (W - pad) / serie.length;
  const x = (i: number) => pad + (i + 0.5) * cw;
  const yN = (n: number) => H - pad - (n / maxN) * (H - pad * 2);
  const yM = (m: number) => pad + (1 - m / 5) * (H - pad * 2);
  const linePts = serie.filter((s) => s.n > 0).map((s) => `${x(serie.indexOf(s))},${yM(s.media)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="xMidYMid meet" aria-label="Evolução mensal do CSAT">
      {serie.map((s, i) => <rect key={`b${i}`} x={x(i) - cw * 0.22} y={yN(s.n)} width={cw * 0.44} height={Math.max(0, H - pad - yN(s.n))} rx="3" className="fill-brand/15" />)}
      {linePts && <polyline points={linePts} fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />}
      {serie.map((s, i) => s.n > 0 ? <circle key={`c${i}`} cx={x(i)} cy={yM(s.media)} r="2.6" className="fill-amber-400" /> : null)}
      {serie.map((s, i) => <text key={`t${i}`} x={x(i)} y={H - 5} textAnchor="middle" className="fill-ink-muted" fontSize="9">{formatMonth(s.ym, { withYear: false })}</text>)}
    </svg>
  );
}

// ── Ícones (SVG inline) ───────────────────────────────────────────────────────
const svg = (path: ReactNode, size = 15, sw = 2) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">{path}</svg>;
export const IcoChat = ({ size = 15 }: { size?: number }) => svg(<path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.5 8.5 0 0 1-3.8-.9L3 21l1.9-5.7A8.38 8.38 0 0 1 4 11.5 8.5 8.5 0 0 1 12.5 3 8.38 8.38 0 0 1 21 11.5Z" />, size);
export const IcoStar = ({ size = 15 }: { size?: number }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><path d={STAR_PATH} /></svg>;
export const IcoDownload = () => svg(<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />, 13);
export const IcoSearch = () => svg(<path d="M21 21l-4.3-4.3M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16Z" />, 14);
export const IcoAlert = () => svg(<path d="M12 9v4M12 17h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />, 14);
export const IcoClock = () => svg(<path d="M12 7v5l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z" />, 13);
export const IcoPlus = () => svg(<path d="M12 5v14M5 12h14" />, 15);
export const IcoQr = () => svg(<path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 14h2v2h-2zM14 18h2v2h-2zM18 18h2v2h-2z" />, 15);
export const IcoCheck = () => svg(<path d="M20 6 9 17l-5-5" />, 14);
export const IcoCopy = () => svg(<><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></>, 14);
export const IcoSparkles = () => svg(<path d="M12 3l1.9 4.6L18.5 9.5l-4.6 1.9L12 16l-1.9-4.6L5.5 9.5l4.6-1.9L12 3ZM19 14l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8.8-2Z" />, 14);
export const IcoShare = () => svg(<path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 6l-4-4-4 4M12 2v14" />, 14);
export const IcoThumbUp = () => svg(<path d="M7 10v11M2 13v6a2 2 0 0 0 2 2h13.3a2 2 0 0 0 2-1.7l1.3-8A2 2 0 0 0 18 9h-5l1-5a2 2 0 0 0-2-2L7 10" />, 13);
