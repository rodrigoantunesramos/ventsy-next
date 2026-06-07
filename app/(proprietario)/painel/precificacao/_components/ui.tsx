'use client';

// Primitivos de UI da Precificação: shell de modal (Esc/backdrop), campo
// rotulado, input de moeda com símbolo dinâmico (sem "R$" hardcoded) e ícones
// SVG inline. Reutilizados pelos modais, pelo Simulador e pelo calendário.

import { useEffect, type ReactNode } from 'react';
import { simboloMoeda, inp } from '../_lib';
import type { Currency } from '@/lib/format';

// ── Modal shell ───────────────────────────────────────────────────────────────
export function ModalShell({
  title, subtitle, icon, onClose, children, footer, wide,
}: {
  title: string; subtitle?: ReactNode; icon?: ReactNode; onClose: () => void;
  children: ReactNode; footer?: ReactNode; wide?: boolean;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-start justify-center overflow-y-auto bg-black/50 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className={`relative my-8 w-full ${wide ? 'max-w-2xl' : 'max-w-md'} rounded-2xl bg-white p-6 shadow-pop`}>
        <button
          onClick={onClose}
          aria-label="Fechar"
          className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full border border-black/10 text-ink-muted hover:bg-black/[0.03]"
        >✕</button>
        <div className="mb-5 flex items-center gap-3 pr-10">
          {icon && <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand">{icon}</span>}
          <div>
            <h3 className="font-display text-xl font-bold leading-tight text-ink">{title}</h3>
            {subtitle && <p className="mt-0.5 text-sm text-ink-muted">{subtitle}</p>}
          </div>
        </div>
        {children}
        {footer && <div className="mt-6 flex items-center gap-3">{footer}</div>}
      </div>
    </div>
  );
}

export function Field({ label, hint, children, className }: { label: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <label className={`block ${className || ''}`}>
      <span className="mb-1.5 block text-sm font-semibold text-ink-soft">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-ink-muted">{hint}</span>}
    </label>
  );
}

// Input de moeda com símbolo da moeda ativa como adorno (i18n).
export function MoneyInput({
  value, onChange, moeda, placeholder = '0,00', autoFocus,
}: { value: string; onChange: (v: string) => void; moeda?: Currency; placeholder?: string; autoFocus?: boolean }) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-ink-muted">{simboloMoeda(moeda)}</span>
      <input
        type="number" min={0} step="0.01" inputMode="decimal"
        value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} autoFocus={autoFocus}
        className={`${inp} pl-10`}
      />
    </div>
  );
}

// Botões primário/secundário padronizados.
export function PrimaryBtn({ children, ...p }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button {...p} className="rounded-xl bg-brand px-6 py-3 text-sm font-bold text-white transition hover:bg-brand-600 disabled:opacity-60">{children}</button>;
}
export function GhostBtn({ children, ...p }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button {...p} className="ml-auto text-sm font-medium text-ink-muted hover:text-ink">{children}</button>;
}

// ── Ícones (SVG inline, estilo stroke premium) ───────────────────────────────
const PATHS = {
  tag: 'M20.59 13.41 12 22l-9-9V3h10l7.59 7.59a2 2 0 0 1 0 2.82ZM7.5 7.5h.01',
  plus: 'M12 5v14M5 12h14',
  edit: 'M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4Z',
  trash: 'M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6',
  sparkles: 'M12 3l1.9 4.6L18.5 9l-4.6 1.9L12 15l-1.9-4.1L5.5 9l4.6-1.4L12 3ZM19 14l.8 2 2 .8-2 .8L19 20l-.8-2-2-.8 2-.8.8-2.4Z',
  calendar: 'M3 9h18M7 3v4M17 3v4M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z',
  layers: 'm12 2 9 5-9 5-9-5 9-5ZM3 12l9 5 9-5M3 17l9 5 9-5',
  percent: 'M19 5 5 19M6.5 9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Zm11 11a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z',
  receipt: 'M5 3v18l2.5-1.5L10 21l2-1.5L14 21l2.5-1.5L19 21V3l-2.5 1.5L14 3l-2 1.5L10 3 7.5 4.5 5 3Zm3.5 6h7M8.5 13h7',
  box: 'M21 8v8a2 2 0 0 1-1 1.73l-7 4a2 2 0 0 1-2 0l-7-4A2 2 0 0 1 3 16V8a2 2 0 0 1 1-1.73l7-4a2 2 0 0 1 2 0l7 4A2 2 0 0 1 21 8ZM3.3 7 12 12l8.7-5M12 22V12',
  search: 'M21 21l-4.3-4.3M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16Z',
  users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 7v5l3 2',
  building: 'M3 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16M15 21V9h4a2 2 0 0 1 2 2v10M7 7h2M7 11h2M7 15h2',
  copy: 'M8 8h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2V8ZM4 16a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2',
  empty: 'M20 7 12 3 4 7m16 0-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4',
} as const;
export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 15, sw = 2 }: { name: IconName; size?: number; sw?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
      <path d={PATHS[name]} />
    </svg>
  );
}
