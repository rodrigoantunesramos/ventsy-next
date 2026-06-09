'use client'

// Primitivas visuais do BI — KPIs, gráficos em SVG PURO (sem libs de chart),
// overlays e ícones. Espelham o padrão do /painel/financeiro (PALETTE, donut,
// combo barras+linha, sparkline) e são genéricas: recebem números + um `fmt`
// opcional para o eixo (a formatação de moeda/locale fica em lib/format).

import Link from 'next/link'
import { type ReactNode } from 'react'
import { formatNumber } from '@/lib/format'
import { PALETTE, rotuloMes } from '../_lib'

type Fmt = (n: number) => string
const idFmt: Fmt = (n) => formatNumber(Math.round(n))

// ── Wrappers ─────────────────────────────────────────────────────────────────
export function Card({ title, action, children, className = '' }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl bg-white p-5 shadow-card ${className}`}>
      {(title || action) && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          {title && <h3 className="text-base font-bold text-ink">{title}</h3>}
          {action}
        </div>
      )}
      {children}
    </div>
  )
}

export function Delta({ value, invert }: { value: number | null | undefined; invert?: boolean }) {
  if (value == null || value === 0) return null
  const good = invert ? value < 0 : value > 0
  return (
    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[0.65rem] font-bold ${good ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
      {value > 0 ? '↑' : '↓'} {Math.abs(value)}%
    </span>
  )
}

export function KpiCard({ label, value, sub, delta, vs, invertDelta, spark, tone = 'ink', hint }: {
  label: string; value: string; sub?: string; delta?: number | null; vs?: string; invertDelta?: boolean; spark?: number[]; tone?: 'ink' | 'verde' | 'vermelho' | 'gold' | 'azul' | 'roxo'; hint?: string
}) {
  const color = { ink: 'text-ink', verde: 'text-emerald-600', vermelho: 'text-red-600', gold: 'text-amber-600', azul: 'text-blue-600', roxo: 'text-violet-600' }[tone]
  const sparkColor = { ink: '#0d0d0d', verde: '#10b981', vermelho: '#ef4444', gold: '#f59e0b', azul: '#1a73e8', roxo: '#8b5cf6' }[tone]
  return (
    <div className="rounded-2xl bg-white p-4 shadow-card" title={hint}>
      <div className="text-[0.68rem] font-bold uppercase tracking-wider text-ink-muted/80">{label}</div>
      <div className="mt-2 flex items-end justify-between gap-2">
        <div className={`text-xl font-bold leading-none ${color}`}>{value}</div>
        {spark && spark.some((v) => v > 0) && <Sparkline values={spark} color={sparkColor} />}
      </div>
      <div className="mt-1.5 flex items-center justify-between gap-2">
        {sub ? <span className="text-[0.68rem] text-ink-muted">{sub}</span> : <span />}
        {delta != null && delta !== 0 ? (
          <span className={`flex items-center gap-1 text-[0.68rem] font-semibold ${(invertDelta ? delta < 0 : delta > 0) ? 'text-emerald-600' : 'text-red-500'}`}>
            <span>{delta > 0 ? '↑' : '↓'}{Math.abs(delta)}%</span>{vs && <span className="font-normal text-ink-muted">vs {vs}</span>}
          </span>
        ) : null}
      </div>
    </div>
  )
}

export function Sparkline({ values, color }: { values: number[]; color: string }) {
  const w = 60, h = 22, pad = 2
  const max = Math.max(...values, 1), min = Math.min(...values, 0), range = max - min || 1, n = values.length
  const pts = values.map((v, i) => `${(pad + (i * (w - 2 * pad)) / (n - 1 || 1)).toFixed(1)},${(h - pad - ((v - min) / range) * (h - 2 * pad)).toFixed(1)}`).join(' ')
  return <svg width={w} height={h} className="shrink-0"><polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.85" /></svg>
}

// ── Barras verticais (1 série) ───────────────────────────────────────────────
export function BarsChart({ data, fmt = idFmt, color = '#ff385c', height = 150 }: { data: { label: string; valor: number }[]; fmt?: Fmt; color?: string; height?: number }) {
  if (!data.length || data.every((d) => d.valor === 0)) return <EmptyChart />
  const max = Math.max(...data.map((d) => d.valor), 1)
  return (
    <div className="flex items-end justify-between gap-1.5" style={{ height }}>
      {data.map((d, i) => (
        <div key={i} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1.5">
          <span className="text-[0.6rem] font-bold text-ink-muted">{d.valor > 0 ? fmt(d.valor) : ''}</span>
          <div className="w-full rounded-md transition-all duration-500" style={{ height: `${Math.max(2, (d.valor / max) * 100)}%`, background: color }} />
          <span className="w-full truncate text-center text-[0.6rem] text-ink-muted" title={d.label}>{d.label}</span>
        </div>
      ))}
    </div>
  )
}

// ── Área + linha (série mensal) ──────────────────────────────────────────────
export function AreaMensal({ serie, fmt = idFmt, color = '#ff385c' }: { serie: { mes: string; valor: number }[]; fmt?: Fmt; color?: string }) {
  const W = 720, H = 190, P = { t: 14, r: 12, b: 26, l: 52 }
  const innerW = W - P.l - P.r, innerH = H - P.t - P.b, n = serie.length
  if (!n || serie.every((p) => p.valor === 0)) return <EmptyChart />
  const max = Math.max(...serie.map((p) => p.valor), 1)
  const x = (i: number) => P.l + (i * innerW) / Math.max(1, n - 1)
  const y = (v: number) => P.t + innerH * (1 - v / max)
  const linha = serie.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(p.valor).toFixed(1)}`).join(' ')
  const area = `${linha} L ${x(n - 1).toFixed(1)} ${P.t + innerH} L ${x(0).toFixed(1)} ${P.t + innerH} Z`
  const step = Math.ceil(n / 8)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="xMidYMid meet">
      <defs><linearGradient id={`grad-${color.slice(1)}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity="0.2" /><stop offset="100%" stopColor={color} stopOpacity="0" /></linearGradient></defs>
      {[0, 0.5, 1].map((f, i) => { const v = max * f, yy = y(v); return <g key={i}><line x1={P.l} y1={yy} x2={W - P.r} y2={yy} stroke="#f3f4f6" /><text x={P.l - 6} y={yy + 3} textAnchor="end" fontSize="8.5" fill="#9ca3af">{fmt(v)}</text></g> })}
      <path d={area} fill={`url(#grad-${color.slice(1)})`} />
      <path d={linha} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {serie.map((p, i) => <circle key={i} cx={x(i)} cy={y(p.valor)} r="2.4" fill={color} />)}
      {serie.map((p, i) => (i % step === 0 || i === n - 1) ? <text key={`t${i}`} x={x(i)} y={H - 8} fontSize="8.5" fill="#9ca3af" textAnchor="middle">{rotuloMes(p.mes)}</text> : null)}
    </svg>
  )
}

// ── Combo receita/despesa + linha de resultado ───────────────────────────────
export function ComboMensal({ data, fmt = idFmt }: { data: { mes: string; receita: number; despesa: number }[]; fmt?: Fmt }) {
  const W = 720, H = 210, PAD = { t: 26, r: 14, b: 32, l: 58 }
  const innerW = W - PAD.l - PAD.r, innerH = H - PAD.t - PAD.b
  if (!data.length || data.every((d) => d.receita === 0 && d.despesa === 0)) return <EmptyChart />
  const lucros = data.map((d) => d.receita - d.despesa)
  const yMax = Math.max(...data.flatMap((d) => [d.receita, d.despesa]), ...lucros, 1), yMin = Math.min(0, ...lucros), span = yMax - yMin || 1
  const sy = (v: number) => PAD.t + innerH * (1 - (v - yMin) / span)
  const zero = sy(0), slotW = innerW / data.length, barW = slotW * 0.26, gap = slotW * 0.05
  const lucroPts = data.map((d, i) => `${(PAD.l + i * slotW + slotW * 0.5).toFixed(1)},${sy(d.receita - d.despesa).toFixed(1)}`).join(' ')
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="xMidYMid meet">
      {[0, 0.5, 1].map((f, i) => { const v = yMin + span * f, yy = sy(v); return <g key={i}><line x1={PAD.l} y1={yy} x2={W - PAD.r} y2={yy} stroke={Math.abs(v) < 0.01 ? '#e5e7eb' : '#f3f4f6'} /><text x={PAD.l - 6} y={yy + 3} textAnchor="end" fontSize="8.5" fill="#9ca3af">{fmt(v)}</text></g> })}
      {data.map((d, i) => { const xs = PAD.l + i * slotW, xR = xs + slotW * 0.16, xD = xR + barW + gap; return <g key={i}>{d.receita > 0 && <rect x={xR} y={sy(d.receita)} width={barW} height={zero - sy(d.receita)} rx="3" fill="#10b981" opacity="0.85" />}{d.despesa > 0 && <rect x={xD} y={sy(d.despesa)} width={barW} height={zero - sy(d.despesa)} rx="3" fill="#ef4444" opacity="0.7" />}<text x={xs + slotW * 0.5} y={H - 8} textAnchor="middle" fontSize="9" fill="#9ca3af">{rotuloMes(d.mes)}</text></g> })}
      <polyline points={lucroPts} fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {data.map((d, i) => <circle key={i} cx={PAD.l + i * slotW + slotW * 0.5} cy={sy(d.receita - d.despesa)} r="2.5" fill="#fff" stroke="#f59e0b" strokeWidth="1.5" />)}
      <rect x={PAD.l} y={8} width={9} height={9} rx="2" fill="#10b981" opacity="0.85" /><text x={PAD.l + 13} y={16} fontSize="9" fill="#6b7280">Receita</text>
      <rect x={PAD.l + 62} y={8} width={9} height={9} rx="2" fill="#ef4444" opacity="0.7" /><text x={PAD.l + 75} y={16} fontSize="9" fill="#6b7280">Despesa</text>
      <line x1={PAD.l + 130} y1={12} x2={PAD.l + 144} y2={12} stroke="#f59e0b" strokeWidth="2" /><text x={PAD.l + 148} y={16} fontSize="9" fill="#6b7280">Resultado</text>
    </svg>
  )
}

// ── Donut por categoria ──────────────────────────────────────────────────────
export function Donut({ data, fmt }: { data: [string, number][]; fmt?: Fmt }) {
  const total = data.reduce((s, [, v]) => s + v, 0) || 1, top = data.slice(0, 8), r = 52, sw = 16, C = 2 * Math.PI * r
  if (!data.length) return <EmptyChart h={160} />
  let offset = 0
  return (
    <div className="flex items-center gap-4">
      <svg width="128" height="128" viewBox="0 0 128 128" className="shrink-0 -rotate-90">
        <circle cx="64" cy="64" r={r} fill="none" stroke="#f1f5f9" strokeWidth={sw} />
        {top.map(([cat, val], i) => { const len = (val / total) * C; const el = <circle key={cat} cx="64" cy="64" r={r} fill="none" stroke={PALETTE[i % PALETTE.length]} strokeWidth={sw} strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-offset} />; offset += len; return el })}
      </svg>
      <div className="min-w-0 flex-1 space-y-1.5">
        {top.map(([cat, val], i) => (
          <div key={cat} className="flex items-center gap-2 text-xs">
            <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: PALETTE[i % PALETTE.length] }} />
            <span className="min-w-0 flex-1 truncate text-ink-soft">{cat}</span>
            <span className="shrink-0 font-semibold text-ink-muted">{fmt ? fmt(val) : `${Math.round((val / total) * 100)}%`}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Lista ranqueada (barra horizontal) ───────────────────────────────────────
export function RankList({ itens, fmt = idFmt, cor = '#ff385c' }: { itens: { label: string; valor: number; n?: number }[]; fmt?: Fmt; cor?: string }) {
  if (!itens.length) return <EmptyChart h={120} />
  const max = Math.max(...itens.map((i) => i.valor), 1)
  return (
    <div className="space-y-2.5">
      {itens.map((it, i) => (
        <div key={i}>
          <div className="mb-1 flex items-center justify-between gap-2 text-xs">
            <span className="flex min-w-0 items-center gap-1.5 font-medium text-ink-soft">
              <span className="w-4 shrink-0 text-right tabular-nums text-ink-muted/50">{i + 1}.</span>
              <span className="truncate" title={it.label}>{it.label}</span>
              {it.n != null && <span className="shrink-0 rounded-full bg-black/[0.04] px-1.5 text-[0.6rem] text-ink-muted">{it.n}</span>}
            </span>
            <span className="shrink-0 font-semibold text-ink-muted">{fmt(it.valor)}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-black/[0.06]"><div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.max(2, (it.valor / max) * 100)}%`, background: cor }} /></div>
        </div>
      ))}
    </div>
  )
}

// ── Funil de etapas ──────────────────────────────────────────────────────────
export function Funnel({ etapas }: { etapas: { label: string; n: number; cor: string; taxa?: number | null }[] }) {
  const max = Math.max(1, etapas[0]?.n || 1)
  return (
    <div className="space-y-3">
      {etapas.map((e, i) => (
        <div key={e.label}>
          <div className="mb-1 flex items-center justify-between text-sm">
            <span className="font-semibold text-ink-soft">{e.label}</span>
            <span className="flex items-center gap-2">
              <span className="font-bold text-ink">{formatNumber(e.n)}</span>
              {i > 0 && e.taxa != null && <span className="rounded-full bg-black/[0.05] px-2 py-0.5 text-[0.65rem] font-bold text-ink-muted">{Math.round(e.taxa * 100)}%</span>}
            </span>
          </div>
          <div className="h-7 overflow-hidden rounded-lg bg-black/[0.04]"><div className="h-full rounded-lg transition-all duration-700" style={{ width: `${Math.max(4, Math.round((e.n / max) * 100))}%`, background: e.cor }} /></div>
        </div>
      ))}
    </div>
  )
}

// ── Heatmap de ocupação por mês ──────────────────────────────────────────────
export function OcupacaoHeatmap({ data }: { data: { mes: string; taxa: number }[] }) {
  if (!data.length) return <EmptyChart h={80} />
  const cor = (t: number) => {
    if (t <= 0) return '#f1f5f9'
    if (t < 0.25) return '#cce5d8'
    if (t < 0.5) return '#86d6a6'
    if (t < 0.75) return '#34c177'
    return '#10b981'
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {data.map((d) => (
        <div key={d.mes} className="flex flex-col items-center gap-1">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg text-[0.6rem] font-bold" style={{ background: cor(d.taxa), color: d.taxa >= 0.5 ? '#fff' : '#475569' }} title={`${rotuloMes(d.mes)}: ${Math.round(d.taxa * 100)}%`}>
            {Math.round(d.taxa * 100)}%
          </div>
          <span className="text-[0.58rem] text-ink-muted">{rotuloMes(d.mes).split(' ')[0]}</span>
        </div>
      ))}
    </div>
  )
}

// ── Medidor de NPS (semicírculo −100..100) ───────────────────────────────────
export function NpsGauge({ score }: { score: number }) {
  const W = 200, H = 116, cx = 100, cy = 100, r = 80
  const ang = (v: number) => Math.PI * (1 - (v + 100) / 200) // v:-100..100 → π..0
  const pt = (a: number) => [cx + r * Math.cos(a), cy - r * Math.sin(a)]
  const [ex, ey] = pt(ang(Math.max(-100, Math.min(100, score))))
  const arc = (a0: number, a1: number) => { const [x0, y0] = pt(a0), [x1, y1] = pt(a1); return `M ${x0.toFixed(1)} ${y0.toFixed(1)} A ${r} ${r} 0 0 1 ${x1.toFixed(1)} ${y1.toFixed(1)}` }
  const tom = score >= 50 ? '#10b981' : score >= 0 ? '#f59e0b' : '#ef4444'
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mx-auto w-full max-w-[240px]">
      <path d={arc(ang(-100), ang(-1))} fill="none" stroke="#fecaca" strokeWidth="14" strokeLinecap="round" />
      <path d={arc(ang(0), ang(49))} fill="none" stroke="#fde68a" strokeWidth="14" strokeLinecap="round" />
      <path d={arc(ang(50), ang(100))} fill="none" stroke="#a7f3d0" strokeWidth="14" strokeLinecap="round" />
      <line x1={cx} y1={cy} x2={ex} y2={ey} stroke={tom} strokeWidth="3" strokeLinecap="round" />
      <circle cx={cx} cy={cy} r="5" fill={tom} />
      <text x={cx} y={cy - 28} textAnchor="middle" fontSize="30" fontWeight="800" fill={tom}>{score > 0 ? `+${score}` : score}</text>
    </svg>
  )
}

// ── Estados ──────────────────────────────────────────────────────────────────
export function EmptyChart({ h = 150, msg = 'Sem dados no período.' }: { h?: number; msg?: string }) {
  return <div className="flex items-center justify-center text-sm text-ink-muted" style={{ height: h }}>{msg}</div>
}

export function EmptyState({ icon, titulo, texto, cta }: { icon?: ReactNode; titulo: string; texto: string; cta?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-black/10 bg-white p-12 text-center shadow-card">
      <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-brand-50 text-brand">{icon || <IcoChart />}</div>
      <h3 className="text-base font-bold text-ink">{titulo}</h3>
      <p className="mx-auto mt-1 max-w-md text-sm text-ink-muted">{texto}</p>
      {cta && <div className="mt-4">{cta}</div>}
    </div>
  )
}

export function PremiumOverlay({ msg }: { msg?: string }) {
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center rounded-2xl bg-white/70 backdrop-blur-sm">
      <div className="mx-4 max-w-sm rounded-2xl border border-black/[0.06] bg-white p-6 text-center shadow-pop">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-brand text-white"><IcoLock /></div>
        <h3 className="font-display text-lg font-bold text-ink">Recurso Pro+</h3>
        <p className="mt-1 text-sm text-ink-muted">{msg || 'O BI completo (construtor e exportação agendada) faz parte dos planos Pro e Ultra.'}</p>
        <Link href="/painel/planos" className="mt-4 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-brand px-5 py-2.5 text-sm font-bold text-white hover:opacity-90">Conhecer planos</Link>
      </div>
    </div>
  )
}

export function SetupNotice({ sql = 'relatorios.sql' }: { sql?: string }) {
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700"><IcoDb /></span>
        <div className="text-sm text-amber-900">
          <p className="font-semibold">Recursos de relatório salvos/agendados ainda não ativados</p>
          <p className="mt-1 text-amber-800">Rode a migration <code className="rounded bg-amber-100 px-1 py-0.5">docs/sql/{sql}</code> no Supabase para habilitar o construtor salvo e a exportação agendada. Os dashboards já funcionam normalmente.</p>
        </div>
      </div>
    </div>
  )
}

// ── Ícones ───────────────────────────────────────────────────────────────────
const svg = (path: ReactNode, size = 22, sw = 1.8) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">{path}</svg>
export const IcoChart = () => svg(<path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />)
export const IcoLock = () => svg(<><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></>, 22, 2)
export const IcoDb = () => svg(<><ellipse cx="12" cy="5" rx="8" ry="3" /><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" /></>, 18)
export const IcoDownload = () => svg(<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />, 15)
export const IcoSpark = () => svg(<path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8" />, 15)
