'use client';

// Átomos de UI compartilhados pelas seções de Licenças & Compliance.
// Mantém o look do painel (tokens de marca, shadow-card/pop, raios) e evita
// duplicar Kpi/Semaforo/Modal/Campo/ícones entre as abas. Espelha producao/_components/ui.

import { useEffect, type ReactNode } from 'react';
import type { SemaforoNivel } from '@/lib/licencas';

// ── Classe de input padrão (copiada do contexto-base) ─────────────────────────
export const inp = 'w-full rounded-xl border border-black/10 px-3.5 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20';

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

// ── Semáforo de conformidade (farol grande) ───────────────────────────────────
const SEMAFORO: Record<SemaforoNivel, { dot: string; ring: string; text: string; label: string }> = {
  verde:    { dot: 'bg-emerald-500', ring: 'ring-emerald-200', text: 'text-emerald-700', label: 'Tudo em ordem' },
  amarelo:  { dot: 'bg-amber-500',   ring: 'ring-amber-200',   text: 'text-amber-700',   label: 'Atenção: renovações/processos' },
  vermelho: { dot: 'bg-red-500',     ring: 'ring-red-200',     text: 'text-red-700',     label: 'Crítico: há licença vencida' },
};
export function Semaforo({ nivel, titulo, children }: { nivel: SemaforoNivel; titulo?: string; children?: ReactNode }) {
  const m = SEMAFORO[nivel];
  return (
    <div className="flex items-center gap-4 rounded-2xl bg-white p-4 shadow-card sm:p-5">
      <div className={`flex shrink-0 flex-col gap-1.5 rounded-2xl bg-ink/90 p-2.5 ring-4 ${m.ring}`}>
        <span className={`h-3.5 w-3.5 rounded-full ${nivel === 'vermelho' ? 'bg-red-500' : 'bg-red-500/20'}`} />
        <span className={`h-3.5 w-3.5 rounded-full ${nivel === 'amarelo' ? 'bg-amber-400' : 'bg-amber-400/20'}`} />
        <span className={`h-3.5 w-3.5 rounded-full ${nivel === 'verde' ? 'bg-emerald-500' : 'bg-emerald-500/20'}`} />
      </div>
      <div className="min-w-0">
        <div className="text-[0.7rem] font-semibold uppercase tracking-wide text-ink-muted">{titulo || 'Conformidade do espaço'}</div>
        <div className={`text-lg font-bold ${m.text}`}>{m.label}</div>
        {children && <div className="mt-0.5 text-sm text-ink-muted">{children}</div>}
      </div>
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
export function ModalShell({ onClose, children, maxW = 'max-w-lg' }: { onClose: () => void; children: ReactNode; maxW?: string }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[10000] flex items-start justify-center overflow-y-auto bg-black/50 p-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`relative my-8 w-full ${maxW} rounded-2xl bg-white p-6 shadow-pop`}>
        <button onClick={onClose} aria-label="Fechar" className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full border border-black/10 text-ink-muted hover:bg-black/[0.03]"><IcoX /></button>
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
export const btnGhost = 'inline-flex items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-ink-muted hover:bg-black/[0.04] hover:text-ink-soft disabled:opacity-50';

// ── Ícones (SVG inline, stroke) ───────────────────────────────────────────────
const svg = (path: ReactNode, size = 15, sw = 2) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">{path}</svg>
);
export const IcoShield = () => svg(<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3ZM9.5 12l2 2 3.5-4" />);
export const IcoGrid = () => svg(<path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z" />);
export const IcoBuilding = () => svg(<path d="M3 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16M15 21V9h4a2 2 0 0 1 2 2v10M7 7h2M7 11h2M7 15h2" />);
export const IcoCalendar = () => svg(<path d="M3 9h18M7 3v4M17 3v4M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" />);
export const IcoBook = () => svg(<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M4 19.5A2.5 2.5 0 0 0 6.5 22H20V2H6.5A2.5 2.5 0 0 0 4 4.5Z" />);
export const IcoCheck = () => svg(<path d="M20 6 9 17l-5-5" />, 15, 2.4);
export const IcoCheckCircle = () => svg(<><circle cx="12" cy="12" r="9" /><path d="m8.5 12 2.5 2.5 4.5-5" /></>);
export const IcoAlert = () => svg(<path d="M12 9v4M12 17h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />, 16);
export const IcoClock = () => svg(<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>);
export const IcoPlus = () => svg(<path d="M12 5v14M5 12h14" />, 15, 2.4);
export const IcoEdit = () => svg(<><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4Z" /></>, 13);
export const IcoTrash = () => svg(<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />, 13);
export const IcoDownload = () => svg(<path d="M12 3v12m0 0 4-4m-4 4-4-4M4 19h16" />, 14);
export const IcoUpload = () => svg(<path d="M12 15V3m0 0L8 7m4-4 4 4M4 19h16" />, 14);
export const IcoDoc = () => svg(<><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Z" /><path d="M14 3v6h6M8 13h8M8 17h6" /></>, 14);
export const IcoLink = () => svg(<path d="M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1" />, 13);
export const IcoExternal = () => svg(<path d="M15 3h6v6M21 3l-9 9M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5" />, 13);
export const IcoX = () => svg(<path d="M18 6 6 18M6 6l12 12" />, 15, 2.2);
export const IcoCoins = () => svg(<><ellipse cx="9" cy="6" rx="6" ry="3" /><path d="M3 6v6c0 1.66 2.69 3 6 3M3 12v6c0 1.66 2.69 3 6 3" /><path d="M15 9c3.31 0 6 1.34 6 3v6c0 1.66-2.69 3-6 3s-6-1.34-6-3v-6c0-1.66 2.69-3 6-3Z" /></>, 14);
export const IcoSearch = () => svg(<><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></>, 14);
export const IcoFilter = () => svg(<path d="M3 5h18l-7 8v6l-4-2v-4L3 5Z" />, 14);
export const IcoSparkle = () => svg(<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3Z" />, 14);
export const IcoBuildingSmall = () => svg(<path d="M3 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16M15 21V9h4a2 2 0 0 1 2 2v10M7 7h2M7 11h2M7 15h2" />, 13);
