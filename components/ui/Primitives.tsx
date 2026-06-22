// Primitivos de UI do painel — base do design system, tema-aware por construção
// (usam os tokens semânticos surface/line + ink adaptativo, de tailwind.config +
// globals.css). Adoção incremental: módulos trocam markup ad-hoc por estes.
// Sem dependências (clsx etc.) — helper `cx` local.

import { forwardRef, type ButtonHTMLAttributes, type HTMLAttributes, type ReactNode } from 'react';

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

// ── Button ──────────────────────────────────────────────────────────────────
type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

const BTN_BASE =
  'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40';
const BTN_VARIANT: Record<ButtonVariant, string> = {
  primary: 'bg-brand text-white hover:bg-brand-600',
  secondary: 'border border-line bg-surface text-ink hover:bg-surface-alt',
  ghost: 'text-ink-soft hover:bg-black/[0.04]',
  danger: 'bg-red-600 text-white hover:bg-red-700',
};
const BTN_SIZE: Record<ButtonSize, string> = {
  sm: 'h-9 px-3 text-[0.82rem]',
  md: 'h-10 px-4 text-sm',
  lg: 'h-11 px-5 text-sm',
};

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize; loading?: boolean }
>(function Button({ variant = 'primary', size = 'md', loading, className, children, disabled, ...rest }, ref) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cx(BTN_BASE, BTN_VARIANT[variant], BTN_SIZE[size], className)}
      {...rest}
    >
      {loading && <Spinner size={16} />}
      {children}
    </button>
  );
});

// ── Card ────────────────────────────────────────────────────────────────────
export function Card({
  className,
  padding = true,
  children,
  ...rest
}: HTMLAttributes<HTMLDivElement> & { padding?: boolean }) {
  return (
    <div
      className={cx('rounded-2xl border border-line bg-surface shadow-card', padding && 'p-5', className)}
      {...rest}
    >
      {children}
    </div>
  );
}

// ── Badge ───────────────────────────────────────────────────────────────────
// Fundo translúcido (funciona em claro e escuro) + texto que clareia no escuro.
type BadgeTone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'info';
const BADGE_TONE: Record<BadgeTone, string> = {
  neutral: 'bg-ink/[0.07] text-ink-soft',
  brand: 'bg-brand/10 text-brand',
  success: 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-400',
  warning: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  danger: 'bg-red-500/12 text-red-600 dark:text-red-400',
  info: 'bg-sky-500/12 text-sky-600 dark:text-sky-400',
};

export function Badge({ tone = 'neutral', className, children }: { tone?: BadgeTone; className?: string; children: ReactNode }) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.68rem] font-semibold',
        BADGE_TONE[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
// `bg-ink/[0.08]` adapta ao tema (ink é var). Passe w/h via className.
export function Skeleton({ className }: { className?: string }) {
  return <div className={cx('animate-pulse rounded-md bg-ink/[0.08]', className || 'h-4 w-full')} />;
}

// ── Spinner ───────────────────────────────────────────────────────────────────
export function Spinner({ size = 18, className }: { size?: number; className?: string }) {
  return (
    <span
      role="status"
      aria-label="Carregando"
      className={cx('inline-block animate-spin rounded-full border-2 border-brand/30 border-t-brand', className)}
      style={{ width: size, height: size }}
    />
  );
}
