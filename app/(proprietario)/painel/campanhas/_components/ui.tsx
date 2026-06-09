'use client';

// Kit visual do módulo Campanhas (/painel/campanhas): KPIs, chips de status,
// badge de canal, funil e mini-gráficos em SVG puro, barra de limite do plano e
// ícones inline. Sem libs de chart/ícone — espelha o design system (00-contexto-base)
// e o padrão do financeiro/feedbacks. Toda formatação i18n vem de lib/format.

import { type ReactNode } from 'react';
import { formatNumber, formatPercent, formatMonth } from '@/lib/format';
import { CANAL_BY, STATUS_CAMPANHA_BY, type Canal, type StatusCampanha, type FunilEtapa } from '@/lib/campanhas';

// ── KPI ───────────────────────────────────────────────────────────────────────
export function Kpi({ label, value, foot }: { label: string; value: string; foot?: ReactNode }) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-card">
      <span className="text-xs font-medium text-ink-muted">{label}</span>
      <div className="mt-1 text-2xl font-bold text-ink">{value}</div>
      {foot && <div className="mt-1.5 text-xs text-ink-muted">{foot}</div>}
    </div>
  );
}

// ── Chip de status da campanha ────────────────────────────────────────────────
export function StatusChip({ status }: { status: StatusCampanha }) {
  const s = STATUS_CAMPANHA_BY[status] || STATUS_CAMPANHA_BY.rascunho;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold ${s.cls}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot} ${status === 'enviando' ? 'animate-pulse' : ''}`} /> {s.label}
    </span>
  );
}

// ── Badge de canal ────────────────────────────────────────────────────────────
export function CanalBadge({ canal }: { canal: Canal }) {
  const c = CANAL_BY[canal] || CANAL_BY.email;
  return <span className="inline-flex items-center gap-1 text-sm text-ink-soft"><span aria-hidden>{c.icon}</span> {c.label}</span>;
}

// ── Barra do limite do plano (mês) ────────────────────────────────────────────
export function LimiteBar({ usado, limite }: { usado: number; limite: number }) {
  const pct = limite > 0 ? Math.min(1, usado / limite) : 0;
  const cor = pct >= 1 ? 'bg-red-500' : pct >= 0.8 ? 'bg-amber-500' : 'bg-emerald-500';
  return (
    <div>
      <div className="flex items-center justify-between text-xs text-ink-muted">
        <span>Envios do mês</span>
        <span className="tabular-nums">{formatNumber(usado)} / {limite > 0 ? formatNumber(limite) : '—'}</span>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-black/[0.06]">
        <div className={`h-full rounded-full ${cor}`} style={{ width: `${pct * 100}%` }} />
      </div>
    </div>
  );
}

// ── Funil (barras horizontais) ────────────────────────────────────────────────
export function Funil({ etapas }: { etapas: FunilEtapa[] }) {
  const tons = ['bg-brand', 'bg-brand/70', 'bg-amber-400', 'bg-emerald-500'];
  return (
    <div className="space-y-2.5">
      {etapas.map((e, i) => (
        <div key={e.etapa} className="flex items-center gap-3">
          <span className="w-20 shrink-0 text-xs font-medium text-ink-soft">{e.etapa}</span>
          <div className="h-6 flex-1 overflow-hidden rounded-lg bg-black/[0.04]">
            <div className={`flex h-full items-center justify-end rounded-lg ${tons[i] || 'bg-brand'} px-2 text-[0.7rem] font-bold text-white`} style={{ width: `${Math.max(e.pct * 100, e.n > 0 ? 8 : 0)}%` }}>
              {e.n > 0 ? formatNumber(e.n) : ''}
            </div>
          </div>
          <span className="w-12 shrink-0 text-right text-xs tabular-nums text-ink-muted">{formatPercent(e.pct)}</span>
        </div>
      ))}
    </div>
  );
}

// ── Mini-gráfico: enviados (barras) + abertos (linha) por mês ──────────────────
export function MiniEnvios({ serie }: { serie: { ym: string; enviados: number; abertos: number }[] }) {
  const W = 100 * Math.max(1, serie.length), H = 120, pad = 20;
  const maxE = Math.max(1, ...serie.map((s) => s.enviados));
  const cw = (W - pad) / Math.max(1, serie.length);
  const x = (i: number) => pad + (i + 0.5) * cw;
  const yE = (n: number) => H - pad - (n / maxE) * (H - pad * 2);
  const linha = serie.map((s, i) => `${x(i)},${yE(s.abertos)}`).join(' ');
  const temDado = serie.some((s) => s.enviados > 0);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="xMidYMid meet" aria-label="Enviados e abertos por mês">
      {serie.map((s, i) => <rect key={`b${i}`} x={x(i) - cw * 0.22} y={yE(s.enviados)} width={cw * 0.44} height={Math.max(0, H - pad - yE(s.enviados))} rx="3" className="fill-brand/20" />)}
      {temDado && <polyline points={linha} fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />}
      {serie.map((s, i) => s.abertos > 0 ? <circle key={`c${i}`} cx={x(i)} cy={yE(s.abertos)} r="2.6" className="fill-amber-400" /> : null)}
      {serie.map((s, i) => <text key={`t${i}`} x={x(i)} y={H - 5} textAnchor="middle" className="fill-ink-muted" fontSize="9">{formatMonth(s.ym, { withYear: false })}</text>)}
    </svg>
  );
}

// ── Ícones (SVG inline) ───────────────────────────────────────────────────────
const svg = (path: ReactNode, size = 15, sw = 2) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">{path}</svg>;
export const IcoMegaphone = ({ size = 15 }: { size?: number }) => svg(<path d="M3 11v2a1 1 0 0 0 1 1h2l3.5 3.5a1 1 0 0 0 1.7-.7V7.2a1 1 0 0 0-1.7-.7L6 10H4a1 1 0 0 0-1 1ZM15 8a4 4 0 0 1 0 8M18 5a8 8 0 0 1 0 14" />, size);
export const IcoPlus = ({ size = 15 }: { size?: number }) => svg(<path d="M12 5v14M5 12h14" />, size);
export const IcoSearch = () => svg(<path d="M21 21l-4.3-4.3M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16Z" />, 14);
export const IcoDownload = () => svg(<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />, 13);
export const IcoSend = ({ size = 15 }: { size?: number }) => svg(<path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7Z" />, size);
export const IcoSparkles = ({ size = 14 }: { size?: number }) => svg(<path d="M12 3l1.9 4.6L18.5 9.5l-4.6 1.9L12 16l-1.9-4.6L5.5 9.5l4.6-1.9L12 3ZM19 14l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8.8-2Z" />, size);
export const IcoClock = () => svg(<path d="M12 7v5l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z" />, 14);
export const IcoUsers = ({ size = 14 }: { size?: number }) => svg(<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm13 10v-2a4 4 0 0 0-3-3.87M16 3.13A4 4 0 0 1 16 11" />, size);
export const IcoTrash = () => svg(<path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m2 0v14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V6M10 11v6M14 11v6" />, 14);
export const IcoEdit = () => svg(<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5Z" />, 14);
export const IcoCopy = () => svg(<><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></>, 14);
export const IcoCheck = ({ size = 14 }: { size?: number }) => svg(<path d="M20 6 9 17l-5-5" />, size);
export const IcoCalendar = () => svg(<path d="M3 9h18M7 3v4M17 3v4M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" />, 14);
export const IcoX = ({ size = 18 }: { size?: number }) => svg(<path d="M18 6 6 18M6 6l12 12" />, size);
export const IcoChevron = () => svg(<path d="M9 18l6-6-6-6" />, 16);
export const IcoMail = ({ size = 14 }: { size?: number }) => svg(<path d="M3 5h18a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Zm0 1 9 7 9-7" />, size);
export const IcoEye = () => svg(<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Zm10 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />, 14);
