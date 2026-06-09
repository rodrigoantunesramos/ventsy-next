'use client';

// Kit visual do módulo Marketing (/painel/marketing): abas, KPIs, donut de
// origem, funil de aquisição, barras de ranking, chips e ícones — tudo em SVG
// puro, sem libs de chart/ícone. Espelha o design system (00-contexto-base) e o
// padrão do financeiro/campanhas. Toda formatação i18n vem de lib/format.

import { type ReactNode } from 'react';
import { formatNumber, formatPercent, formatMonth, getFormatPrefs } from '@/lib/format';
import {
  TIPO_ACAO_BY, STATUS_ACAO_BY, type TipoAcao, type StatusAcao, type FunilSaida,
} from '@/lib/marketing';

// Símbolo da moeda ativa (i18n) — para PREFIXAR inputs de valor sem "R$" fixo.
// A formatação de exibição continua sempre via lib/format (formatMoney).
const SIMBOLO_MOEDA: Record<string, string> = { BRL: 'R$', USD: '$', EUR: '€' };
export function moedaSimbolo(): string { return SIMBOLO_MOEDA[getFormatPrefs().currency] || ''; }

// ── Abas ────────────────────────────────────────────────────────────────────────
export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { v: T; label: string; icon?: ReactNode }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="-mx-1 mt-5 flex gap-1 overflow-x-auto pb-1">
      {tabs.map((t) => (
        <button
          key={t.v}
          onClick={() => onChange(t.v)}
          className={`flex shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-semibold transition ${
            value === t.v ? 'bg-ink text-white shadow-card' : 'text-ink-muted hover:bg-black/[0.04] hover:text-ink'
          }`}
        >
          {t.icon}{t.label}
        </button>
      ))}
    </div>
  );
}

// ── KPI ───────────────────────────────────────────────────────────────────────
export function Kpi({ label, value, foot, tone = 'ink' }: { label: string; value: string; foot?: ReactNode; tone?: 'ink' | 'verde' | 'gold' | 'azul' | 'brand' }) {
  const color = { ink: 'text-ink', verde: 'text-emerald-600', gold: 'text-amber-600', azul: 'text-blue-600', brand: 'text-brand' }[tone];
  return (
    <div className="rounded-2xl bg-white p-4 shadow-card">
      <span className="text-xs font-medium text-ink-muted">{label}</span>
      <div className={`mt-1 text-2xl font-bold ${color}`}>{value}</div>
      {foot && <div className="mt-1.5 text-xs text-ink-muted">{foot}</div>}
    </div>
  );
}

// ── Chips de ação ───────────────────────────────────────────────────────────────
export function StatusAcaoChip({ status }: { status: StatusAcao }) {
  const s = STATUS_ACAO_BY[status] || STATUS_ACAO_BY.planejado;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-0.5 text-xs font-semibold ${s.cls}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} /> {s.label}
    </span>
  );
}
export function TipoAcaoBadge({ tipo }: { tipo: TipoAcao }) {
  const t = TIPO_ACAO_BY[tipo] || TIPO_ACAO_BY.post;
  return <span className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[0.7rem] font-semibold ${t.cls}`}><span aria-hidden>{t.icon}</span> {t.label}</span>;
}

// ── Donut (distribuição por origem) ──────────────────────────────────────────────
export function Donut({ data, centerLabel, centerValue }: { data: { label: string; cor: string; n: number }[]; centerLabel?: string; centerValue?: string }) {
  const total = data.reduce((s, d) => s + d.n, 0) || 1;
  const top = data.slice(0, 8);
  const r = 52, sw = 16, C = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="flex items-center gap-4">
      <div className="relative shrink-0">
        <svg width="128" height="128" viewBox="0 0 128 128" className="-rotate-90">
          <circle cx="64" cy="64" r={r} fill="none" stroke="#f1f5f9" strokeWidth={sw} />
          {top.map((d) => { const len = (d.n / total) * C; const el = <circle key={d.label} cx="64" cy="64" r={r} fill="none" stroke={d.cor} strokeWidth={sw} strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-offset} />; offset += len; return el; })}
        </svg>
        {(centerValue || centerLabel) && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            {centerValue && <span className="text-lg font-bold text-ink">{centerValue}</span>}
            {centerLabel && <span className="text-[0.62rem] text-ink-muted">{centerLabel}</span>}
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1 space-y-1.5">
        {top.map((d) => (
          <div key={d.label} className="flex items-center gap-2 text-xs">
            <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: d.cor }} />
            <span className="min-w-0 flex-1 truncate text-ink-soft">{d.label}</span>
            <span className="shrink-0 font-semibold text-ink-muted">{formatNumber(d.n)} · {formatPercent(d.n / total)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Funil de aquisição (barras horizontais + conversão entre etapas) ──────────────
export function FunilAquisicao({ funil }: { funil: FunilSaida }) {
  const tons = ['bg-brand', 'bg-brand/75', 'bg-amber-400', 'bg-emerald-500'];
  return (
    <div className="space-y-1">
      {funil.etapas.map((e, i) => {
        const isGargalo = !!funil.gargalo && funil.gargalo.para === e.label;
        return (
          <div key={e.key}>
            {i > 0 && (
              <div className="flex items-center justify-center py-0.5">
                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.65rem] font-semibold ${isGargalo ? 'bg-red-50 text-red-600' : 'text-ink-muted'}`}>
                  ↓ {formatPercent(e.convDoAnterior)} {isGargalo && '· gargalo'}
                </span>
              </div>
            )}
            <div className="flex items-center gap-3">
              <span className="w-24 shrink-0 text-xs font-medium text-ink-soft">{e.label}</span>
              <div className="h-7 flex-1 overflow-hidden rounded-lg bg-black/[0.04]">
                <div className={`flex h-full items-center justify-end rounded-lg ${tons[i] || 'bg-brand'} px-2 text-[0.72rem] font-bold text-white transition-all`} style={{ width: `${Math.max(e.pct * 100, e.n > 0 ? 10 : 0)}%` }}>
                  {e.n > 0 ? formatNumber(e.n) : ''}
                </div>
              </div>
              <span className="w-12 shrink-0 text-right text-xs tabular-nums text-ink-muted">{formatPercent(e.pct)}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Barra de ranking (canal) ──────────────────────────────────────────────────────
export function RankBar({ label, value, total, cor, right }: { label: ReactNode; value: number; total: number; cor: string; right?: ReactNode }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2 text-xs">
        <span className="min-w-0 flex-1 truncate text-ink-soft">{label}</span>
        {right}
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-black/[0.06]"><div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: cor }} /></div>
    </div>
  );
}

// ── Mini-gráfico: leads por mês (barras) ──────────────────────────────────────────
export function MiniLeads({ serie }: { serie: { ym: string; n: number }[] }) {
  const W = 100 * Math.max(1, serie.length), H = 110, pad = 20;
  const max = Math.max(1, ...serie.map((s) => s.n));
  const cw = (W - pad) / Math.max(1, serie.length);
  const x = (i: number) => pad + (i + 0.5) * cw;
  const y = (n: number) => H - pad - (n / max) * (H - pad * 2);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="xMidYMid meet" aria-label="Leads por mês">
      {serie.map((s, i) => (
        <g key={i}>
          <rect x={x(i) - cw * 0.28} y={y(s.n)} width={cw * 0.56} height={Math.max(0, H - pad - y(s.n))} rx="3" className="fill-brand/70" />
          {s.n > 0 && <text x={x(i)} y={y(s.n) - 4} textAnchor="middle" className="fill-ink-muted" fontSize="9">{s.n}</text>}
          <text x={x(i)} y={H - 5} textAnchor="middle" className="fill-ink-muted" fontSize="9">{formatMonth(s.ym, { withYear: false })}</text>
        </g>
      ))}
    </svg>
  );
}

// ── Estrelas (reputação) ──────────────────────────────────────────────────────────
export function Stars({ nota, size = 14 }: { nota: number; size?: number }) {
  return (
    <span className="inline-flex" aria-label={`${nota.toFixed(1)} de 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <svg key={i} width={size} height={size} viewBox="0 0 24 24" className={i <= Math.round(nota) ? 'fill-amber-400' : 'fill-black/[0.12]'}>
          <path d="M12 3.5l2.6 5.27 5.82.85-4.21 4.1.99 5.79L12 16.77l-5.2 2.73.99-5.79-4.21-4.1 5.82-.85L12 3.5Z" />
        </svg>
      ))}
    </span>
  );
}

// ── Ícones (SVG inline) ───────────────────────────────────────────────────────────
const svg = (path: ReactNode, size = 15, sw = 2) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">{path}</svg>;
export const IcoGrowth = ({ size = 15 }: { size?: number }) => svg(<path d="M3 17l6-6 4 4 7-7M14 8h5v5" />, size);
export const IcoFunnel = ({ size = 15 }: { size?: number }) => svg(<path d="M3 4h18l-7 8v6l-4 2v-8L3 4Z" />, size);
export const IcoChannels = ({ size = 15 }: { size?: number }) => svg(<path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />, size);
export const IcoCalendar = ({ size = 15 }: { size?: number }) => svg(<path d="M3 9h18M7 3v4M17 3v4M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" />, size);
export const IcoContent = ({ size = 15 }: { size?: number }) => svg(<path d="M4 5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Zm3 4.5a1.5 1.5 0 1 1 0-.01M4 16l5-5 4 4 3-3 4 4" />, size);
export const IcoStar = ({ size = 15 }: { size?: number }) => svg(<path d="M12 3.5l2.6 5.27 5.82.85-4.21 4.1.99 5.79L12 16.77l-5.2 2.73.99-5.79-4.21-4.1 5.82-.85L12 3.5Z" />, size);
export const IcoPlus = ({ size = 15 }: { size?: number }) => svg(<path d="M12 5v14M5 12h14" />, size);
export const IcoSearch = () => svg(<path d="M21 21l-4.3-4.3M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16Z" />, 14);
export const IcoDownload = () => svg(<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />, 13);
export const IcoSparkles = ({ size = 14 }: { size?: number }) => svg(<path d="M12 3l1.9 4.6L18.5 9.5l-4.6 1.9L12 16l-1.9-4.6L5.5 9.5l4.6-1.9L12 3ZM19 14l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8.8-2Z" />, size);
export const IcoTrash = () => svg(<path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m2 0v14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V6M10 11v6M14 11v6" />, 14);
export const IcoEdit = () => svg(<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5Z" />, 14);
export const IcoCopy = ({ size = 14 }: { size?: number }) => svg(<><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></>, size);
export const IcoCheck = ({ size = 14 }: { size?: number }) => svg(<path d="M20 6 9 17l-5-5" />, size);
export const IcoX = ({ size = 18 }: { size?: number }) => svg(<path d="M18 6 6 18M6 6l12 12" />, size);
export const IcoChevronL = () => svg(<path d="M15 18l-6-6 6-6" />, 16);
export const IcoChevronR = () => svg(<path d="M9 18l6-6-6-6" />, 16);
export const IcoLink = ({ size = 14 }: { size?: number }) => svg(<path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" />, size);
export const IcoQr = ({ size = 14 }: { size?: number }) => svg(<><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><path d="M14 14h3v3M21 14v.01M21 21v-4M14 21h3" /></>, size);
export const IcoImage = ({ size = 14 }: { size?: number }) => svg(<path d="M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Zm0 13 5-5 4 4 4-4 5 5M9 9.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Z" />, size);
export const IcoExternal = ({ size = 13 }: { size?: number }) => svg(<path d="M15 3h6v6M21 3l-9 9M10 5H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5" />, size);
export const IcoTarget = ({ size = 22 }: { size?: number }) => svg(<path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-4a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm0-4a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" />, size);
