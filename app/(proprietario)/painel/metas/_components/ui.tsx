// UI compartilhada do módulo Metas: ícones SVG inline, formatador por unidade
// (via lib/format — i18n-ready) e widgets em SVG puro (anel de progresso, barra,
// semáforo). Sem libs novas — vanilla + Tailwind + SVG, como o resto do painel.

import { formatMoneyShort, formatNumber, formatPercent } from '@/lib/format';
import type { Unidade, Semaforo } from '@/lib/metas';

// ── Formatação por unidade ────────────────────────────────────────────────────
/** Formata um valor conforme a unidade da métrica. percent recebe FRAÇÃO (0..1). */
export function fmtValor(value: number | null | undefined, unidade: Unidade): string {
  if (value == null || !Number.isFinite(value)) return '—';
  switch (unidade) {
    case 'moeda': return formatMoneyShort(value);
    case 'percent': return formatPercent(value);
    case 'nota': return `${formatNumber(value, { maximumFractionDigits: 1 })}/5`;
    case 'nps': return formatNumber(Math.round(value));
    case 'numero':
    default: return formatNumber(value, { maximumFractionDigits: value % 1 === 0 ? 0 : 1 });
  }
}

/** Texto do campo de alvo a partir do valor do motor (percent vira 0..100). */
export function alvoInputValue(unidade: Unidade, alvo: number | null | undefined): string {
  if (alvo == null) return '';
  return unidade === 'percent' ? String(Math.round((alvo || 0) * 1000) / 10) : String(alvo);
}
/** Converte o que o usuário digitou no valor do motor (percent 0..100 → fração). */
export function parseAlvo(unidade: Unidade, raw: string): number {
  const v = Number(String(raw).replace(',', '.')) || 0;
  return unidade === 'percent' ? v / 100 : v;
}
/** Sufixo/placeholder do campo conforme a unidade. */
export function dicaUnidade(unidade: Unidade): string {
  switch (unidade) {
    case 'moeda': return 'valor';
    case 'percent': return '%  (0–100)';
    case 'nota': return 'nota 1–5';
    case 'nps': return 'NPS −100 a 100';
    default: return 'quantidade';
  }
}

// ── Semáforo ────────────────────────────────────────────────────────────────
export const SEMAFORO_COR: Record<Semaforo, string> = {
  verde: '#10b981', amarelo: '#f59e0b', vermelho: '#ef4444',
};
export const SEMAFORO_CHIP: Record<Semaforo, string> = {
  verde: 'bg-emerald-50 text-emerald-700',
  amarelo: 'bg-amber-50 text-amber-700',
  vermelho: 'bg-red-50 text-red-700',
};
export const SEMAFORO_LABEL: Record<Semaforo, string> = {
  verde: 'No caminho', amarelo: 'Atenção', vermelho: 'Em risco',
};
export function Dot({ tone }: { tone: Semaforo }) {
  return <span className="inline-block h-2 w-2 rounded-full" style={{ background: SEMAFORO_COR[tone] }} />;
}

// ── Anel de progresso (SVG) ───────────────────────────────────────────────────
export function Ring({ pct, cor, size = 56, stroke = 6, children }: {
  pct: number; cor: string; size?: number; stroke?: number; children?: React.ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const p = Math.min(1, Math.max(0, pct));
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" className="text-black/[0.07]" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={cor} strokeWidth={stroke}
          strokeDasharray={c} strokeDashoffset={c * (1 - p)} strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.7s ease' }} />
      </svg>
      {children != null && <span className="absolute text-[0.7rem] font-bold text-ink">{children}</span>}
    </div>
  );
}

// ── Barra de progresso (com marcador de projeção opcional) ───────────────────
export function Barra({ pct, cor, proj }: { pct: number; cor: string; proj?: number }) {
  const p = Math.min(1, Math.max(0, pct)) * 100;
  const pr = proj != null ? Math.min(1, Math.max(0, proj)) * 100 : null;
  return (
    <div className="relative h-2.5 overflow-hidden rounded-full bg-black/[0.06]">
      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${p}%`, background: cor }} />
      {pr != null && (
        <span title="Projeção de fechamento" className="absolute top-1/2 h-3.5 w-[2px] -translate-y-1/2 rounded-full bg-ink/70"
          style={{ left: `calc(${pr}% - 1px)` }} />
      )}
    </div>
  );
}

// ── Ícones (stroke, estilo premium — mesmo viewBox do layout) ────────────────
type IcoProps = { className?: string };
function S({ d, className, fill }: { d: string; className?: string; fill?: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill={fill ? 'currentColor' : 'none'} stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d={d} />
    </svg>
  );
}
export const IcoGoal = (p: IcoProps) => <S {...p} d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-4a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm0-4a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" />;
export const IcoRocket = (p: IcoProps) => <S {...p} d="M5 15c-1.5 1.5-2 5-2 5s3.5-.5 5-2M9 11a12 12 0 0 1 8-8c2 0 3 1 3 3a12 12 0 0 1-8 8l-3-3ZM9 11l-3 1M13 15l-1 3M14 9.5a1.5 1.5 0 1 0 .01 0Z" />;
export const IcoTrophy = (p: IcoProps) => <S {...p} d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4ZM7 6H4v2a3 3 0 0 0 3 3M17 6h3v2a3 3 0 0 1-3 3" />;
export const IcoTrend = (p: IcoProps) => <S {...p} d="M3 17l6-6 4 4 7-7M14 8h5v5" />;
export const IcoChart = (p: IcoProps) => <S {...p} d="M4 20V10M10 20V4M16 20v-7M22 20H2" />;
export const IcoPlus = (p: IcoProps) => <S {...p} d="M12 5v14M5 12h14" />;
export const IcoEdit = (p: IcoProps) => <S {...p} d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z" />;
export const IcoTrash = (p: IcoProps) => <S {...p} d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m2 0v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6M10 11v6M14 11v6" />;
export const IcoChevL = (p: IcoProps) => <S {...p} d="M15 18l-6-6 6-6" />;
export const IcoChevR = (p: IcoProps) => <S {...p} d="M9 18l6-6-6-6" />;
export const IcoCog = (p: IcoProps) => <S {...p} d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm8-3a8 8 0 0 0-.13-1.4l2-1.55-2-3.46-2.36.95a8 8 0 0 0-2.42-1.4L14.7 2h-4l-.39 2.74a8 8 0 0 0-2.42 1.4L5.53 5.2l-2 3.46 2 1.55A8 8 0 0 0 5.4 12a8 8 0 0 0 .13 1.4l-2 1.55 2 3.46 2.36-.95a8 8 0 0 0 2.42 1.4L10.7 22h4l.39-2.74a8 8 0 0 0 2.42-1.4l2.36.95 2-3.46-2-1.55A8 8 0 0 0 20 12Z" />;
export const IcoDownload = (p: IcoProps) => <S {...p} d="M12 3v12m0 0 4-4m-4 4-4-4M5 21h14" />;
export const IcoAlert = (p: IcoProps) => <S {...p} d="M12 9v4m0 4h.01M10.3 3.9 2 18a2 2 0 0 0 1.7 3h16.6a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />;
export const IcoCheck = (p: IcoProps) => <S {...p} d="M20 6 9 17l-5-5" />;
export const IcoTarget = IcoGoal;
export const IcoBuilding = (p: IcoProps) => <S {...p} d="M3 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16M15 21V9h4a2 2 0 0 1 2 2v10M7 7h2M7 11h2M7 15h2" />;
