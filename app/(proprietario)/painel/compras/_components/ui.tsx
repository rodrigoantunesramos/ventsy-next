'use client';

// UI compartilhada do módulo Compras — KPIs, modal, donut (SVG puro), stepper do
// rastro (requisição → cotação → pedido → recebimento → pagamento), chip de
// status e ícones. Mesma linguagem visual do resto do painel (tokens de marca).

import { useEffect, type ReactNode } from 'react';

// ── KPI ───────────────────────────────────────────────────────────────────────
export type Tone = 'ink' | 'brand' | 'azul' | 'gold' | 'verde' | 'vermelho' | 'roxo';
const TONE_TEXT: Record<Tone, string> = {
  ink: 'text-ink', brand: 'text-brand', azul: 'text-blue-600', gold: 'text-amber-600',
  verde: 'text-emerald-600', vermelho: 'text-red-600', roxo: 'text-violet-600',
};
const TONE_ICON: Record<Tone, string> = {
  ink: 'bg-black/[0.05] text-ink-soft', brand: 'bg-brand-50 text-brand', azul: 'bg-blue-50 text-blue-600',
  gold: 'bg-amber-50 text-amber-600', verde: 'bg-emerald-50 text-emerald-600', vermelho: 'bg-red-50 text-red-600',
  roxo: 'bg-violet-50 text-violet-600',
};
export function Kpi({ label, value, sub, tone = 'ink', icon }: { label: string; value: string; sub?: string; tone?: Tone; icon?: ReactNode }) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-card">
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs text-ink-muted">{label}</span>
        {icon && <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${TONE_ICON[tone]}`}>{icon}</span>}
      </div>
      <div className={`mt-2 text-xl font-bold ${TONE_TEXT[tone]}`}>{value}</div>
      {sub && <div className="mt-0.5 text-[0.68rem] text-ink-muted">{sub}</div>}
    </div>
  );
}

// ── Modal ─────────────────────────────────────────────────────────────────────
export function ModalShell({ children, onClose, maxW = 'max-w-lg' }: { children: ReactNode; onClose: () => void; maxW?: string }) {
  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onEsc);
    return () => document.removeEventListener('keydown', onEsc);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[10000] flex items-start justify-center overflow-y-auto bg-black/50 p-4" onClick={onClose}>
      <div className={`relative my-8 w-full ${maxW} rounded-2xl bg-white p-6 shadow-pop`} onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} aria-label="Fechar" className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full border border-black/10 text-ink-muted hover:bg-black/[0.03]">✕</button>
        {children}
      </div>
    </div>
  );
}

export function Campo({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-ink-soft">{label}{hint && <span className="font-normal text-ink-muted"> {hint}</span>}</span>
      {children}
    </label>
  );
}

// ── Chip de status (genérico) ──────────────────────────────────────────────────
export function Chip({ meta }: { meta: { label: string; cls: string } }) {
  return <span className={`inline-block w-fit rounded-full px-2 py-0.5 text-xs font-semibold ${meta.cls}`}>{meta.label}</span>;
}

// ── Stepper do rastro (requisição → cotação → pedido → recebimento → pago) ─────
export type StepKey = 'requisicao' | 'cotacao' | 'pedido' | 'recebimento' | 'pagamento';
export const STEP_LABELS: Record<StepKey, string> = {
  requisicao: 'Requisição', cotacao: 'Cotação', pedido: 'Pedido', recebimento: 'Recebimento', pagamento: 'Financeiro',
};
const STEP_ORDER: StepKey[] = ['requisicao', 'cotacao', 'pedido', 'recebimento', 'pagamento'];

export function Stepper({ done }: { done: Record<StepKey, boolean> }) {
  return (
    <div className="flex items-center gap-1">
      {STEP_ORDER.map((k, i) => {
        const on = done[k];
        return (
          <div key={k} className="flex items-center gap-1">
            <span title={STEP_LABELS[k]} className={`flex h-6 w-6 items-center justify-center rounded-full text-[0.6rem] font-bold ${on ? 'bg-emerald-500 text-white' : 'bg-black/[0.06] text-ink-muted'}`}>
              {on ? '✓' : i + 1}
            </span>
            {i < STEP_ORDER.length - 1 && <span className={`h-[2px] w-4 ${done[STEP_ORDER[i + 1]] ? 'bg-emerald-400' : 'bg-black/[0.08]'}`} />}
          </div>
        );
      })}
    </div>
  );
}

// ── Donut (SVG puro) ────────────────────────────────────────────────────────────
export function Donut({ data, money }: { data: { label: string; value: number; cor: string }[]; money?: (n: number) => string }) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const top = data.filter((d) => d.value > 0).slice(0, 9);
  const r = 52, sw = 16, C = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="flex items-center gap-4">
      <svg width="128" height="128" viewBox="0 0 128 128" className="shrink-0 -rotate-90">
        <circle cx="64" cy="64" r={r} fill="none" stroke="#f1f5f9" strokeWidth={sw} />
        {top.map((d, i) => {
          const len = (d.value / total) * C;
          const el = <circle key={i} cx="64" cy="64" r={r} fill="none" stroke={d.cor} strokeWidth={sw} strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-offset} />;
          offset += len;
          return el;
        })}
      </svg>
      <div className="min-w-0 flex-1 space-y-1.5">
        {top.length === 0 && <p className="text-sm text-ink-muted">Sem dados ainda.</p>}
        {top.map((d, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: d.cor }} />
            <span className="min-w-0 flex-1 truncate text-ink-soft">{d.label}</span>
            <span className="shrink-0 font-semibold text-ink-muted">{money ? money(d.value) : d.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Empty state genérico ────────────────────────────────────────────────────────
export function Empty({ icon, title, children, action }: { icon: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-2xl bg-white p-10 text-center shadow-card">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-50 text-brand">{icon}</div>
      <h2 className="text-lg font-bold text-ink">{title}</h2>
      {children && <p className="mx-auto mt-1 max-w-md text-sm text-ink-muted">{children}</p>}
      {action && <div className="mt-6 flex flex-wrap items-center justify-center gap-2">{action}</div>}
    </div>
  );
}

// ── Ícones (SVG inline, stroke) ────────────────────────────────────────────────
const svg = (path: ReactNode, size = 15, sw = 1.8) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">{path}</svg>
);
export const IcoCart = ({ size = 15 }: { size?: number }) => svg(<path d="M3 3h2l2.4 12.3a1 1 0 0 0 1 .7h8.7a1 1 0 0 0 1-.8L21 7H6M10 21a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm8 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" />, size);
export const IcoDoc = ({ size = 15 }: { size?: number }) => svg(<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Zm0 0v6h6M8 13h8M8 17h6" />, size);
export const IcoCompare = ({ size = 15 }: { size?: number }) => svg(<path d="M3 6h7M3 12h7M3 18h7M21 6h-7M21 12h-7M21 18h-7M7 4v4M17 16v4" />, size);
export const IcoTruck = ({ size = 15 }: { size?: number }) => svg(<path d="M1 3h15v13H1zM16 8h4l3 3v5h-7M5.5 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm12 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" />, size);
export const IcoInbox = ({ size = 15 }: { size?: number }) => svg(<path d="M3 12h5l2 3h4l2-3h5M5 5h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" />, size);
export const IcoWallet = () => svg(<path d="M3 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2H3Zm0 0v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2H5M16 13h.01" />, 15);
export const IcoClock = () => svg(<path d="M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />, 15);
export const IcoCheck = () => svg(<path d="M20 6 9 17l-5-5" />, 15);
export const IcoAlert = () => svg(<path d="M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />, 15);
export const IcoTag = () => svg(<path d="M20.6 13.4 12 22l-9-9V3h10l7.6 7.6a2 2 0 0 1 0 2.8ZM7.5 7.5h.01" />, 15);
export const IcoCoins = () => svg(<path d="M8 14a6 6 0 1 0 0-12 6 6 0 0 0 0 12Zm8-4a6 6 0 1 1-8 5.7" />, 15);
export const IcoTrend = () => svg(<path d="M3 17l6-6 4 4 8-8M21 7v5M21 7h-5" />, 15);
export const IcoSearch = () => svg(<path d="M21 21l-4.3-4.3M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16Z" />, 14);
export const IcoDownload = () => svg(<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />, 13);
export const IcoEdit = () => svg(<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />, 14);
export const IcoTrash = () => svg(<path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />, 14);
export const IcoPlus = ({ size = 14 }: { size?: number }) => svg(<path d="M12 5v14M5 12h14" />, size);
export const IcoPaperclip = () => svg(<path d="M21 11.5 12.5 20a5 5 0 0 1-7-7l8.5-8.5a3.3 3.3 0 0 1 4.7 4.7L10 11.8a1.7 1.7 0 0 1-2.3-2.3l7.8-7.8" />, 13);
export const IcoArrow = () => svg(<path d="M5 12h14M13 6l6 6-6 6" />, 14);
export const IcoBox = ({ size = 15 }: { size?: number }) => svg(<path d="M21 8 12 3 3 8m18 0-9 5m9-5v8l-9 5m0-8L3 8m9 5v8M3 8v8l9 5" />, size);
