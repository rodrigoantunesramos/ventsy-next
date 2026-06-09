// Primitivos de UI da Auditoria (apresentacionais, sem estado).
// Espelham o design system e os gráficos em SVG puro do projeto.

import Link from 'next/link'
import { type ReactNode } from 'react'
import { acaoChip, acaoLabel } from '@/lib/audit'

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

export function KpiCard({ label, value, sub, tone = 'ink', icon }: { label: string; value: string; sub?: string; tone?: 'ink' | 'verde' | 'vermelho' | 'gold' | 'azul' | 'roxo'; icon?: ReactNode }) {
  const color = { ink: 'text-ink', verde: 'text-emerald-600', vermelho: 'text-red-600', gold: 'text-amber-600', azul: 'text-blue-600', roxo: 'text-violet-600' }[tone]
  const iconBg = { ink: 'bg-black/[0.04] text-ink-soft', verde: 'bg-emerald-50 text-emerald-600', vermelho: 'bg-red-50 text-red-600', gold: 'bg-amber-50 text-amber-600', azul: 'bg-blue-50 text-blue-600', roxo: 'bg-violet-50 text-violet-600' }[tone]
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

/** Chip da ação (cor semântica do catálogo). */
export function AcaoChip({ acao, falha }: { acao: string; falha?: boolean }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[0.68rem] font-semibold ${acaoChip(acao)}`}>
      {acaoLabel(acao)}{falha ? '' : ''}
    </span>
  )
}

// ── Sparkline (atividade por dia) ─────────────────────────────────────────────
export function Sparkline({ serie }: { serie: { dia: string; n: number }[] }) {
  const W = 720, H = 56, PAD = 4
  const max = Math.max(1, ...serie.map((d) => d.n))
  const step = serie.length > 1 ? (W - PAD * 2) / (serie.length - 1) : 0
  const y = (n: number) => H - PAD - (H - PAD * 2) * (n / max)
  const pts = serie.map((d, i) => `${(PAD + i * step).toFixed(1)},${y(d.n).toFixed(1)}`).join(' ')
  const area = `${PAD},${H - PAD} ${pts} ${(PAD + (serie.length - 1) * step).toFixed(1)},${H - PAD}`
  if (!serie.length || serie.every((d) => d.n === 0)) {
    return <div className="flex h-[56px] items-center text-xs text-ink-muted">Sem atividade no período.</div>
  }
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="none" aria-label="Atividade por dia">
      <polygon points={area} fill="#ff385c" opacity="0.08" />
      <polyline points={pts} fill="none" stroke="#ff385c" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ── Estados ──────────────────────────────────────────────────────────────────
export function SetupNotice() {
  return (
    <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-600"><IcoShield /></div>
      <h3 className="text-base font-bold text-ink">Ative a Auditoria</h3>
      <p className="mx-auto mt-1 max-w-lg text-sm text-ink-muted">
        Rode <code className="rounded bg-black/[0.06] px-1.5 py-0.5 text-xs">docs/sql/auditoria.sql</code> no Supabase (SQL Editor) para criar a tabela <code className="rounded bg-black/[0.06] px-1.5 py-0.5 text-xs">auditoria_log</code> e começar a registrar quem fez o quê: criações, edições, exclusões, logins, exportações e pagamentos.
      </p>
    </div>
  )
}

export function EmptyState({ icon, title, msg }: { icon?: ReactNode; title: string; msg?: string }) {
  return (
    <div className="py-12 text-center">
      <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand">{icon || <IcoList />}</div>
      <p className="mb-1 text-sm font-semibold text-ink">{title}</p>
      {msg && <p className="mx-auto max-w-md text-xs text-ink-muted">{msg}</p>}
    </div>
  )
}

/** Gate premium em página inteira (Pro+) — não renderiza dados sensíveis. */
export function PremiumGate() {
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-xl font-bold text-ink sm:text-2xl">Auditoria & Logs</h1>
      <p className="mt-1 text-sm text-ink-muted">Trilha de quem fez o quê, quando e de onde — em entidades sensíveis, logins e exportações.</p>
      <div className="mt-6 overflow-hidden rounded-2xl border border-black/[0.06] bg-white shadow-card">
        <div className="flex flex-col items-center gap-4 bg-gradient-to-br from-amber-50 to-brand-50 px-6 py-10 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-brand text-white"><IcoLock /></div>
          <div>
            <h3 className="font-display text-lg font-bold text-ink">Recurso Pro+</h3>
            <p className="mx-auto mt-1 max-w-md text-sm text-ink-muted">A trilha de auditoria — essencial com multi-usuário e para confiança e conformidade (LGPD) — faz parte dos planos Pro e Ultra.</p>
          </div>
          <Link href="/painel/planos" className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-brand px-5 py-2.5 text-sm font-bold text-white hover:opacity-90">Conhecer planos</Link>
        </div>
        <ul className="grid gap-px bg-black/[0.06] sm:grid-cols-2">
          {[
            ['Linha do tempo com diff', 'Veja o antes → depois de cada edição sensível.'],
            ['Sensíveis em destaque', 'Exclusões, preços, permissões, exportações e pagamentos.'],
            ['Segurança', 'Logins (sucesso/falha), dispositivos e acessos incomuns.'],
            ['Exportação & retenção', 'Trilha por período para auditoria externa; retenção configurável.'],
          ].map(([t, d]) => (
            <li key={t} className="bg-white p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-ink"><span className="text-emerald-600"><IcoCheck /></span>{t}</div>
              <p className="mt-1 pl-6 text-xs text-ink-muted">{d}</p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

// ── Ícones (stroke premium, SVG inline) ──────────────────────────────────────
const svg = (path: ReactNode, size = 16, sw = 1.8) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">{path}</svg>
export const IcoShield = () => svg(<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3ZM9.5 12l2 2 3.5-4" />, 22)
export const IcoList = () => svg(<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />, 24)
export const IcoLock = () => svg(<><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></>, 26)
export const IcoCheck = () => svg(<path d="M20 6 9 17l-5-5" />, 15)
export const IcoX = () => svg(<path d="M18 6 6 18M6 6l12 12" />, 14)
export const IcoDownload = () => svg(<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />, 15)
export const IcoTrash = () => svg(<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6" />, 15)
export const IcoSearch = () => svg(<><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></>, 15)
export const IcoUser = () => svg(<path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />)
export const IcoClock = () => svg(<path d="M12 7v5l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z" />)
export const IcoAlert = () => svg(<path d="M12 9v4M12 17h.01M10.3 3.9 2 18a2 2 0 0 0 1.7 3h16.6a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />)
export const IcoChevron = () => svg(<path d="m6 9 6 6 6-6" />, 16)
export const IcoBolt = () => svg(<path d="M13 2 3 14h8l-1 8 10-12h-8l1-8Z" />)
export const IcoGlobe = () => svg(<path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />)
export const IcoMonitor = () => svg(<><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M8 20h8M12 16v4" /></>)
export const IcoExport = () => svg(<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />)
