'use client';

// Átomos de UI compartilhados pelo hub de RH (KPIs, modal, estados, chips,
// ícones e gate premium). Mantêm o look do painel (tokens de marca, shadow-card/
// pop, raios) e evitam duplicar entre as sub-rotas.

import Link from 'next/link';
import { useEffect, type ReactNode } from 'react';

// ── KPI ───────────────────────────────────────────────────────────────────────
export type Tone = 'verde' | 'vermelho' | 'gold' | 'azul' | 'roxo' | 'sky' | 'cinza';
const TONE_TEXT: Record<Tone, string> = {
  verde: 'text-emerald-600', vermelho: 'text-red-600', gold: 'text-amber-600',
  azul: 'text-blue-600', roxo: 'text-violet-600', sky: 'text-sky-600', cinza: 'text-ink',
};
const TONE_BG: Record<Tone, string> = {
  verde: 'bg-emerald-50 text-emerald-600', vermelho: 'bg-red-50 text-red-600', gold: 'bg-amber-50 text-amber-600',
  azul: 'bg-blue-50 text-blue-600', roxo: 'bg-violet-50 text-violet-600', sky: 'bg-sky-50 text-sky-600', cinza: 'bg-black/[0.04] text-ink-soft',
};
export function Kpi({ label, value, tone = 'cinza', icon, hint }: { label: string; value: string; tone?: Tone; icon?: ReactNode; hint?: string }) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-card">
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs text-ink-muted">{label}</span>
        {icon && <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${TONE_BG[tone]}`}>{icon}</span>}
      </div>
      <div className={`mt-2 text-xl font-bold ${TONE_TEXT[tone]}`}>{value}</div>
      {hint && <div className="mt-0.5 text-[0.7rem] text-ink-muted">{hint}</div>}
    </div>
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl bg-white p-5 shadow-card ${className}`}>{children}</div>;
}

export function Chip({ children, cls }: { children: ReactNode; cls: string }) {
  return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${cls}`}>{children}</span>;
}

// ── Modal (Esc + clique no backdrop fecham) ───────────────────────────────────
export function ModalShell({ onClose, children, maxW = 'max-w-lg', title }: { onClose: () => void; children: ReactNode; maxW?: string; title?: string }) {
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
        {title && <h3 className="mb-5 font-display text-xl font-bold text-ink">{title}</h3>}
        {children}
      </div>
    </div>
  );
}

export function Campo({ label, children, full, hint }: { label: string; children: ReactNode; full?: boolean; hint?: string }) {
  return (
    <label className={`block ${full ? 'sm:col-span-2' : ''}`}>
      <span className="mb-1.5 block text-sm font-semibold text-ink-soft">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[0.7rem] text-ink-muted">{hint}</span>}
    </label>
  );
}

// ── Botões padrão ─────────────────────────────────────────────────────────────
export const btnPrimary = 'inline-flex items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:opacity-50';
export const btnSecondary = 'inline-flex items-center justify-center gap-2 rounded-xl border border-black/10 bg-white px-4 py-2.5 text-sm font-medium transition hover:bg-black/[0.03] disabled:opacity-50';

// ── Estados ───────────────────────────────────────────────────────────────────
export function EmptyState({ icon, title, children, action }: { icon?: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-black/[0.06] bg-white p-10 text-center shadow-card">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand">{icon ?? <IcoUsers />}</div>
      <h3 className="text-base font-bold text-ink">{title}</h3>
      {children && <div className="mx-auto mt-1 max-w-md text-sm text-ink-muted">{children}</div>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

/** Aviso de migração ainda não aplicada (docs/sql/rh.sql). */
export function SetupNotice() {
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700"><IcoDb /></span>
        <div className="text-sm text-amber-900">
          <p className="font-semibold">Ative o módulo RH</p>
          <p className="mt-1 text-amber-800">
            Rode <code className="rounded bg-amber-100 px-1 py-0.5 text-xs">docs/sql/rh.sql</code> no Supabase (SQL Editor) para estender a tabela <code className="rounded bg-amber-100 px-1 py-0.5 text-xs">equipe</code> (ficha completa) e criar <code className="rounded bg-amber-100 px-1 py-0.5 text-xs">rh_vagas</code>, <code className="rounded bg-amber-100 px-1 py-0.5 text-xs">rh_candidatos</code>, <code className="rounded bg-amber-100 px-1 py-0.5 text-xs">rh_documentos</code>, <code className="rounded bg-amber-100 px-1 py-0.5 text-xs">rh_ausencias</code> e a timeline. Depois recarregue. Enquanto isso, a folha continua em <Link href="/painel/equipe" className="font-semibold underline">/painel/equipe</Link>.
          </p>
        </div>
      </div>
    </div>
  );
}

/** Overlay premium (Pro+): borra o conteúdo e mostra CTA para /painel/planos. */
export function PremiumOverlay() {
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center rounded-2xl bg-white/70 backdrop-blur-sm">
      <div className="mx-4 max-w-sm rounded-2xl border border-black/[0.06] bg-white p-6 text-center shadow-pop">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-brand text-white"><IcoLock /></div>
        <h3 className="font-display text-lg font-bold text-ink">Recurso Pro+</h3>
        <p className="mt-1 text-sm text-ink-muted">O RH completo (funcionários, recrutamento, admissão, férias, ponto, documentos e desligamento) faz parte dos planos Pro e Ultra.</p>
        <Link href="/painel/planos" className="mt-4 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-brand px-5 py-2.5 text-sm font-bold text-white hover:opacity-90">Conhecer planos</Link>
      </div>
    </div>
  );
}

// ── Ícones (SVG inline, stroke) ───────────────────────────────────────────────
const svg = (path: ReactNode, size = 16, sw = 1.8) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">{path}</svg>
);
export const IcoHome = () => svg(<path d="M3 9.5 12 3l9 6.5V21a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z" />);
export const IcoUsers = () => svg(<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm13 10v-2a4 4 0 0 0-3-3.87M16 3.13A4 4 0 0 1 16 11" />);
export const IcoBriefcase = () => svg(<path d="M3 7h18a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1Zm5 0V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M2 13h20" />);
export const IcoUserPlus = () => svg(<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM19 8v6M22 11h-6" />);
export const IcoUserX = () => svg(<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm9-3 4 4m0-4-4 4" />);
export const IcoPalm = () => svg(<path d="M12 22V8m0 0c0-2 1.5-4 4-4M12 8c0-2-1.5-4-4-4M12 8c2-1 5-1 7 1M12 8c-2-1-5-1-7 1M12 8c1-2 3-3 5-3" />);
export const IcoClock = () => svg(<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>);
export const IcoFolder = () => svg(<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />);
export const IcoDoc = () => svg(<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Zm0 0v6h6M8 13h8M8 17h6" />);
export const IcoPlus = () => svg(<path d="M12 5v14M5 12h14" />, 16, 2.2);
export const IcoEdit = () => svg(<><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4Z" /></>, 14);
export const IcoTrash = () => svg(<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />, 14);
export const IcoSearch = () => svg(<path d="M21 21l-4.3-4.3M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16Z" />, 14);
export const IcoDownload = () => svg(<path d="M12 3v12m0 0 4-4m-4 4-4-4M4 19h16" />, 14);
export const IcoCheck = () => svg(<path d="M20 6 9 17l-5-5" />, 15, 2.2);
export const IcoX = () => svg(<path d="M18 6 6 18M6 6l12 12" />, 14, 2.2);
export const IcoAlert = () => svg(<path d="M12 9v4M12 17h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />);
export const IcoCake = () => svg(<path d="M4 21h16M5 21v-7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v7M3 13c1.5 1.5 3 1.5 4.5 0S10.5 11.5 12 13s3 1.5 4.5 0S19.5 11.5 21 13M12 8V5m0 0a1 1 0 1 0-2 0 1 1 0 0 0 2 0Z" />);
export const IcoChart = () => svg(<path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />);
export const IcoChevron = () => svg(<path d="m9 18 6-6-6-6" />, 16, 2);
export const IcoDb = () => svg(<><ellipse cx="12" cy="5" rx="9" ry="3" /><path d="M3 5v14a9 3 0 0 0 18 0V5M3 12a9 3 0 0 0 18 0" /></>);
export const IcoLock = () => svg(<><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></>, 22);
export const IcoLink = () => svg(<path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" />, 14);
export const IcoSparkles = () => svg(<path d="M12 3l1.8 4.2L18 9l-4.2 1.8L12 15l-1.8-4.2L6 9l4.2-1.8L12 3ZM19 14l.9 2.1L22 17l-2.1.9L19 20l-.9-2.1L16 17l2.1-.9L19 14Z" />, 14);
export const IcoStar = () => svg(<path d="m12 3 2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 18.8 6.2 21.8l1.1-6.5L2.6 9.7l6.5-.9L12 3Z" />, 14);
