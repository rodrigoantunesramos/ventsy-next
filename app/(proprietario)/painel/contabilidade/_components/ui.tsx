// Primitivos de UI compartilhados pelas abas da Contabilidade.
// Apresentacionais (sem estado): cards, KPIs, barras e combo SVG (sem libs de
// chart), gate premium, avisos de setup/empty. Espelham o design system e os
// gráficos em SVG puro do /painel/financeiro.

import Link from 'next/link'
import { type ReactNode } from 'react'
import { formatMoneyShort } from '@/lib/format'

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

export function KpiCard({ label, value, sub, tone = 'ink', icon }: { label: string; value: string; sub?: string; tone?: 'ink' | 'verde' | 'vermelho' | 'gold' | 'azul'; icon?: ReactNode }) {
  const color = { ink: 'text-ink', verde: 'text-emerald-600', vermelho: 'text-red-600', gold: 'text-amber-600', azul: 'text-blue-600' }[tone]
  const iconBg = { ink: 'bg-black/[0.04] text-ink-soft', verde: 'bg-emerald-50 text-emerald-600', vermelho: 'bg-red-50 text-red-600', gold: 'bg-amber-50 text-amber-600', azul: 'bg-blue-50 text-blue-600' }[tone]
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

/** Barra horizontal proporcional (distribuições / aging). */
export function Bar({ label, value, total, cor, right }: { label: string; value: number; total: number; cor: string; right?: string }) {
  const pct = total > 0 ? Math.round((Math.abs(value) / Math.abs(total)) * 100) : 0
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="min-w-0 flex-1 truncate text-ink-soft">{label}</span>
        <span className="ml-2 shrink-0 font-semibold text-ink-muted">{right ?? formatMoneyShort(value)}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-black/[0.06]"><div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: cor }} /></div>
    </div>
  )
}

// ── Combo de fluxo de caixa (barras entrada/saída + linha de saldo) ──────────
export function FluxoBarsChart({ dados }: { dados: { label: string; entrada: number; saida: number; saldo: number }[] }) {
  const W = 760, H = 220, PAD = { t: 24, r: 14, b: 38, l: 60 }
  const innerW = W - PAD.l - PAD.r, innerH = H - PAD.t - PAD.b
  const saldos = dados.map((d) => d.saldo)
  const yMax = Math.max(...dados.flatMap((d) => [d.entrada, d.saida]), ...saldos, 1)
  const yMin = Math.min(0, ...saldos)
  const span = yMax - yMin || 1
  const scaleY = (v: number) => PAD.t + innerH * (1 - (v - yMin) / span)
  const zeroY = scaleY(0), slotW = innerW / Math.max(dados.length, 1), barW = slotW * 0.3, gap = slotW * 0.04
  if (!dados.length || dados.every((d) => d.entrada === 0 && d.saida === 0)) {
    return <div className="flex h-[180px] items-center justify-center"><p className="text-sm text-ink-muted">Sem parcelas a receber ou contas a pagar nos próximos meses.</p></div>
  }
  const saldoPts = dados.map((d, i) => `${(PAD.l + i * slotW + slotW * 0.5).toFixed(1)},${scaleY(d.saldo).toFixed(1)}`).join(' ')
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="xMidYMid meet" aria-label="Projeção de fluxo de caixa">
      {[0, 0.5, 1].map((f, i) => {
        const v = yMin + span * f, y = scaleY(v)
        return <g key={i}><line x1={PAD.l} y1={y} x2={W - PAD.r} y2={y} stroke={Math.abs(v) < 0.01 ? '#e5e7eb' : '#f3f4f6'} strokeWidth="1" /><text x={PAD.l - 6} y={y + 3.5} textAnchor="end" fontSize="8.5" fill="#9ca3af">{v === 0 ? '0' : formatMoneyShort(v)}</text></g>
      })}
      {dados.map((d, i) => {
        const xSlot = PAD.l + i * slotW, xE = xSlot + slotW * 0.1, xS = xE + barW + gap, yE = scaleY(d.entrada), yS = scaleY(d.saida)
        return <g key={i}>{d.entrada > 0 && <rect x={xE} y={yE} width={barW} height={zeroY - yE} rx="2" fill="#10b981" opacity="0.8" />}{d.saida > 0 && <rect x={xS} y={yS} width={barW} height={zeroY - yS} rx="2" fill="#ef4444" opacity="0.65" />}<text x={xSlot + slotW * 0.5} y={H - 8} textAnchor="middle" fontSize="8.5" fill="#9ca3af">{d.label}</text></g>
      })}
      <polyline points={saldoPts} fill="none" stroke="#1a73e8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {dados.map((d, i) => <circle key={i} cx={PAD.l + i * slotW + slotW * 0.5} cy={scaleY(d.saldo)} r="2.4" fill="#fff" stroke="#1a73e8" strokeWidth="1.5" />)}
      <rect x={PAD.l} y={6} width={9} height={9} rx="2" fill="#10b981" opacity="0.8" /><text x={PAD.l + 13} y={14} fontSize="9" fill="#6b7280">Entradas</text>
      <rect x={PAD.l + 70} y={6} width={9} height={9} rx="2" fill="#ef4444" opacity="0.65" /><text x={PAD.l + 83} y={14} fontSize="9" fill="#6b7280">Saídas</text>
      <line x1={PAD.l + 135} y1={10} x2={PAD.l + 149} y2={10} stroke="#1a73e8" strokeWidth="2" /><text x={PAD.l + 153} y={14} fontSize="9" fill="#6b7280">Saldo acumulado</text>
    </svg>
  )
}

// ── Estados ──────────────────────────────────────────────────────────────────
export function SetupNotice() {
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700"><IcoDb /></span>
        <div className="text-sm text-amber-900">
          <p className="font-semibold">Contabilidade ainda não ativada</p>
          <p className="mt-1 text-amber-800">Rode a migration <code className="rounded bg-amber-100 px-1 py-0.5">docs/sql/contabilidade.sql</code> no Supabase para criar o plano de contas, centros de custo, contas bancárias, conciliação e o fechamento mensal. Depois recarregue esta página.</p>
        </div>
      </div>
    </div>
  )
}

export function EmptyState({ icon, title, msg, action }: { icon?: ReactNode; title: string; msg?: string; action?: ReactNode }) {
  return (
    <div className="py-12 text-center">
      <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand">{icon || <IcoDoc />}</div>
      <p className="mb-1 text-sm font-semibold text-ink">{title}</p>
      {msg && <p className="mx-auto mb-5 max-w-md text-xs text-ink-muted">{msg}</p>}
      {action}
    </div>
  )
}

/** Overlay premium (Pro+): borra o conteúdo e mostra CTA para /painel/planos. */
export function PremiumOverlay() {
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center rounded-2xl bg-white/70 backdrop-blur-sm">
      <div className="mx-4 max-w-sm rounded-2xl border border-black/[0.06] bg-white p-6 text-center shadow-pop">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-brand text-white"><IcoLock /></div>
        <h3 className="font-display text-lg font-bold text-ink">Recurso Pro+</h3>
        <p className="mt-1 text-sm text-ink-muted">A Contabilidade completa (plano de contas, DRE, balancete, conciliação e fechamento) faz parte dos planos Pro e Ultra.</p>
        <Link href="/painel/planos" className="mt-4 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-brand px-5 py-2.5 text-sm font-bold text-white hover:opacity-90">Conhecer planos</Link>
      </div>
    </div>
  )
}

// ── Ícones (stroke premium, SVG inline) ──────────────────────────────────────
const svg = (path: ReactNode, size = 16, sw = 1.8) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">{path}</svg>
export const IcoDoc = () => svg(<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Zm0 0v6h6M8 13h8M8 17h6" />, 26)
export const IcoDb = () => svg(<><ellipse cx="12" cy="5" rx="9" ry="3" /><path d="M3 5v14a9 3 0 0 0 18 0V5M3 12a9 3 0 0 0 18 0" /></>)
export const IcoLock = () => svg(<><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></>, 22)
export const IcoTree = () => svg(<path d="M3 6h6M3 6v12h6M9 12h6M15 12h6M15 6h6" />)
export const IcoScale = () => svg(<path d="M12 3v18M5 7h14M7 7l-3 7a3 3 0 0 0 6 0L7 7Zm10 0-3 7a3 3 0 0 0 6 0l-3-7Z" />)
export const IcoCash = () => svg(<path d="M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Zm9 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />)
export const IcoLink = () => svg(<path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" />)
export const IcoLockClosed = () => svg(<><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></>)
export const IcoChart = () => svg(<path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />)
export const IcoCheck = () => svg(<path d="M20 6 9 17l-5-5" />)
export const IcoDownload = () => svg(<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />, 15)
export const IcoUpload = () => svg(<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />, 15)
export const IcoPlus = () => svg(<path d="M12 5v14M5 12h14" />, 15, 2.2)
export const IcoEdit = () => svg(<><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4Z" /></>, 14)
export const IcoTrash = () => svg(<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />, 14)
export const IcoCoins = () => svg(<><ellipse cx="9" cy="7" rx="6" ry="3" /><path d="M3 7v5c0 1.7 2.7 3 6 3M15 10c3.3 0 6 1.3 6 3v5c0 1.7-2.7 3-6 3s-6-1.3-6-3v-5" /></>)
