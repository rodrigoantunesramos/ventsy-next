'use client';

// Átomos de UI compartilhados pelas abas de Jurídico & LGPD.
// Mantém o look do painel (tokens de marca, shadow-card/pop, raios) e resolve o
// "Tone" semântico da engine (lib/juridico) em classes Tailwind. Espelha
// plano-b/_components/ui e producao/_components/ui.

import { useEffect, type ReactNode } from 'react';
import type { Tone } from '@/lib/juridico';

// ── Tone → classes (chip, texto, bg do badge) ─────────────────────────────────
const TONE: Record<Tone, { chip: string; text: string; badge: string; dot: string }> = {
  verde: { chip: 'bg-emerald-50 text-emerald-700', text: 'text-emerald-600', badge: 'bg-emerald-50 text-emerald-600', dot: 'bg-emerald-500' },
  amarelo: { chip: 'bg-amber-50 text-amber-700', text: 'text-amber-600', badge: 'bg-amber-50 text-amber-600', dot: 'bg-amber-500' },
  vermelho: { chip: 'bg-red-50 text-red-700', text: 'text-red-600', badge: 'bg-red-50 text-red-600', dot: 'bg-red-500' },
  azul: { chip: 'bg-blue-50 text-blue-700', text: 'text-blue-600', badge: 'bg-blue-50 text-blue-600', dot: 'bg-blue-500' },
  roxo: { chip: 'bg-violet-50 text-violet-700', text: 'text-violet-600', badge: 'bg-violet-50 text-violet-600', dot: 'bg-violet-500' },
  gold: { chip: 'bg-amber-50 text-amber-700', text: 'text-amber-600', badge: 'bg-gradient-to-br from-amber-500 to-brand text-white', dot: 'bg-amber-400' },
  cinza: { chip: 'bg-black/[0.05] text-ink-soft', text: 'text-ink-soft', badge: 'bg-black/[0.04] text-ink-soft', dot: 'bg-ink-muted/50' },
};
export function toneClasses(tone: Tone) { return TONE[tone] || TONE.cinza; }

// ── Pílula de status (label + tom) ────────────────────────────────────────────
export function StatusPill({ label, tone }: { label: string; tone: Tone }) {
  const t = toneClasses(tone);
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${t.chip}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${t.dot}`} />{label}
    </span>
  );
}

// ── KPI card ──────────────────────────────────────────────────────────────────
export function Kpi({ label, value, tone = 'cinza', icon, sub }: { label: string; value: string; tone?: Tone; icon?: ReactNode; sub?: string }) {
  const t = toneClasses(tone);
  return (
    <div className="rounded-2xl bg-white p-4 shadow-card">
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs text-ink-muted">{label}</span>
        {icon && <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${t.badge}`}>{icon}</span>}
      </div>
      <div className={`mt-2 text-2xl font-bold ${tone === 'cinza' ? 'text-ink' : t.text}`}>{value}</div>
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

// ── Cartão de seção (header + ações + corpo) ──────────────────────────────────
export function SectionCard({ title, desc, action, children }: { title: string; desc?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-2xl bg-white shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-black/[0.06] p-4 sm:p-5">
        <div>
          <h2 className="text-base font-bold text-ink">{title}</h2>
          {desc && <p className="mt-0.5 max-w-2xl text-[0.8rem] text-ink-muted">{desc}</p>}
        </div>
        {action}
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}

// ── Botões padrão ─────────────────────────────────────────────────────────────
export const btnPrimary = 'inline-flex items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50';
export const btnSecondary = 'inline-flex items-center justify-center gap-2 rounded-xl border border-black/10 bg-white px-4 py-2.5 text-sm font-medium hover:bg-black/[0.03] disabled:opacity-50';
export const btnGhost = 'inline-flex items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-ink-muted hover:bg-black/[0.04] hover:text-ink-soft';
export const btnDanger = 'inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-100 disabled:opacity-50';

// ── Ícones (SVG inline, stroke) ───────────────────────────────────────────────
const svg = (path: ReactNode, size = 15, sw = 2) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">{path}</svg>
);
export const IcoScale = () => svg(<path d="M12 3v18M7 21h10M12 6l7 2-2.5 5a3 3 0 0 0 5 0L19 8M12 6 5 8l2.5 5a3 3 0 0 1-5 0L5 8" />, 16);
export const IcoDoc = () => svg(<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Zm0 0v6h6M8 13h8M8 17h6" />);
export const IcoGavel = () => svg(<path d="m14 13-7 7M3 21h6M14.5 5.5l4 4M9 11l4-4m-1-1 6 6m-7-7 2-2 5 5-2 2m-9 1L4.5 16" />, 15);
export const IcoShield = () => svg(<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3ZM9.5 12l2 2 3.5-4" />, 15);
export const IcoUser = () => svg(<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />, 15);
export const IcoUserCheck = () => svg(<><path d="M14 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M8.5 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" /><path d="m16 11 2 2 4-4" /></>, 15);
export const IcoLock = () => svg(<><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></>, 14);
export const IcoClock = () => svg(<path d="M12 7v5l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z" />, 14);
export const IcoAlert = () => svg(<path d="M12 9v4M12 17h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />, 15);
export const IcoCalendar = () => svg(<path d="M3 9h18M7 3v4M17 3v4M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" />, 14);
export const IcoPlus = () => svg(<path d="M12 5v14M5 12h14" />, 15, 2.4);
export const IcoEdit = () => svg(<><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4Z" /></>, 13);
export const IcoTrash = () => svg(<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />, 13);
export const IcoCheck = () => svg(<path d="M20 6 9 17l-5-5" />, 15, 2.4);
export const IcoX = () => svg(<path d="M18 6 6 18M6 6l12 12" />, 14, 2.2);
export const IcoDownload = () => svg(<path d="M12 3v12m0 0 4-4m-4 4-4-4M4 19h16" />, 14);
export const IcoLink = () => svg(<path d="M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1" />, 13);
export const IcoExternal = () => svg(<path d="M15 3h6v6M10 14 21 3M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5" />, 13);
export const IcoSearch = () => svg(<><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></>, 14);
export const IcoEraser = () => svg(<path d="M7 21h13M16.5 3.5a2.1 2.1 0 0 1 3 3L9 17l-4 .5.5-4L16.5 3.5Z" />, 14);
export const IcoPaper = () => svg(<path d="M4 4h16v12H5.2L4 17.5V4ZM8 9h8M8 12h5" />, 14);
export const IcoFolder = () => svg(<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />, 14);
export const IcoArchive = () => svg(<><rect x="3" y="4" width="18" height="4" rx="1" /><path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8M10 12h4" /></>, 14);
