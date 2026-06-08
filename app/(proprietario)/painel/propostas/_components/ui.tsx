'use client';

// Primitivos de UI das Propostas: shell de modal (Esc/backdrop), campo rotulado,
// input de moeda com símbolo dinâmico (sem "R$" hardcoded), botões e ícones SVG
// inline. Autossuficiente do módulo (espelha o padrão da Precificação).

import { useEffect, type ReactNode } from 'react';
import type { Currency } from '@/lib/format';
import { simboloMoeda } from '../../precificacao/_lib';
import { inp } from '../_lib';

// ── Modal shell ───────────────────────────────────────────────────────────────
export function ModalShell({
  title, subtitle, icon, onClose, children, footer, wide,
}: {
  title: string; subtitle?: ReactNode; icon?: ReactNode; onClose: () => void;
  children: ReactNode; footer?: ReactNode; wide?: boolean | 'xl';
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const max = wide === 'xl' ? 'max-w-5xl' : wide ? 'max-w-2xl' : 'max-w-md';
  return (
    <div
      className="fixed inset-0 z-[10000] flex items-start justify-center overflow-y-auto bg-black/50 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className={`relative my-8 w-full ${max} rounded-2xl bg-white p-6 shadow-pop`}>
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
  value, onChange, moeda, placeholder = '0,00', autoFocus, small,
}: { value: string; onChange: (v: string) => void; moeda?: Currency; placeholder?: string; autoFocus?: boolean; small?: boolean }) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-ink-muted">{simboloMoeda(moeda)}</span>
      <input
        type="number" min={0} step="0.01" inputMode="decimal"
        value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} autoFocus={autoFocus}
        className={`${inp} pl-9 ${small ? 'px-2.5 py-1.5 text-sm' : ''}`}
      />
    </div>
  );
}

export function PrimaryBtn({ children, ...p }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button {...p} className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand px-5 py-3 text-sm font-bold text-white transition hover:bg-brand-600 disabled:opacity-60">{children}</button>;
}
export function SecondaryBtn({ children, ...p }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button {...p} className="inline-flex items-center justify-center gap-2 rounded-xl border border-black/10 bg-white px-4 py-2.5 text-sm font-medium transition hover:bg-black/[0.03] disabled:opacity-60">{children}</button>;
}
export function GhostBtn({ children, ...p }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button {...p} className="ml-auto text-sm font-medium text-ink-muted hover:text-ink">{children}</button>;
}

// ── Ícones (SVG inline, estilo stroke premium) ───────────────────────────────
const PATHS = {
  plus: 'M12 5v14M5 12h14',
  edit: 'M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4Z',
  trash: 'M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6',
  sparkles: 'M12 3l1.9 4.6L18.5 9l-4.6 1.9L12 15l-1.9-4.1L5.5 9l4.6-1.4L12 3ZM19 14l.8 2 2 .8-2 .8L19 20l-.8-2-2-.8 2-.8.8-2.4Z',
  send: 'M22 2 11 13M22 2l-7 20-4-9-9-4 20-7Z',
  link: 'M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1',
  download: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3',
  copy: 'M8 8h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2V8ZM4 16a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2',
  check: 'M20 6 9 17l-5-5',
  checkCircle: 'M22 11.08V12a10 10 0 1 1-5.93-9.14M22 4 12 14.01l-3-3',
  x: 'M18 6 6 18M6 6l12 12',
  xCircle: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20ZM15 9l-6 6M9 9l6 6',
  eye: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Zm10 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
  file: 'M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Zm0 0v6h6M8 13h8M8 17h6',
  fileText: 'M14 3v5h5M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-5-5ZM9 13h6M9 17h6',
  user: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z',
  building: 'M3 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16M15 21V9h4a2 2 0 0 1 2 2v10M7 7h2M7 11h2M7 15h2',
  calendar: 'M3 9h18M7 3v4M17 3v4M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z',
  receipt: 'M5 3v18l2.5-1.5L10 21l2-1.5L14 21l2.5-1.5L19 21V3l-2.5 1.5L14 3l-2 1.5L10 3 7.5 4.5 5 3Zm3.5 6h7M8.5 13h7',
  tag: 'M20.59 13.41 12 22l-9-9V3h10l7.59 7.59a2 2 0 0 1 0 2.82ZM7.5 7.5h.01',
  coins: 'M3 6h18v12H3zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6',
  percent: 'M19 5 5 19M6.5 9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Zm11 11a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 7v5l3 2',
  trending: 'M22 7 13.5 15.5 8.5 10.5 2 17M16 7h6v6',
  funnel: 'M3 4h18l-7 8v6l-4 2v-8L3 4Z',
  doc: 'M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Zm0 0v6h6M8 13h8M8 17h6',
  plug: 'M9 7V2M15 7V2M6 7h12v4a6 6 0 0 1-12 0V7ZM12 17v5',
  chevronDown: 'm6 9 6 6 6-6',
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

// Botão de ícone discreto (ações de linha).
export function IconBtn({ children, label, onClick, danger }: { children: ReactNode; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      onClick={onClick} title={label} aria-label={label}
      className={`rounded-lg p-1.5 text-ink-muted transition hover:bg-black/[0.04] ${danger ? 'hover:text-red-600' : 'hover:text-brand'}`}
    >{children}</button>
  );
}
