'use client';

// Blocos de UI compartilhados pelas abas de Configurações. Espelham o design
// system (cards bg-white shadow-card, input padrão, botão brand).

import type { ReactNode } from 'react';

export const inp =
  'w-full rounded-xl border border-black/10 px-3.5 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20';

export function Campo({
  label, children, full, hint,
}: { label: string; children: ReactNode; full?: boolean; hint?: string }) {
  return (
    <label className={`block ${full ? 'sm:col-span-2' : ''}`}>
      <span className="mb-1.5 block text-sm font-semibold text-ink-soft">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-ink-muted">{hint}</span>}
    </label>
  );
}

export function Section({
  title, desc, children, action,
}: { title: string; desc?: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="rounded-2xl bg-white p-6 shadow-card">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-ink">{title}</h2>
          {desc && <p className="mt-1 text-sm text-ink-muted">{desc}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function SaveBar({
  saving, onSave, label = 'Salvar alterações', extra,
}: { saving: boolean; onSave: () => void; label?: string; extra?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-3 pt-1">
      <button
        onClick={onSave}
        disabled={saving}
        className="rounded-xl bg-brand px-6 py-2.5 text-sm font-bold text-white transition hover:bg-brand-600 disabled:opacity-60"
      >
        {saving ? 'Salvando…' : label}
      </button>
      {extra}
    </div>
  );
}

export function Toggle({
  checked, onChange, label, desc,
}: { checked: boolean; onChange: (v: boolean) => void; label: string; desc?: string }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-black/10 px-4 py-3">
      <span>
        <span className="block text-sm font-medium text-ink-soft">{label}</span>
        {desc && <span className="mt-0.5 block text-xs text-ink-muted">{desc}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 flex-shrink-0 rounded-full transition-colors ${checked ? 'bg-brand' : 'bg-black/15'}`}
      >
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${checked ? 'left-[22px]' : 'left-0.5'}`} />
      </button>
    </label>
  );
}

export function ColorField({
  label, value, onChange,
}: { label: string; value: string; onChange: (v: string) => void }) {
  const safe = /^#[0-9a-fA-F]{6}$/.test(value) ? value : '#000000';
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-ink-soft">{label}</span>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={safe}
          onChange={(e) => onChange(e.target.value)}
          aria-label={label}
          className="h-10 w-12 flex-shrink-0 cursor-pointer rounded-lg border border-black/10 bg-white p-1"
        />
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={inp}
          placeholder="#ff385c"
        />
      </div>
    </label>
  );
}
