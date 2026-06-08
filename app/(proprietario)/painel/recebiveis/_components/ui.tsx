'use client';

// Átomos de UI compartilhados pelas abas de Contas a Pagar/Receber.
// Mantém o look do painel (tokens de marca, shadow-card/pop, raios) e evita
// duplicar Kpi/Modal/ícones entre as quatro abas.

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

// ── Ícones (SVG inline, stroke) ───────────────────────────────────────────────
const svg = (path: ReactNode, size = 15, sw = 2) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">{path}</svg>
);
export const IcoWallet = () => svg(<path d="M3 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2H3Zm0 0v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2H5M16 13h.01" />);
export const IcoAlert = () => svg(<path d="M12 9v4M12 17h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />, 16);
export const IcoClock = () => svg(<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>);
export const IcoCheck = () => svg(<path d="M20 6 9 17l-5-5" />, 15, 2.4);
export const IcoEdit = () => svg(<><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4Z" /></>, 13);
export const IcoTrash = () => svg(<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />, 13);
export const IcoCalendar = () => svg(<path d="M3 9h18M7 3v4M17 3v4M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" />);
export const IcoDownload = () => svg(<path d="M12 3v12m0 0 4-4m-4 4-4-4M4 19h16" />, 14);
export const IcoPlus = () => svg(<path d="M12 5v14M5 12h14" />, 15, 2.4);
export const IcoPaperclip = () => svg(<path d="M21.44 11.05 12 20.5a5.5 5.5 0 0 1-7.78-7.78l8.49-8.49a3.5 3.5 0 1 1 4.95 4.95l-8.49 8.49a1.5 1.5 0 0 1-2.12-2.12l7.78-7.78" />, 14);
export const IcoRepeat = () => svg(<path d="M17 1l4 4-4 4M3 11V9a4 4 0 0 1 4-4h14M7 23l-4-4 4-4m14-2v2a4 4 0 0 1-4 4H3" />, 13);
export const IcoArrowUp = () => svg(<path d="M12 19V5m0 0-6 6m6-6 6 6" />, 14, 2.2);
export const IcoArrowDown = () => svg(<path d="M12 5v14m0 0 6-6m-6 6-6-6" />, 14, 2.2);
export const IcoChevronLeft = () => svg(<path d="M15 18l-6-6 6-6" />, 16);
export const IcoChevronRight = () => svg(<path d="M9 18l6-6-6-6" />, 16);
export const IcoScale = () => svg(<path d="M12 3v18M5 21h14M7 7l-4 7a4 4 0 0 0 8 0L7 7Zm10 0-4 7a4 4 0 0 0 8 0l-4-7ZM7 7l5-2 5 2" />, 15);
