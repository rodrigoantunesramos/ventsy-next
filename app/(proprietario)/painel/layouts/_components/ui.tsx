'use client';

// Átomos de UI compartilhados pelas abas de Layouts, Plantas & Capacidade.
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
export const inp = 'w-full rounded-xl border border-black/10 px-3.5 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20';
export const selCls = 'rounded-xl border border-black/10 bg-white px-3 py-2 text-sm focus:border-brand focus:outline-none';

// ── Nível de capacidade → cores/rótulo (compartilhado editor + biblioteca) ────
export const NIVEL_CAP: Record<string, { label: string; chip: string; tone: Tone; bar: 'brand' | 'verde' | 'gold' | 'vermelho' }> = {
  ok:       { label: 'Dentro da capacidade', chip: 'bg-emerald-50 text-emerald-700', tone: 'verde',    bar: 'verde' },
  atencao:  { label: 'Atenção: aperto',      chip: 'bg-amber-50 text-amber-700',     tone: 'gold',     bar: 'gold' },
  excedido: { label: 'Excede a capacidade',  chip: 'bg-red-50 text-red-700',         tone: 'vermelho', bar: 'vermelho' },
};
export const NIVEL_DENS: Record<string, string> = {
  confortavel: 'Confortável', adequado: 'Adequado', apertado: 'Apertado', critico: 'Crítico', indefinido: '—',
};

// ── Ícones (SVG inline, stroke) ───────────────────────────────────────────────
const svg = (path: ReactNode, size = 15, sw = 2) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">{path}</svg>
);
export const IcoLayout = () => svg(<><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M9 9v12M14 3v6" /></>);
export const IcoTable = () => svg(<><circle cx="12" cy="12" r="6" /><circle cx="12" cy="4.5" r="1.2" /><circle cx="12" cy="19.5" r="1.2" /><circle cx="4.5" cy="12" r="1.2" /><circle cx="19.5" cy="12" r="1.2" /></>);
export const IcoStage = () => svg(<path d="M3 8h18v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Zm3 5v6m12-6v6M4 19h16M8 8 6 4m10 4 2-4" />);
export const IcoMap = () => svg(<path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2Zm0 0v14m6-12v14" />);
export const IcoUsers = () => svg(<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm13 10v-2a4 4 0 0 0-3-3.87M16 3.13A4 4 0 0 1 16 11" />);
export const IcoBuilding = () => svg(<path d="M3 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16M15 21V9h4a2 2 0 0 1 2 2v10M7 7h2M7 11h2M7 15h2" />);
export const IcoRuler = () => svg(<path d="M3 7l4-4 14 14-4 4L3 7Zm4 0 2 2m1-5 2 2m1 1 2 2m-7 3 2 2" />);
export const IcoPlus = () => svg(<path d="M12 5v14M5 12h14" />, 15, 2.4);
export const IcoEdit = () => svg(<><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4Z" /></>, 13);
export const IcoTrash = () => svg(<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />, 13);
export const IcoDownload = () => svg(<path d="M12 3v12m0 0 4-4m-4 4-4-4M4 19h16" />, 14);
export const IcoSparkle = () => svg(<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3Z" />, 15);
export const IcoShield = () => svg(<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3ZM9.5 12l2 2 3.5-4" />, 14);
export const IcoLink = () => svg(<path d="M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1" />, 13);
export const IcoCheck = () => svg(<path d="M20 6 9 17l-5-5" />, 15, 2.4);
export const IcoAlert = () => svg(<path d="M12 9v4M12 17h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />, 16);
export const IcoX = () => svg(<path d="M18 6 6 18M6 6l12 12" />, 14, 2.2);
export const IcoChevron = () => svg(<path d="m9 18 6-6-6-6" />, 14);
export const IcoExpand = () => svg(<path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3m13-5v3a2 2 0 0 1-2 2h-3" />, 15);
export const IcoImage = () => svg(<><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="m21 15-5-5L5 21" /></>, 14);
export const IcoCopy = () => svg(<><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h8" /></>, 13);
export const IcoClapper = () => svg(<path d="M3 8h18v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8Zm.4-3 14.4-2.6a1 1 0 0 1 1.16.8L19.6 6 3 8.6 2.6 6a1 1 0 0 1 .8-1Z" />, 13);
