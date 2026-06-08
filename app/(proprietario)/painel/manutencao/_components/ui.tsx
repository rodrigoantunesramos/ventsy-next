'use client';

// Átomos de UI compartilhados pelas abas de Manutenção (Ordens · Preventiva ·
// Custos). Mantém o look do painel (tokens de marca, shadow-card/pop, raios) e
// evita duplicar Kpi/Modal/ícones/badges/charts entre as abas.

import { useEffect, useState, type ReactNode } from 'react';
import { STATUS_BY, PRIO_BY, TIPO_BY, progressoChecklist, type ChecklistItem, type OSStatus, type Prioridade, type OSTipo } from '../_lib';

// ── KPI card ──────────────────────────────────────────────────────────────────
export type Tone = 'ink' | 'brand' | 'azul' | 'gold' | 'verde' | 'vermelho' | 'roxo' | 'sky' | 'laranja';
const TONE_TEXT: Record<Tone, string> = {
  ink: 'text-ink', brand: 'text-brand', azul: 'text-blue-600', gold: 'text-amber-600',
  verde: 'text-emerald-600', vermelho: 'text-red-600', roxo: 'text-violet-600', sky: 'text-sky-600', laranja: 'text-orange-600',
};
const TONE_BG: Record<Tone, string> = {
  ink: 'bg-black/[0.05] text-ink-soft', brand: 'bg-brand-50 text-brand', azul: 'bg-blue-50 text-blue-600', gold: 'bg-amber-50 text-amber-600',
  verde: 'bg-emerald-50 text-emerald-600', vermelho: 'bg-red-50 text-red-600', roxo: 'bg-violet-50 text-violet-600', sky: 'bg-sky-50 text-sky-600', laranja: 'bg-orange-50 text-orange-600',
};
export function Kpi({ label, value, sub, tone, icon }: { label: string; value: string; sub?: string; tone: Tone; icon?: ReactNode }) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-card">
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs text-ink-muted">{label}</span>
        {icon && <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${TONE_BG[tone]}`}>{icon}</span>}
      </div>
      <div className={`mt-2 text-xl font-bold ${TONE_TEXT[tone]}`}>{value}</div>
      {sub && <div className="mt-0.5 text-[0.68rem] text-ink-muted">{sub}</div>}
    </div>
  );
}

// ── Modal shell (Esc + clique no backdrop fecham) ─────────────────────────────
export function ModalShell({ onClose, children, maxW = 'max-w-md' }: { onClose: () => void; children: ReactNode; maxW?: string }) {
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

export function Campo({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-ink-soft">{label}{hint && <span className="ml-1 font-normal text-ink-muted">{hint}</span>}</span>
      {children}
    </label>
  );
}

// ── Badges (status, prioridade, tipo) ─────────────────────────────────────────
export function StatusBadge({ v }: { v: OSStatus }) {
  const s = STATUS_BY[v];
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${s.cls}`}>{s.label}</span>;
}
export function PrioBadge({ v }: { v: Prioridade }) {
  const p = PRIO_BY[v];
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[0.68rem] font-semibold ${p.cls}`}>{p.label}</span>;
}
export function TipoDot({ v }: { v: OSTipo }) {
  const t = TIPO_BY[v];
  return <span className="inline-flex items-center gap-1.5 text-xs text-ink-soft"><span className="h-2 w-2 shrink-0 rounded-full" style={{ background: t.cor }} />{t.label}</span>;
}

// ── Barra de progresso de checklist ───────────────────────────────────────────
export function ChecklistBar({ items }: { items: ChecklistItem[] }) {
  if (!items.length) return null;
  const { feitos, total, pct } = progressoChecklist(items);
  const done = feitos === total;
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-black/[0.06]">
        <div className={`h-full rounded-full ${done ? 'bg-emerald-500' : 'bg-amber-500'}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-[0.68rem] font-semibold ${done ? 'text-emerald-600' : 'text-ink-muted'}`}>{feitos}/{total}</span>
    </div>
  );
}

// ── Editor de checklist (itens marcáveis OU template só-texto) ────────────────
export function ChecklistEditor({ items, onChange, withCheck = true }: { items: ChecklistItem[]; onChange: (next: ChecklistItem[]) => void; withCheck?: boolean }) {
  const [novo, setNovo] = useState('');
  function add() {
    const t = novo.trim();
    if (!t) return;
    onChange([...items, { item: t, ok: false }]);
    setNovo('');
  }
  return (
    <div className="space-y-2">
      {items.length > 0 && (
        <div className="space-y-1.5">
          {items.map((it, i) => (
            <div key={i} className="flex items-center gap-2 rounded-lg border border-black/[0.06] px-2.5 py-1.5">
              {withCheck && (
                <input type="checkbox" checked={!!it.ok} onChange={(e) => onChange(items.map((x, j) => j === i ? { ...x, ok: e.target.checked } : x))}
                  className="h-4 w-4 shrink-0 rounded border-black/20 text-emerald-600 focus:ring-emerald-400/30" />
              )}
              <span className={`min-w-0 flex-1 truncate text-sm ${withCheck && it.ok ? 'text-ink-muted line-through' : 'text-ink-soft'}`}>{it.item}</span>
              <button type="button" onClick={() => onChange(items.filter((_, j) => j !== i))} aria-label="Remover item" className="shrink-0 text-ink-muted hover:text-red-600"><IcoTrash /></button>
            </div>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <input value={novo} onChange={(e) => setNovo(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
          placeholder="Adicionar item (ex.: Verificar nível de óleo)" className="flex-1 rounded-xl border border-black/10 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20" />
        <button type="button" onClick={add} className="rounded-xl border border-black/10 px-3 py-2 text-sm font-semibold text-ink-soft hover:border-brand/30 hover:text-brand">Adicionar</button>
      </div>
    </div>
  );
}

// ── Mini gráfico de barras (SVG puro) — custo por mês ─────────────────────────
export function Bars({ data, fmt }: { data: { label: string; value: number }[]; fmt: (v: number) => string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="flex items-end gap-2" style={{ height: 160 }}>
      {data.map((d, i) => {
        const h = Math.round((d.value / max) * 130);
        return (
          <div key={i} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1">
            <span className="text-[0.6rem] font-semibold text-ink-soft">{d.value > 0 ? fmt(d.value) : ''}</span>
            <div className="w-full rounded-t-md bg-brand/80" style={{ height: Math.max(2, h) }} title={`${d.label}: ${fmt(d.value)}`} />
            <span className="truncate text-[0.62rem] text-ink-muted">{d.label}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── Ícones (SVG inline, stroke) ───────────────────────────────────────────────
const svg = (path: ReactNode, size = 15, sw = 1.9) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">{path}</svg>
);
export const IcoWrench = ({ size = 15 }: { size?: number }) => svg(<path d="M14.7 6.3a4 4 0 0 0-5.4 5.2L3 17.8 6.2 21l6.3-6.3a4 4 0 0 0 5.2-5.4l-2.5 2.5-2.3-2.3 2.5-2.5Z" />, size);
export const IcoPlus = () => svg(<path d="M12 5v14M5 12h14" />, 15, 2.3);
export const IcoEdit = () => svg(<><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4Z" /></>, 13);
export const IcoTrash = () => svg(<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />, 13);
export const IcoDownload = () => svg(<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />, 14);
export const IcoSearch = () => svg(<path d="M21 21l-4.3-4.3M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16Z" />, 14);
export const IcoClock = () => svg(<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>, 15);
export const IcoAlert = () => svg(<path d="M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />, 15);
export const IcoCheck = () => svg(<path d="M20 6 9 17l-5-5" />, 15, 2.3);
export const IcoCalendar = () => svg(<path d="M3 9h18M7 3v4M17 3v4M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" />, 15);
export const IcoBoard = () => svg(<path d="M4 4h6v16H4zM14 4h6v10h-6z" />, 15);
export const IcoList = () => svg(<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />, 15);
export const IcoBox = () => svg(<path d="M21 16V8l-9-5-9 5v8l9 5 9-5ZM3.3 7 12 12l8.7-5M12 22V12" />, 15);
export const IcoBuilding = () => svg(<path d="M3 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16M15 21V9h4a2 2 0 0 1 2 2v10M7 7h2M7 11h2M7 15h2" />, 15);
export const IcoWallet = () => svg(<path d="M3 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2H3Zm0 0v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2H5M16 13h.01" />, 15);
export const IcoGauge = () => svg(<path d="M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm0 0 4-4M5.5 18a9 9 0 1 1 13 0" />, 15);
export const IcoRepeat = () => svg(<path d="M17 1l4 4-4 4M3 11V9a4 4 0 0 1 4-4h14M7 23l-4-4 4-4m14-2v2a4 4 0 0 1-4 4H3" />, 13);
export const IcoPaperclip = () => svg(<path d="M21.44 11.05 12 20.5a5.5 5.5 0 0 1-7.78-7.78l8.49-8.49a3.5 3.5 0 1 1 4.95 4.95l-8.49 8.49a1.5 1.5 0 0 1-2.12-2.12l7.78-7.78" />, 14);
export const IcoSpark = () => svg(<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3Z" />, 15);
export const IcoFlag = () => svg(<path d="M4 22V4m0 0 7 2 9-2v11l-9 2-7-2" />, 14);
