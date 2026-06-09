'use client';

// Átomos de UI compartilhados pelas abas de Automações & Notificações.
// Mantém o look do painel (tokens de marca, shadow-card/pop, raios) e evita
// duplicar Kpi/Modal/Campo/ícones entre as seções. Espelha licencas/_components/ui.

import { useEffect, type ReactNode } from 'react';
import type { Urgencia } from '@/lib/automacoes';

export const inp = 'w-full rounded-xl border border-black/10 bg-white px-3.5 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20';
export const sel = 'w-full rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20';

export const btnPrimary = 'inline-flex items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50';
export const btnSecondary = 'inline-flex items-center justify-center gap-2 rounded-xl border border-black/10 bg-white px-4 py-2.5 text-sm font-medium hover:bg-black/[0.03] disabled:opacity-50';
export const btnGhost = 'inline-flex items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-ink-muted hover:bg-black/[0.04] hover:text-ink-soft disabled:opacity-50';

// ── KPI card ──────────────────────────────────────────────────────────────────
export type Tone = 'ink' | 'brand' | 'verde' | 'vermelho' | 'gold' | 'azul' | 'sky';
const TONE_TEXT: Record<Tone, string> = {
  ink: 'text-ink', brand: 'text-brand', verde: 'text-emerald-600', vermelho: 'text-red-600',
  gold: 'text-amber-600', azul: 'text-blue-600', sky: 'text-sky-600',
};
const TONE_BG: Record<Tone, string> = {
  ink: 'bg-black/[0.04] text-ink-soft', brand: 'bg-brand-50 text-brand', verde: 'bg-emerald-50 text-emerald-600',
  vermelho: 'bg-red-50 text-red-600', gold: 'bg-amber-50 text-amber-600', azul: 'bg-blue-50 text-blue-600', sky: 'bg-sky-50 text-sky-600',
};
export function Kpi({ label, value, tone = 'ink', icon, sub }: { label: string; value: string; tone?: Tone; icon?: ReactNode; sub?: ReactNode }) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-card">
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs text-ink-muted">{label}</span>
        {icon && <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${TONE_BG[tone]}`}>{icon}</span>}
      </div>
      <div className={`mt-2 text-xl font-bold ${TONE_TEXT[tone]}`}>{value}</div>
      {sub != null && <div className="mt-0.5 text-[0.7rem] text-ink-muted">{sub}</div>}
    </div>
  );
}

// ── Urgência (ponto + chip) ───────────────────────────────────────────────────
const URG: Record<Urgencia, { dot: string; chip: string; label: string }> = {
  info: { dot: 'bg-sky-500', chip: 'bg-sky-50 text-sky-700', label: 'Info' },
  sucesso: { dot: 'bg-emerald-500', chip: 'bg-emerald-50 text-emerald-700', label: 'Positivo' },
  alerta: { dot: 'bg-amber-500', chip: 'bg-amber-50 text-amber-700', label: 'Atenção' },
  critico: { dot: 'bg-red-500', chip: 'bg-red-50 text-red-700', label: 'Crítico' },
};
export function UrgDot({ u }: { u: Urgencia }) { return <span className={`h-2 w-2 shrink-0 rounded-full ${URG[u].dot}`} />; }
export function UrgChip({ u, children }: { u: Urgencia; children?: ReactNode }) {
  return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.7rem] font-semibold ${URG[u].chip}`}>{children ?? URG[u].label}</span>;
}

// ── Chip genérico ─────────────────────────────────────────────────────────────
export function Chip({ className = '', children }: { className?: string; children: ReactNode }) {
  return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.7rem] font-semibold ${className}`}>{children}</span>;
}

// ── Toggle (switch) ───────────────────────────────────────────────────────────
export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${checked ? 'bg-brand' : 'bg-black/15'}`}>
      <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : 'translate-x-0.5'}`} />
    </button>
  );
}

// ── Modal shell (Esc + clique no backdrop fecham) ─────────────────────────────
export function ModalShell({ onClose, children, maxW = 'max-w-lg' }: { onClose: () => void; children: ReactNode; maxW?: string }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[10000] flex items-start justify-center overflow-y-auto bg-black/50 p-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`relative my-8 w-full ${maxW} rounded-2xl bg-white p-6 shadow-pop`}>
        <button onClick={onClose} aria-label="Fechar" className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full border border-black/10 text-ink-muted hover:bg-black/[0.03]"><IcoX /></button>
        {children}
      </div>
    </div>
  );
}

// ── Campo (label + filho) ─────────────────────────────────────────────────────
export function Campo({ label, children, full, hint }: { label: string; children: ReactNode; full?: boolean; hint?: string }) {
  return (
    <label className={`block ${full ? 'sm:col-span-2' : ''}`}>
      <span className="mb-1.5 block text-sm font-semibold text-ink-soft">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[0.7rem] text-ink-muted">{hint}</span>}
    </label>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────
export function EmptyState({ icon, title, children, cta }: { icon: ReactNode; title: string; children?: ReactNode; cta?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-black/10 bg-white p-10 text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand">{icon}</div>
      <h3 className="text-base font-bold text-ink">{title}</h3>
      {children && <div className="mx-auto mt-1 max-w-md text-sm text-ink-muted">{children}</div>}
      {cta && <div className="mt-5">{cta}</div>}
    </div>
  );
}

// ── Ícones (SVG inline, stroke) ───────────────────────────────────────────────
const svg = (path: ReactNode, size = 15, sw = 2) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">{path}</svg>
);
export const IcoBolt = ({ size = 15 }: { size?: number }) => svg(<path d="M13 2 3 14h7l-1 8 10-12h-7l1-8Z" />, size);
export const IcoBell = ({ size = 15 }: { size?: number }) => svg(<path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0" />, size);
export const IcoPlus = ({ size = 15 }: { size?: number }) => svg(<path d="M12 5v14M5 12h14" />, size, 2.4);
export const IcoEdit = () => svg(<><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4Z" /></>, 13);
export const IcoTrash = () => svg(<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />, 13);
export const IcoPlay = ({ size = 14 }: { size?: number }) => svg(<path d="M6 4l14 8-14 8V4Z" />, size);
export const IcoX = () => svg(<path d="M18 6 6 18M6 6l12 12" />, 15, 2.2);
export const IcoCheck = ({ size = 15 }: { size?: number }) => svg(<path d="M20 6 9 17l-5-5" />, size, 2.4);
export const IcoSearch = () => svg(<><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></>, 14);
export const IcoClock = ({ size = 14 }: { size?: number }) => svg(<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>, size);
export const IcoCalendar = ({ size = 14 }: { size?: number }) => svg(<path d="M3 9h18M7 3v4M17 3v4M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" />, size);
export const IcoCard = ({ size = 14 }: { size?: number }) => svg(<path d="M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Zm0 4h18" />, size);
export const IcoSignature = ({ size = 14 }: { size?: number }) => svg(<><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9l-6-6Z" /><path d="M14 3v6h6M8 16.5c1-1.5 2-1.5 3 0s2 1.5 3 0" /></>, size);
export const IcoGift = ({ size = 14 }: { size?: number }) => svg(<path d="M20 12v9H4v-9M2 7h20v5H2zM12 22V7M12 7S8 7 8 4.5 12 7 12 7Zm0 0s4 0 4-2.5S12 7 12 7Z" />, size);
export const IcoShield = ({ size = 14 }: { size?: number }) => svg(<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3ZM9.5 12l2 2 3.5-4" />, size);
export const IcoChat = ({ size = 14 }: { size?: number }) => svg(<path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.5 8.5 0 0 1-3.8-.9L3 21l1.9-5.7A8.38 8.38 0 0 1 4 11.5 8.5 8.5 0 0 1 12.5 3 8.38 8.38 0 0 1 21 11.5Z" />, size);
export const IcoMail = ({ size = 14 }: { size?: number }) => svg(<><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></>, size);
export const IcoWhats = ({ size = 14 }: { size?: number }) => svg(<path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.5 8.5 0 0 1-3.8-.9L3 21l1.9-5.7A8.38 8.38 0 0 1 4 11.5 8.5 8.5 0 0 1 12.5 3 8.38 8.38 0 0 1 21 11.5Z" />, size);
export const IcoTask = ({ size = 14 }: { size?: number }) => svg(<><rect x="3" y="3" width="18" height="18" rx="2" /><path d="m8 12 2.5 2.5L16 9" /></>, size);
export const IcoFunnel = ({ size = 14 }: { size?: number }) => svg(<path d="M3 5h18l-7 8v6l-4-2v-4L3 5Z" />, size);
export const IcoSparkle = ({ size = 14 }: { size?: number }) => svg(<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3Z" />, size);
export const IcoExternal = ({ size = 13 }: { size?: number }) => svg(<path d="M15 3h6v6M21 3l-9 9M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5" />, size);
export const IcoUser = ({ size = 14 }: { size?: number }) => svg(<><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>, size);
export const IcoList = ({ size = 14 }: { size?: number }) => svg(<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />, size);
export const IcoHistory = ({ size = 14 }: { size?: number }) => svg(<><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5M12 7v5l3 2" /></>, size);

// Ícone por gatilho (para os cards de regra/receita).
import type { Gatilho } from '@/lib/automacoes';
export function GatilhoIcon({ g, size = 14 }: { g: Gatilho; size?: number }) {
  switch (g) {
    case 'parcela_vence':
    case 'parcela_atrasa': return <IcoCard size={size} />;
    case 'contrato_nao_assinado': return <IcoSignature size={size} />;
    case 'aniversario_cliente': return <IcoGift size={size} />;
    case 'licenca_a_vencer': return <IcoShield size={size} />;
    case 'feedback_negativo': return <IcoChat size={size} />;
    default: return <IcoCalendar size={size} />;
  }
}
// Ícone por ação.
import type { Acao } from '@/lib/automacoes';
export function AcaoIcon({ a, size = 14 }: { a: Acao; size?: number }) {
  switch (a) {
    case 'enviar_email': return <IcoMail size={size} />;
    case 'enviar_whatsapp': return <IcoWhats size={size} />;
    case 'criar_tarefa': return <IcoTask size={size} />;
    case 'mover_funil': return <IcoFunnel size={size} />;
    default: return <IcoBell size={size} />;
  }
}
