// Primitivos de UI da página Multi-unidades. Apresentacionais (sem estado e sem
// formatar moeda — quem chama formata via lib/format e passa strings prontas).
// Espelham o design system e os gráficos em SVG puro do /painel/financeiro.

import Link from 'next/link'
import { type ReactNode } from 'react'

// ── Containers ───────────────────────────────────────────────────────────────
export function Section({ title, hint, action, children, className = '' }: { title?: string; hint?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl bg-white p-5 shadow-card ${className}`}>
      {(title || action) && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            {title && <h3 className="text-base font-bold text-ink">{title}</h3>}
            {hint && <p className="mt-0.5 text-xs text-ink-muted">{hint}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </div>
  )
}

export function Kpi({ label, value, sub, tone = 'ink', icon }: { label: string; value: string; sub?: string; tone?: 'ink' | 'verde' | 'vermelho' | 'gold' | 'azul' | 'brand'; icon?: ReactNode }) {
  const color = { ink: 'text-ink', verde: 'text-emerald-600', vermelho: 'text-red-600', gold: 'text-amber-600', azul: 'text-blue-600', brand: 'text-brand' }[tone]
  const iconBg = { ink: 'bg-black/[0.04] text-ink-soft', verde: 'bg-emerald-50 text-emerald-600', vermelho: 'bg-red-50 text-red-600', gold: 'bg-amber-50 text-amber-600', azul: 'bg-blue-50 text-blue-600', brand: 'bg-brand-50 text-brand' }[tone]
  return (
    <div className="rounded-2xl bg-white p-4 shadow-card">
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs text-ink-muted">{label}</span>
        {icon && <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${iconBg}`}>{icon}</span>}
      </div>
      <div className={`mt-2 text-xl font-bold ${color}`}>{value}</div>
      {sub && <div className="mt-1 text-[0.68rem] font-medium text-ink-muted">{sub}</div>}
    </div>
  )
}

/** Barra horizontal proporcional para ranking/comparativo (valor já formatado em `right`). */
export function StatBar({ label, right, valor, max, cor = '#ff385c', rank, sub, destaque }: { label: string; right: string; valor: number; max: number; cor?: string; rank?: number; sub?: string; destaque?: boolean }) {
  const pct = max > 0 ? Math.max(2, Math.round((Math.max(0, valor) / max) * 100)) : 0
  return (
    <div className={destaque ? 'rounded-xl bg-brand-50/40 px-2.5 py-2 -mx-1.5' : ''}>
      <div className="mb-1 flex items-center justify-between gap-2 text-xs">
        <span className="flex min-w-0 items-center gap-1.5 font-semibold text-ink-soft">
          {rank != null && <span className="w-4 shrink-0 text-right font-normal tabular-nums text-ink-muted/50">{rank}.</span>}
          <span className="truncate">{label}</span>
        </span>
        <span className="shrink-0 tabular-nums font-bold text-ink">{right}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-black/[0.06]">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: cor }} />
      </div>
      {sub && <div className="mt-1 text-[0.65rem] text-ink-muted">{sub}</div>}
    </div>
  )
}

/** Mini medidor de progresso (meta/atingimento, ocupação). `pct` é fração 0..1+. */
export function Gauge({ pct, cor = '#16a34a' }: { pct: number; cor?: string }) {
  const w = Math.max(0, Math.min(100, Math.round(pct * 100)))
  return (
    <div className="h-2 overflow-hidden rounded-full bg-black/[0.06]">
      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${w}%`, background: cor }} />
    </div>
  )
}

// ── Estados ──────────────────────────────────────────────────────────────────
export function SetupNotice() {
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700"><IcoDb /></span>
        <div className="text-sm text-amber-900">
          <p className="font-semibold">Multi-unidades ainda não ativado</p>
          <p className="mt-1 text-amber-800">Rode a migration <code className="rounded bg-amber-100 px-1 py-0.5">docs/sql/unidades.sql</code> no Supabase para criar os grupos, a configuração por unidade e o controle de acesso. A consolidação usa suas propriedades e lançamentos já existentes. Depois recarregue esta página.</p>
        </div>
      </div>
    </div>
  )
}

export function EmptyState({ icon, title, msg, action }: { icon?: ReactNode; title: string; msg?: string; action?: ReactNode }) {
  return (
    <div className="py-12 text-center">
      <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand">{icon || <IcoUnits />}</div>
      <p className="mb-1 text-sm font-semibold text-ink">{title}</p>
      {msg && <p className="mx-auto mb-5 max-w-md text-xs text-ink-muted">{msg}</p>}
      {action}
    </div>
  )
}

/** Overlay premium (Ultra): borra o conteúdo e mostra CTA para /painel/planos. */
export function PremiumOverlayUltra() {
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center rounded-2xl bg-white/70 backdrop-blur-sm">
      <div className="mx-4 max-w-sm rounded-2xl border border-black/[0.06] bg-white p-6 text-center shadow-pop">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-brand text-white"><IcoLock /></div>
        <h3 className="font-display text-lg font-bold text-ink">Recurso Ultra</h3>
        <p className="mt-1 text-sm text-ink-muted">A gestão de múltiplas unidades (consolidado, comparativo, troca de contexto e franquia) faz parte do plano Ultra.</p>
        <Link href="/painel/planos" className="mt-4 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-brand px-5 py-2.5 text-sm font-bold text-white hover:opacity-90">Conhecer o Ultra</Link>
      </div>
    </div>
  )
}

// ── Ícones (stroke premium, SVG inline) ──────────────────────────────────────
const svg = (path: ReactNode, size = 16, sw = 1.8) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">{path}</svg>
export const IcoUnits = () => svg(<path d="M3 21V7l6-4 6 4v14M15 21V11l6 4v6M3 21h18M7 9h.01M7 13h.01M7 17h.01" />, 22)
export const IcoDb = () => svg(<><ellipse cx="12" cy="5" rx="9" ry="3" /><path d="M3 5v14a9 3 0 0 0 18 0V5M3 12a9 3 0 0 0 18 0" /></>)
export const IcoLock = () => svg(<><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></>, 22)
export const IcoTrophy = () => svg(<path d="M8 21h8M12 17v4M7 4h10v4a5 5 0 0 1-10 0V4ZM7 6H4v2a3 3 0 0 0 3 3M17 6h3v2a3 3 0 0 1-3 3" />)
export const IcoStore = () => svg(<path d="M3 9 4.5 4h15L21 9M4 9v10a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V9M3 9h18M9 20v-6h6v6" />)
export const IcoCoins = () => svg(<><ellipse cx="9" cy="7" rx="6" ry="3" /><path d="M3 7v5c0 1.7 2.7 3 6 3M15 10c3.3 0 6 1.3 6 3v5c0 1.7-2.7 3-6 3s-6-1.3-6-3v-5" /></>)
export const IcoStar = () => svg(<path d="M12 3.5l2.6 5.27 5.82.85-4.21 4.1.99 5.79L12 16.77l-5.2 2.73.99-5.79-4.21-4.1 5.82-.85L12 3.5Z" />)
export const IcoCal = () => svg(<path d="M3 9h18M7 3v4M17 3v4M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" />)
export const IcoChart = () => svg(<path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />)
export const IcoUsers = () => svg(<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm13 10v-2a4 4 0 0 0-3-3.87M16 3.13A4 4 0 0 1 16 11" />)
export const IcoPlus = () => svg(<path d="M12 5v14M5 12h14" />, 16, 2.2)
export const IcoEdit = () => svg(<><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4Z" /></>, 14)
export const IcoTrash = () => svg(<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />, 14)
export const IcoCheck = () => svg(<path d="M20 6 9 17l-5-5" />, 15)
export const IcoX = () => svg(<path d="M18 6 6 18M6 6l12 12" />, 16)
export const IcoLayers = () => svg(<path d="M12 2 2 7l10 5 10-5-10-5ZM2 17l10 5 10-5M2 12l10 5 10-5" />)
export const IcoDownload = () => svg(<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />, 15)
export const IcoMap = () => svg(<path d="m9 4-6 2v14l6-2 6 2 6-2V4l-6 2-6-2Zm0 0v14m6-12v14" />)
