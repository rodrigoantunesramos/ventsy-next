'use client';

// Átomos de UI compartilhados pelas abas de Catering, Buffet & Bar.
// Mantém o look do painel (tokens de marca, shadow-card/pop, raios) e evita
// duplicar Kpi/Modal/Campo/ícones entre as abas. Espelha producao/_components/ui.

import { useEffect, type ReactNode } from 'react';

// ── KPI card ──────────────────────────────────────────────────────────────────
export type Tone = 'ink' | 'brand' | 'verde' | 'vermelho' | 'gold' | 'azul' | 'roxo' | 'sky' | 'cinza';
const TONE_TEXT: Record<Tone, string> = {
  ink: 'text-ink', brand: 'text-brand', verde: 'text-emerald-600', vermelho: 'text-red-600',
  gold: 'text-amber-600', azul: 'text-blue-600', roxo: 'text-violet-600', sky: 'text-sky-600', cinza: 'text-ink-soft',
};
const TONE_BG: Record<Tone, string> = {
  ink: 'bg-black/[0.04] text-ink-soft', brand: 'bg-brand-50 text-brand', verde: 'bg-emerald-50 text-emerald-600',
  vermelho: 'bg-red-50 text-red-600', gold: 'bg-amber-50 text-amber-600', azul: 'bg-blue-50 text-blue-600',
  roxo: 'bg-violet-50 text-violet-600', sky: 'bg-sky-50 text-sky-600', cinza: 'bg-black/[0.04] text-ink-soft',
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
export function Progress({ value, tone = 'brand', className = '' }: { value: number; tone?: 'brand' | 'verde' | 'gold' | 'vermelho'; className?: string }) {
  const cor = tone === 'verde' ? 'bg-emerald-500' : tone === 'gold' ? 'bg-amber-400' : tone === 'vermelho' ? 'bg-red-500' : 'bg-brand';
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

// ── Botões padrão ─────────────────────────────────────────────────────────────
export const btnPrimary = 'inline-flex items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50';
export const btnSecondary = 'inline-flex items-center justify-center gap-2 rounded-xl border border-black/10 bg-white px-4 py-2.5 text-sm font-medium hover:bg-black/[0.03] disabled:opacity-50';
export const btnGhost = 'inline-flex items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-ink-soft hover:bg-black/[0.04]';

// ── Ícones (SVG inline, stroke) ───────────────────────────────────────────────
const svg = (path: ReactNode, size = 15, sw = 2) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">{path}</svg>
);
export const IcoChef = () => svg(<><path d="M6 14a4 4 0 0 1-1-7.87A4 4 0 0 1 12 4a4 4 0 0 1 7 2.13A4 4 0 0 1 18 14" /><path d="M6 14v5a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-5M6 17h12" /></>);
export const IcoUtensils = () => svg(<><path d="M3 2v7a3 3 0 0 0 3 3v10M9 2v7a3 3 0 0 1-3 3M6 2v6" /><path d="M16 2c-1.5 0-3 1.8-3 5s1.5 5 3 5v9" /></>);
export const IcoWine = () => svg(<><path d="M8 22h8M12 15v7M7 4h10l-.5 5a4.5 4.5 0 0 1-9 0L7 4Z" /></>);
export const IcoBeaker = () => svg(<><path d="M9 3h6M10 3v6.5L5 18a2 2 0 0 0 1.8 3h10.4A2 2 0 0 0 19 18l-5-8.5V3" /><path d="M7.5 14h9" /></>);
export const IcoCart = () => svg(<path d="M3 3h2l2.4 12.3a1 1 0 0 0 1 .7h8.7a1 1 0 0 0 1-.8L21 7H6M10 21a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm8 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" />);
export const IcoBox = () => svg(<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16ZM3.27 6.96 12 12l8.73-5.04M12 22V12" />);
export const IcoChart = () => svg(<path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />);
export const IcoLeaf = () => svg(<><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" /><path d="M2 21c0-3 1.85-5.36 5.08-6" /></>);
export const IcoCalendar = () => svg(<path d="M3 9h18M7 3v4M17 3v4M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" />);
export const IcoUsers = () => svg(<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm13 10v-2a4 4 0 0 0-3-3.87M16 3.13A4 4 0 0 1 16 11" />);
export const IcoPlus = () => svg(<path d="M12 5v14M5 12h14" />, 15, 2.4);
export const IcoEdit = () => svg(<><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4Z" /></>, 13);
export const IcoTrash = () => svg(<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />, 13);
export const IcoDownload = () => svg(<path d="M12 3v12m0 0 4-4m-4 4-4-4M4 19h16" />, 14);
export const IcoCheck = () => svg(<path d="M20 6 9 17l-5-5" />, 15, 2.4);
export const IcoCheckCircle = () => svg(<><circle cx="12" cy="12" r="9" /><path d="m8.5 12 2.5 2.5 4.5-5" /></>);
export const IcoX = () => svg(<path d="M18 6 6 18M6 6l12 12" />, 15, 2.2);
export const IcoAlert = () => svg(<path d="M12 9v4M12 17h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />, 16);
export const IcoLink = () => svg(<path d="M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1" />, 13);
export const IcoSparkle = () => svg(<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3Z" />, 15);
export const IcoCopy = () => svg(<><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></>, 13);
export const IcoArrowRight = () => svg(<path d="M5 12h14M13 6l6 6-6 6" />, 14);
