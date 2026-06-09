'use client';

// Átomos de UI compartilhados pelas abas de Terceiros (custo × retorno).
// Mantém o look do painel (tokens de marca, shadow-card/pop, raios) e evita
// duplicar Kpi/Modal/Campo/ícones entre as abas. Espelha seguros/_components/ui.

import { useEffect, type ReactNode } from 'react';

// ── KPI card ──────────────────────────────────────────────────────────────────
export type Tone = 'ink' | 'brand' | 'verde' | 'vermelho' | 'gold' | 'azul' | 'roxo' | 'sky' | 'cinza' | 'teal';
const TONE_TEXT: Record<Tone, string> = {
  ink: 'text-ink', brand: 'text-brand', verde: 'text-emerald-600', vermelho: 'text-red-600',
  gold: 'text-amber-600', azul: 'text-blue-600', roxo: 'text-violet-600', sky: 'text-sky-600', cinza: 'text-ink-soft', teal: 'text-teal-600',
};
const TONE_BG: Record<Tone, string> = {
  ink: 'bg-black/[0.04] text-ink-soft', brand: 'bg-brand-50 text-brand', verde: 'bg-emerald-50 text-emerald-600',
  vermelho: 'bg-red-50 text-red-600', gold: 'bg-amber-50 text-amber-600', azul: 'bg-blue-50 text-blue-600',
  roxo: 'bg-violet-50 text-violet-600', sky: 'bg-sky-50 text-sky-600', cinza: 'bg-black/[0.04] text-ink-soft', teal: 'bg-teal-50 text-teal-600',
};
export function Kpi({ label, value, tone = 'ink', icon, sub }: { label: string; value: string; tone?: Tone; icon?: ReactNode; sub?: string }) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-card">
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs text-ink-muted">{label}</span>
        {icon && <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${TONE_BG[tone]}`}>{icon}</span>}
      </div>
      <div className={`mt-2 text-xl font-bold ${TONE_TEXT[tone]}`}>{value}</div>
      {sub && <div className="mt-0.5 text-[0.7rem] text-ink-muted">{sub}</div>}
    </div>
  );
}

// ── Barra de progresso ────────────────────────────────────────────────────────
export function Progress({ value, tone = 'brand', className = '' }: { value: number; tone?: 'brand' | 'verde' | 'gold' | 'vermelho' | 'roxo'; className?: string }) {
  const cor = tone === 'verde' ? 'bg-emerald-500' : tone === 'gold' ? 'bg-amber-400' : tone === 'vermelho' ? 'bg-red-500' : tone === 'roxo' ? 'bg-violet-500' : 'bg-brand';
  return (
    <div className={`h-2 overflow-hidden rounded-full bg-black/[0.06] ${className}`}>
      <div className={`h-full rounded-full ${cor} transition-[width]`} style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%` }} />
    </div>
  );
}

// ── Modal shell (Esc + clique no backdrop fecham) ─────────────────────────────
export function ModalShell({ onClose, children, maxW = 'max-w-md' }: { onClose: () => void; children: ReactNode; maxW?: string }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[10000] flex items-start justify-center overflow-y-auto bg-black/50 p-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`relative my-8 w-full ${maxW} rounded-2xl bg-white p-6 shadow-pop`}>
        <button onClick={onClose} aria-label="Fechar" className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full border border-black/10 text-ink-muted hover:bg-black/[0.03]">✕</button>
        {children}
      </div>
    </div>
  );
}

// ── Campo de formulário (label + filho) ───────────────────────────────────────
export function Campo({ label, children, full, hint }: { label: string; children: ReactNode; full?: boolean; hint?: string }) {
  return (
    <label className={`block ${full ? 'sm:col-span-2' : ''}`}>
      <span className="mb-1.5 block text-sm font-semibold text-ink-soft">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[0.7rem] text-ink-muted">{hint}</span>}
    </label>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────
export function EmptyState({ icon, title, children, cta }: { icon: ReactNode; title: string; children?: ReactNode; cta?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-black/[0.06] bg-white p-10 text-center shadow-card">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-black/[0.04] text-ink-muted">{icon}</div>
      <h3 className="text-base font-bold text-ink">{title}</h3>
      {children && <div className="mx-auto mt-1 max-w-md text-sm text-ink-muted">{children}</div>}
      {cta && <div className="mt-5">{cta}</div>}
    </div>
  );
}

// ── Chip genérico ─────────────────────────────────────────────────────────────
export function Chip({ className = '', children }: { className?: string; children: ReactNode }) {
  return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.7rem] font-semibold ${className}`}>{children}</span>;
}

// ── Farol (bolinha de semáforo) ───────────────────────────────────────────────
export function Farol({ nivel, className = '' }: { nivel: 'verde' | 'amarelo' | 'vermelho' | 'neutro'; className?: string }) {
  const cor = nivel === 'verde' ? 'bg-emerald-500' : nivel === 'amarelo' ? 'bg-amber-500' : nivel === 'vermelho' ? 'bg-red-500' : 'bg-gray-300';
  return <span className={`inline-block h-2.5 w-2.5 rounded-full ${cor} ${className}`} />;
}

// ── Botões padrão ─────────────────────────────────────────────────────────────
export const btnPrimary = 'inline-flex items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50';
export const btnSecondary = 'inline-flex items-center justify-center gap-2 rounded-xl border border-black/10 bg-white px-4 py-2.5 text-sm font-medium hover:bg-black/[0.03] disabled:opacity-50';

// ── Ícones (SVG inline, stroke) ───────────────────────────────────────────────
const svg = (path: ReactNode, size = 15, sw = 2) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">{path}</svg>
);
export const IcoExchange = () => svg(<path d="M4 9h13m0 0-3-3m3 3-3 3M20 15H7m0 0 3-3m-3 3 3 3" />, 16);
export const IcoWallet = () => svg(<path d="M3 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2H3Zm0 0v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2H5M16 13h.01" />, 15);
export const IcoMoney = () => svg(<><rect x="2" y="6" width="20" height="12" rx="2" /><circle cx="12" cy="12" r="2.5" /></>, 15);
export const IcoTrend = () => svg(<path d="M3 17l6-6 4 4 7-7M14 8h5v5" />, 15);
export const IcoChart = () => svg(<path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />, 15);
export const IcoGauge = () => svg(<path d="M12 13a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9ZM12 13l3-3M4 19a9 9 0 1 1 16 0" />, 15);
export const IcoDoc = () => svg(<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Zm0 0v6h6M8 13h8M8 17h6" />, 14);
export const IcoSignature = () => svg(<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9l-6-6Zm0 0v6h6M8 16.5c1-1.5 2-1.5 3 0s2 1.5 3 0" />, 14);
export const IcoAlert = () => svg(<path d="M12 9v4M12 17h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />, 16);
export const IcoCalendar = () => svg(<path d="M3 9h18M7 3v4M17 3v4M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" />);
export const IcoPlus = () => svg(<path d="M12 5v14M5 12h14" />, 15, 2.4);
export const IcoEdit = () => svg(<><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4Z" /></>, 13);
export const IcoTrash = () => svg(<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />, 13);
export const IcoCheck = () => svg(<path d="M20 6 9 17l-5-5" />, 15, 2.4);
export const IcoX = () => svg(<path d="M18 6 6 18M6 6l12 12" />, 14, 2.2);
export const IcoDownload = () => svg(<path d="M12 3v12m0 0 4-4m-4 4-4-4M4 19h16" />, 14);
export const IcoSearch = () => svg(<><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></>, 15);
export const IcoLink = () => svg(<path d="M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1" />, 13);
export const IcoTruck = () => svg(<path d="M1 3h13v11H1zM14 7h4l3 3v4h-7M6 18.5a2 2 0 1 1-4 0 2 2 0 0 1 4 0Zm12 0a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z" />, 14);
export const IcoStar = () => svg(<path d="M12 3.5l2.6 5.27 5.82.85-4.21 4.1.99 5.79L12 16.77l-5.2 2.73.99-5.79-4.21-4.1 5.82-.85L12 3.5Z" />, 14);
export const IcoScale = () => svg(<path d="M12 3v18M7 21h10M12 6l7 2-2.5 5a3 3 0 0 0 5 0L19 8M12 6 5 8l2.5 5a3 3 0 0 1-5 0L5 8" />, 15);
export const IcoArrowUp = () => svg(<path d="M12 19V5M5 12l7-7 7 7" />, 13, 2.4);
export const IcoArrowDown = () => svg(<path d="M12 5v14M19 12l-7 7-7-7" />, 13, 2.4);
export const IcoRefresh = () => svg(<path d="M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5M21 12a9 9 0 0 1-15 6.7L3 16M3 21v-5h5" />, 12);
export const IcoEquals = () => svg(<path d="M5 9h14M5 15h14" />, 13, 2.2);
