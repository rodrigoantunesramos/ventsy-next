'use client';

// Átomos de UI compartilhados pelas abas de Estoque/Almoxarifado.
// Mantém o look do painel (tokens de marca, shadow-card/pop, raios) e evita
// duplicar Kpi/Modal/ícones entre as abas.

import { useEffect, type ReactNode } from 'react';

// ── KPI card ──────────────────────────────────────────────────────────────────
export type Tone = 'verde' | 'vermelho' | 'gold' | 'azul' | 'roxo' | 'sky' | 'cinza';
const TONE_TEXT: Record<Tone, string> = {
  verde: 'text-emerald-600', vermelho: 'text-red-600', gold: 'text-amber-600',
  azul: 'text-blue-600', roxo: 'text-violet-600', sky: 'text-sky-600', cinza: 'text-ink-soft',
};
const TONE_BG: Record<Tone, string> = {
  verde: 'bg-emerald-50 text-emerald-600', vermelho: 'bg-red-50 text-red-600', gold: 'bg-amber-50 text-amber-600',
  azul: 'bg-blue-50 text-blue-600', roxo: 'bg-violet-50 text-violet-600', sky: 'bg-sky-50 text-sky-600', cinza: 'bg-black/[0.04] text-ink-soft',
};
export function Kpi({ label, value, tone, icon, hint }: { label: string; value: string; tone: Tone; icon?: ReactNode; hint?: string }) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-card">
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs text-ink-muted">{label}</span>
        {icon && <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${TONE_BG[tone]}`}>{icon}</span>}
      </div>
      <div className={`mt-2 text-xl font-bold ${TONE_TEXT[tone]}`}>{value}</div>
      {hint && <div className="mt-0.5 text-[0.7rem] text-ink-muted">{hint}</div>}
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

// ── Empty / setup states ──────────────────────────────────────────────────────
export function EmptyState({ icon, title, children }: { icon: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-black/[0.06] bg-white p-10 text-center shadow-card">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-black/[0.04] text-ink-muted">{icon}</div>
      <h3 className="text-base font-bold text-ink">{title}</h3>
      {children && <div className="mx-auto mt-1 max-w-md text-sm text-ink-muted">{children}</div>}
    </div>
  );
}

// ── Ícones (SVG inline, stroke) ───────────────────────────────────────────────
const svg = (path: ReactNode, size = 15, sw = 2) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">{path}</svg>
);
export const IcoBox = () => svg(<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16ZM3.27 6.96 12 12l8.73-5.04M12 22V12" />);
export const IcoBoxes = () => svg(<path d="M3 7l4-4 4 4M7 3v8m6 7 4 4 4-4m-4 4v-8M3 13h8v8H3zM13 3h8v8h-8z" />, 16);
export const IcoArrowDown = () => svg(<path d="M12 5v14m0 0 6-6m-6 6-6-6" />, 14, 2.2);
export const IcoArrowUp = () => svg(<path d="M12 19V5m0 0-6 6m6-6 6 6" />, 14, 2.2);
export const IcoAlert = () => svg(<path d="M12 9v4M12 17h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />, 16);
export const IcoClock = () => svg(<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>);
export const IcoCheck = () => svg(<path d="M20 6 9 17l-5-5" />, 15, 2.4);
export const IcoEdit = () => svg(<><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4Z" /></>, 13);
export const IcoTrash = () => svg(<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />, 13);
export const IcoDownload = () => svg(<path d="M12 3v12m0 0 4-4m-4 4-4-4M4 19h16" />, 14);
export const IcoPlus = () => svg(<path d="M12 5v14M5 12h14" />, 15, 2.4);
export const IcoSwap = () => svg(<path d="M17 1l4 4-4 4M3 11V9a4 4 0 0 1 4-4h14M7 23l-4-4 4-4m14-2v2a4 4 0 0 1-4 4H3" />, 14);
export const IcoCalendar = () => svg(<path d="M3 9h18M7 3v4M17 3v4M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" />);
export const IcoLayers = () => svg(<path d="m12 2 9 5-9 5-9-5 9-5ZM3 12l9 5 9-5M3 17l9 5 9-5" />, 15);
export const IcoClipboard = () => svg(<path d="M9 4h6a1 1 0 0 1 1 1v1h2a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h2V5a1 1 0 0 1 1-1Zm0 2v1h6V6M8 11h8M8 15h5" />, 15);
export const IcoCart = () => svg(<path d="M6 6h15l-1.5 9h-12L6 6Zm0 0L5 3H2m7 18a1 1 0 1 1-2 0 1 1 0 0 1 2 0Zm10 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z" />, 15);
export const IcoSearch = () => svg(<path d="M21 21l-4.3-4.3M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16Z" />, 14);
export const IcoList = () => svg(<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />, 15);
export const IcoHistory = () => svg(<path d="M3 3v5h5M3.05 13a9 9 0 1 0 2.13-5.66L3 8m9-1v5l4 2" />, 15);
