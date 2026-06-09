'use client';

// Primitivos visuais da Central de Integrações (ícones SVG inline, modal, campos,
// chips, caixa de "copiar segredo uma vez"). Sem libs novas — só Tailwind + SVG,
// no padrão do projeto.

import { useEffect, useState, type ReactNode } from 'react';

export const inp =
  'w-full rounded-xl border border-black/10 px-3.5 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20';
export const btnPrimary =
  'inline-flex items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50';
export const btnGhost =
  'inline-flex items-center justify-center gap-2 rounded-xl border border-black/10 bg-white px-4 py-2.5 text-sm font-medium hover:bg-black/[0.03] disabled:opacity-50';

// ── Ícones (stroke; reaproveita a linguagem do layout) ───────────────────────
export const ICONS: Record<string, string> = {
  plug: 'M9 2v6M15 2v6M7 8h10v4a5 5 0 0 1-10 0V8ZM12 17v5',
  wallet: 'M3 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2H3Zm0 0v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2H5M16 13h.01',
  chat: 'M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.5 8.5 0 0 1-3.8-.9L3 21l1.9-5.7A8.38 8.38 0 0 1 4 11.5 8.5 8.5 0 0 1 12.5 3 8.38 8.38 0 0 1 21 11.5Z',
  invoice: 'M14 3H6a2 2 0 0 0-2 2v16l2.5-1.5L9 21l1.5-1.5L12 21l1.5-1.5L15 21l2.5-1.5V9l-3.5-6ZM14 3v6h3.5M8 12h6M8 15.5h4',
  calendar: 'M3 9h18M7 3v4M17 3v4M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z',
  cloud: 'M17.5 19a4.5 4.5 0 0 0 0-9 6 6 0 0 0-11.6 1.5A4 4 0 0 0 6 19h11.5Z',
  signature: 'M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9l-6-6Zm0 0v6h6M8 16.5c1-1.5 2-1.5 3 0s2 1.5 3 0',
  ledger: 'M5 3h14a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1ZM4 8h16M11 8v13',
  bolt: 'M13 2 4.5 13.5H11l-1 8.5 8.5-11.5H12l1-8.5Z',
  webhook: 'M9 7a3 3 0 1 1 4 2.83M7 17a3 3 0 1 0 2.83-4M17 14a3 3 0 1 1-2.83 4M12 9.5 8.5 16M15.5 16H12M9 8.2l2.5 4.3',
  key: 'M14 7a4 4 0 1 0-3.9 5l1.4 1.4 2 .2.2 2 1.5.2.2 1.5 1.6.1.6-3.1-3.9-3.9A4 4 0 0 0 14 7Zm1.5 1.5h.01',
  check: 'M5 13l4 4L19 7',
  x: 'M6 6l12 12M18 6 6 18',
  refresh: 'M21 12a9 9 0 1 1-2.64-6.36M21 4v5h-5',
  trash: 'M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m2 0v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V7',
  copy: 'M9 9h10a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V10a1 1 0 0 1 1-1ZM5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1',
  link: 'M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1',
  warn: 'M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z',
  shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3ZM9.5 12l2 2 3.5-4',
  cog: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm8-3a8 8 0 0 0-.13-1.4l2-1.55-2-3.46-2.36.95a8 8 0 0 0-2.42-1.4L14.7 2h-4l-.39 2.74a8 8 0 0 0-2.42 1.4L5.53 5.2l-2 3.46 2 1.55A8 8 0 0 0 5.4 12a8 8 0 0 0 .13 1.4l-2 1.55 2 3.46 2.36-.95a8 8 0 0 0 2.42 1.4L10.7 22h4l.39-2.74a8 8 0 0 0 2.42-1.4l2.36.95 2-3.46-2-1.55A8 8 0 0 0 20 12Z',
  plus: 'M12 5v14M5 12h14',
  external: 'M14 4h6v6M20 4l-9 9M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5',
};

export function Ico({ name, className = 'h-[18px] w-[18px]' }: { name: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={`shrink-0 ${className}`}>
      <path d={ICONS[name] || ICONS.plug} />
    </svg>
  );
}

export function Chip({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${className}`}>{children}</span>;
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-ink-soft">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[0.72rem] text-ink-muted">{hint}</span>}
    </label>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button type="button" onClick={() => onChange(!checked)} className="inline-flex items-center gap-2" aria-pressed={checked}>
      <span className={`relative h-5 w-9 rounded-full transition ${checked ? 'bg-brand' : 'bg-black/15'}`}>
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${checked ? 'left-[18px]' : 'left-0.5'}`} />
      </span>
      {label && <span className="text-sm text-ink-soft">{label}</span>}
    </button>
  );
}

export function Modal({ title, onClose, children, footer }: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[10000] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white shadow-pop sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 flex items-center justify-between border-b border-black/[0.06] bg-white px-5 py-4">
          <h3 className="text-base font-bold text-ink">{title}</h3>
          <button onClick={onClose} aria-label="Fechar" className="rounded-lg p-1 text-ink-muted hover:bg-black/[0.04] hover:text-ink"><Ico name="x" /></button>
        </div>
        <div className="px-5 py-4">{children}</div>
        {footer && <div className="sticky bottom-0 flex justify-end gap-2 border-t border-black/[0.06] bg-white px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

/** Caixa que revela um segredo UMA vez (token/segredo de webhook) com "copiar". */
export function CopyBox({ valor, label }: { valor: string; label?: string }) {
  const [copiado, setCopiado] = useState(false);
  const copiar = async () => {
    try { await navigator.clipboard.writeText(valor); setCopiado(true); setTimeout(() => setCopiado(false), 1800); } catch { /* clipboard indisponível */ }
  };
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
      {label && <div className="mb-1 text-xs font-semibold text-amber-800">{label}</div>}
      <div className="flex items-center gap-2">
        <code className="flex-1 truncate rounded-lg bg-white/70 px-2.5 py-1.5 text-xs text-ink-soft">{valor}</code>
        <button onClick={copiar} className={btnGhost + ' !px-3 !py-1.5'}><Ico name={copiado ? 'check' : 'copy'} className="h-4 w-4" />{copiado ? 'Copiado' : 'Copiar'}</button>
      </div>
      <div className="mt-1.5 text-[0.72rem] text-amber-700">Guarde agora — por segurança, não será exibido novamente.</div>
    </div>
  );
}

export function EmptyHint({ children }: { children: ReactNode }) {
  return <div className="rounded-2xl border border-dashed border-black/10 bg-white px-5 py-8 text-center text-sm text-ink-muted">{children}</div>;
}
