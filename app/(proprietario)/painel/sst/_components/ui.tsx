'use client';

// Primitivas de UI compartilhadas pelas abas do módulo SST (Painel, Planos,
// Dimensionamento, EPIs & NRs, Simulados, Ocorrências). Ícones SVG inline,
// modal acessível (Esc + backdrop), estados (empty), chips e badges de validade.
// Sem libs novas — só Tailwind + SVG, igual ao resto do painel.

import { useEffect, type ReactNode } from 'react';
import { validadeStatus, validadeMeta } from '../_lib';

// ── Classes de botão (espelham 00-contexto-base) ─────────────────────────────
export const btnPrimary = 'inline-flex items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50';
export const btnGhost = 'inline-flex items-center justify-center gap-2 rounded-xl border border-black/10 bg-white px-4 py-2.5 text-sm font-medium hover:bg-black/[0.03] disabled:opacity-50';
export const btnDanger = 'inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50';
export const btnSm = 'inline-flex items-center justify-center gap-1.5 rounded-lg border border-black/10 bg-white px-2.5 py-1.5 text-xs font-medium hover:bg-black/[0.03]';

// ── Ícones (stroke premium, viewBox 24) ──────────────────────────────────────
const PATHS: Record<string, string> = {
  shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3ZM9.5 12l2 2 3.5-4',
  cross: 'M9 3h6v6h6v6h-6v6H9v-6H3V9h6V3Z',
  flame: 'M12 2c1 3-2 4-2 7a2 2 0 0 0 4 0c0-1 0-1 .5-2 1.5 2 3.5 3.5 3.5 7a6 6 0 0 1-12 0c0-3 2-5 3-7 .8 1.6 2 2 3 2',
  exit: 'M14 3h5a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-5M10 17l-5-5 5-5M5 12h12',
  heart: 'M12 21s-7-4.5-9.5-9A4.5 4.5 0 0 1 12 6a4.5 4.5 0 0 1 9.5 6c-2.5 4.5-9.5 9-9.5 9Z',
  ambulance: 'M3 7h11v8H1V9a2 2 0 0 1 2-2ZM14 9h4l3 3v3h-7M7 6v3M5.5 7.5h3M6 18.5a1.8 1.8 0 1 0 0-3.6 1.8 1.8 0 0 0 0 3.6Zm12 0a1.8 1.8 0 1 0 0-3.6 1.8 1.8 0 0 0 0 3.6Z',
  alert: 'M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z',
  check: 'M20 6 9 17l-5-5',
  plus: 'M12 5v14M5 12h14',
  trash: 'M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m2 0v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6',
  edit: 'M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z',
  calendar: 'M3 9h18M7 3v4M17 3v4M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z',
  users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm13 10v-2a4 4 0 0 0-3-3.87M16 3.13A4 4 0 0 1 16 11',
  doc: 'M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Zm0 0v6h6M8 13h8M8 17h6',
  clipboard: 'M9 4h6a1 1 0 0 1 1 1v1h2a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h2V5a1 1 0 0 1 1-1Zm0 2v1h6V6M8 12h8M8 16h5',
  spark: 'M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8',
  helmet: 'M3 13a9 9 0 0 1 18 0M2 13h20v3a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-3ZM12 4v3M9 13V8',
  download: 'M12 3v12m0 0 4-4m-4 4-4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2',
  phone: 'M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L20 13l1 4v2a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1Z',
  pin: 'M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11Zm0-8.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z',
  building: 'M3 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16M15 21V9h4a2 2 0 0 1 2 2v10M7 7h2M7 11h2M7 15h2',
};
export function Ico({ name, size = 18, className = '' }: { name: keyof typeof PATHS | string; size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={`shrink-0 ${className}`}>
      <path d={PATHS[name] || PATHS.shield} />
    </svg>
  );
}

// ── KPI ──────────────────────────────────────────────────────────────────────
export function Kpi({ label, value, sub, tone = 'default', icon }: {
  label: string; value: ReactNode; sub?: ReactNode; tone?: 'default' | 'ok' | 'warn' | 'bad'; icon?: keyof typeof PATHS;
}) {
  const ring = tone === 'ok' ? 'border-emerald-200' : tone === 'warn' ? 'border-amber-200' : tone === 'bad' ? 'border-red-200' : 'border-black/[0.06]';
  const col = tone === 'ok' ? 'text-emerald-600' : tone === 'warn' ? 'text-amber-600' : tone === 'bad' ? 'text-red-600' : 'text-ink-muted';
  return (
    <div className={`rounded-2xl border bg-white p-4 shadow-card ${ring}`}>
      <div className="flex items-center justify-between">
        <div className="text-[0.7rem] font-semibold uppercase tracking-wide text-ink-muted">{label}</div>
        {icon && <span className={col}><Ico name={icon} size={16} /></span>}
      </div>
      <div className="mt-1.5 text-2xl font-bold text-ink">{value}</div>
      {sub != null && <div className="mt-0.5 text-xs text-ink-muted">{sub}</div>}
    </div>
  );
}

// ── Chip ──────────────────────────────────────────────────────────────────────
export function Chip({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${className}`}>{children}</span>;
}

// ── Badge de validade (vigente / a vencer / vencida) ─────────────────────────
export function ValidadeBadge({ validade, hoje, avisoDias = 30, semData = '—' }: {
  validade: string | null | undefined; hoje: string; avisoDias?: number; semData?: string;
}) {
  const info = validadeStatus(validade, hoje, avisoDias);
  const m = validadeMeta(info.nivel);
  const label = info.nivel === 'sem_validade'
    ? semData
    : info.nivel === 'vencida'
      ? `Vencida há ${Math.abs(info.dias || 0)}d`
      : info.nivel === 'a_vencer'
        ? `Vence em ${info.dias}d`
        : 'Vigente';
  return <Chip className={m.chip}><span className={`h-1.5 w-1.5 rounded-full ${m.dot}`} />{label}</Chip>;
}

// ── Barra de progresso ────────────────────────────────────────────────────────
export function Barra({ ratio, tone = 'brand' }: { ratio: number; tone?: 'brand' | 'ok' | 'warn' | 'bad' }) {
  const cls = tone === 'ok' ? 'bg-emerald-500' : tone === 'warn' ? 'bg-amber-500' : tone === 'bad' ? 'bg-red-500' : 'bg-brand';
  const pct = Math.max(0, Math.min(1, ratio || 0)) * 100;
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-black/[0.06]">
      <div className={`h-full rounded-full ${cls} transition-all`} style={{ width: `${pct}%` }} />
    </div>
  );
}

// ── Empty state ────────────────────────────────────────────────────────────────
export function EmptyState({ icon, title, children, cta }: { icon?: ReactNode; title: string; children?: ReactNode; cta?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-black/10 bg-white p-8 text-center">
      {icon && <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand">{icon}</div>}
      <h3 className="text-base font-bold text-ink">{title}</h3>
      {children && <p className="mx-auto mt-1 max-w-md text-sm text-ink-muted">{children}</p>}
      {cta && <div className="mt-4 flex justify-center">{cta}</div>}
    </div>
  );
}

// ── Card de seção ──────────────────────────────────────────────────────────────
export function SectionCard({ title, desc, actions, children, icon }: {
  title: string; desc?: string; actions?: ReactNode; children: ReactNode; icon?: keyof typeof PATHS;
}) {
  return (
    <section className="rounded-2xl border border-black/[0.06] bg-white p-4 shadow-card sm:p-5">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-start gap-2.5">
          {icon && <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand"><Ico name={icon} size={17} /></span>}
          <div>
            <h2 className="text-sm font-bold text-ink sm:text-base">{title}</h2>
            {desc && <p className="mt-0.5 text-xs text-ink-muted">{desc}</p>}
          </div>
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </section>
  );
}

// ── Modal (Esc + backdrop) ────────────────────────────────────────────────────
export function Modal({ open, onClose, title, children, footer, wide }: {
  open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[300] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div
        className={`max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white shadow-pop sm:rounded-2xl ${wide ? 'sm:max-w-3xl' : 'sm:max-w-lg'}`}
        onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={title}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-black/[0.06] bg-white px-5 py-3.5">
          <h3 className="text-base font-bold text-ink">{title}</h3>
          <button onClick={onClose} aria-label="Fechar" className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-muted hover:bg-black/[0.04]">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
        {footer && <div className="sticky bottom-0 flex flex-wrap justify-end gap-2 border-t border-black/[0.06] bg-white px-5 py-3.5">{footer}</div>}
      </div>
    </div>
  );
}

// ── Campo de formulário ────────────────────────────────────────────────────────
export function Field({ label, children, hint, className = '' }: { label: string; children: ReactNode; hint?: string; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-[0.72rem] font-semibold uppercase tracking-wide text-ink-muted">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[0.7rem] text-ink-muted">{hint}</span>}
    </label>
  );
}

// ── Botão de exclusão com confirmação em 2 cliques (sem window.confirm) ────────
import { useState } from 'react';
export function ConfirmDelete({ onConfirm, label = 'Excluir', size = 'sm' }: { onConfirm: () => void; label?: string; size?: 'sm' | 'md' }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 3000);
    return () => clearTimeout(t);
  }, [armed]);
  const cls = size === 'md' ? btnDanger : 'inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50';
  return (
    <button type="button" className={cls} onClick={() => (armed ? onConfirm() : setArmed(true))}>
      <Ico name="trash" size={14} />{armed ? 'Confirmar?' : label}
    </button>
  );
}
