'use client'

// Kit de UI da Área do Cliente — tokens do projeto (brand/ink/surface/line +
// shadow-card), portanto tema-aware (claro/escuro) automático. Reusado por todas
// as páginas do cliente para uma linguagem visual premium e consistente.

import { useEffect, type ReactNode } from 'react'
import Link from 'next/link'
import { Icon, type IconName } from './_nav'

// Reexporta o Icon/IconName para as páginas importarem tudo de um lugar só (`../_ui`).
export { Icon } from './_nav'
export type { IconName } from './_nav'

// ── Cabeçalho de página ───────────────────────────────────────────────────────
export function PageHeader({
  title, subtitle, eyebrow, actions,
}: { title: ReactNode; subtitle?: ReactNode; eyebrow?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        {eyebrow ? <div className="mb-1 text-[.72rem] font-bold uppercase tracking-[.1em] text-brand">{eyebrow}</div> : null}
        <h1 className="font-display text-2xl font-bold text-ink sm:text-[1.7rem]">{title}</h1>
        {subtitle ? <p className="mt-1 max-w-2xl text-sm text-ink-muted">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  )
}

// ── Card básico ───────────────────────────────────────────────────────────────
export function Card({ children, className = '', as = 'div' }: { children: ReactNode; className?: string; as?: 'div' | 'section' }) {
  const Cmp = as
  return <Cmp className={`rounded-2xl border border-line bg-surface p-5 shadow-card ${className}`}>{children}</Cmp>
}

// ── Seção (título + ação opcional) ───────────────────────────────────────────
export function Section({ title, action, children, className = '' }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={className}>
      {(title || action) && (
        <div className="mb-3 flex items-center justify-between gap-3">
          {title ? <h2 className="text-[1.05rem] font-bold text-ink">{title}</h2> : <span />}
          {action}
        </div>
      )}
      {children}
    </section>
  )
}

// ── KPI ───────────────────────────────────────────────────────────────────────
type Tone = 'ink' | 'brand' | 'verde' | 'azul' | 'gold' | 'roxo' | 'vermelho'
const TONE_TEXT: Record<Tone, string> = {
  ink: 'text-ink', brand: 'text-brand', verde: 'text-emerald-600', azul: 'text-sky-600',
  gold: 'text-amber-600', roxo: 'text-violet-600', vermelho: 'text-red-600',
}
const TONE_BG: Record<Tone, string> = {
  ink: 'bg-black/[0.05] text-ink', brand: 'bg-brand-50 text-brand', verde: 'bg-emerald-50 text-emerald-600',
  azul: 'bg-sky-50 text-sky-600', gold: 'bg-amber-50 text-amber-600', roxo: 'bg-violet-50 text-violet-600',
  vermelho: 'bg-red-50 text-red-600',
}

export function Kpi({ label, value, sub, tone = 'ink', icon, destaque }: {
  label: ReactNode; value: ReactNode; sub?: ReactNode; tone?: Tone; icon?: IconName; destaque?: boolean
}) {
  return (
    <div className={`rounded-2xl border bg-surface p-4 shadow-card ${destaque ? 'border-brand/30 bg-brand-50/40' : 'border-line'}`}>
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-medium text-ink-muted">{label}</span>
        {icon ? <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${TONE_BG[tone]}`}><Icon name={icon} size={15} /></span> : null}
      </div>
      <div className={`mt-2 text-2xl font-extrabold leading-none ${TONE_TEXT[tone]}`}>{value}</div>
      {sub ? <div className="mt-1 text-[.7rem] text-ink-muted">{sub}</div> : null}
    </div>
  )
}

// ── Badge / pill ──────────────────────────────────────────────────────────────
const BADGE: Record<string, string> = {
  brand: 'bg-brand-50 text-brand',
  verde: 'bg-emerald-50 text-emerald-700',
  ambar: 'bg-amber-50 text-amber-700',
  vermelho: 'bg-red-50 text-red-700',
  azul: 'bg-sky-50 text-sky-700',
  cinza: 'bg-black/[0.05] text-ink-muted',
}
export function Badge({ children, tone = 'cinza', className = '' }: { children: ReactNode; tone?: keyof typeof BADGE | string; className?: string }) {
  return <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[.72rem] font-semibold ${BADGE[tone] ?? BADGE.cinza} ${className}`}>{children}</span>
}

// ── Barra de progresso ────────────────────────────────────────────────────────
export function ProgressBar({ value, tone = 'brand', className = '' }: { value: number; tone?: 'brand' | 'verde' | 'azul'; className?: string }) {
  const pct = Math.max(0, Math.min(100, Math.round(value * 100)))
  const bg = tone === 'verde' ? 'bg-emerald-500' : tone === 'azul' ? 'bg-sky-500' : 'bg-brand'
  return (
    <div className={`h-2 w-full overflow-hidden rounded-full bg-black/[0.06] ${className}`}>
      <div className={`h-full rounded-full ${bg} transition-[width] duration-500`} style={{ width: `${pct}%` }} />
    </div>
  )
}

// ── Botões ────────────────────────────────────────────────────────────────────
export const btnPrimary = 'inline-flex items-center justify-center gap-1.5 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:opacity-50'
export const btnGhost = 'inline-flex items-center justify-center gap-1.5 rounded-xl border border-line bg-surface px-4 py-2.5 text-sm font-semibold text-ink transition hover:border-brand/40 hover:text-brand disabled:opacity-50'
export const inputCls = 'w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-muted/70 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20'

// ── Tabs ──────────────────────────────────────────────────────────────────────
export function Tabs<T extends string>({ tabs, active, onChange }: { tabs: { key: T; label: ReactNode; count?: number }[]; active: T; onChange: (k: T) => void }) {
  return (
    <div className="flex gap-1 overflow-x-auto border-b border-line">
      {tabs.map((t) => {
        const on = t.key === active
        return (
          <button key={t.key} onClick={() => onChange(t.key)}
            className={`whitespace-nowrap border-b-2 px-3.5 py-2.5 text-[.85rem] font-semibold transition-colors ${on ? 'border-brand text-brand' : 'border-transparent text-ink-muted hover:text-ink'}`}>
            {t.label}{typeof t.count === 'number' ? <span className="ml-1.5 rounded-full bg-black/[0.06] px-1.5 py-0.5 text-[.66rem] text-ink-muted">{t.count}</span> : null}
          </button>
        )
      })}
    </div>
  )
}

// ── Estado vazio ──────────────────────────────────────────────────────────────
export function EmptyState({ icon, title, text, action }: { icon?: IconName; title: string; text?: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-line bg-surface px-6 py-14 text-center shadow-card">
      {icon ? <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-50 text-brand"><Icon name={icon} size={28} /></div> : null}
      <div className="text-base font-bold text-ink">{title}</div>
      {text ? <p className="mx-auto mt-1 max-w-md text-sm text-ink-muted">{text}</p> : null}
      {action ? <div className="mt-6 flex flex-wrap items-center justify-center gap-2">{action}</div> : null}
    </div>
  )
}

// ── Aviso de migração pendente ────────────────────────────────────────────────
export function SetupBanner({ children }: { children?: ReactNode }) {
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
      {children ? <>{children} </> : 'Recurso novo. '}
      Rode <code className="rounded bg-amber-100 px-1 py-0.5">docs/sql/area-cliente.sql</code> no Supabase para ativar.
    </div>
  )
}

// ── Modal ─────────────────────────────────────────────────────────────────────
export function Modal({ title, children, onClose, wide }: { title: ReactNode; children: ReactNode; onClose: () => void; wide?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="fixed inset-0 z-[400] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4" onClick={onClose} role="dialog" aria-modal="true">
      <div className={`max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-surface p-5 shadow-pop sm:rounded-3xl ${wide ? 'max-w-2xl' : 'max-w-md'}`} onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="font-display text-lg font-bold text-ink">{title}</h3>
          <button onClick={onClose} aria-label="Fechar" className="flex h-8 w-8 items-center justify-center rounded-full border border-line text-ink-muted transition hover:bg-black/[0.04]">✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-2xl bg-black/[0.05] ${className}`} />
}

export function PageSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-16 w-full" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}
      </div>
      <Skeleton className="h-64 w-full" />
    </div>
  )
}

// ── Cartão de atalho (link) ───────────────────────────────────────────────────
export function ActionTile({ icon, title, text, href, tone = 'brand' }: { icon: IconName; title: string; text?: string; href: string; tone?: Tone }) {
  return (
    <Link href={href} className="group block rounded-2xl border border-line bg-surface p-4 shadow-card transition hover:-translate-y-0.5 hover:border-brand/30">
      <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${TONE_BG[tone]}`}><Icon name={icon} size={20} /></span>
      <div className="mt-3 text-sm font-bold text-ink">{title}</div>
      {text ? <div className="mt-0.5 text-[.78rem] text-ink-muted">{text}</div> : null}
    </Link>
  )
}
