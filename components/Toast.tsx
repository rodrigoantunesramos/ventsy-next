'use client';

// Sistema de toast reutilizável do painel. Montado uma vez em
// app/(proprietario)/painel/layout.tsx; qualquer página do painel chama
// useToast() para feedback (success / error / info). Sem dependências externas.

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

type ToastKind = 'success' | 'error' | 'info';
type ToastItem = { id: number; kind: ToastKind; msg: string };

type ToastApi = {
  success: (msg: string) => void;
  error: (msg: string) => void;
  info: (msg: string) => void;
};

const ToastCtx = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error('useToast precisa estar dentro de <ToastProvider>');
  return ctx;
}

let _seq = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const remove = useCallback((id: number) => {
    setItems((list) => list.filter((t) => t.id !== id));
  }, []);

  const push = useCallback((kind: ToastKind, msg: string) => {
    const id = ++_seq;
    setItems((list) => [...list, { id, kind, msg }]);
    setTimeout(() => remove(id), 3600);
  }, [remove]);

  const api = useMemo<ToastApi>(() => ({
    success: (m) => push('success', m),
    error: (m) => push('error', m),
    info: (m) => push('info', m),
  }), [push]);

  return (
    <ToastCtx.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed left-1/2 top-4 z-[10050] flex w-full max-w-sm -translate-x-1/2 flex-col items-center gap-2 px-4">
        {items.map((t) => <ToastCard key={t.id} item={t} onClose={() => remove(t.id)} />)}
      </div>
    </ToastCtx.Provider>
  );
}

const STYLE: Record<ToastKind, { ring: string; iconBg: string; icon: string }> = {
  success: { ring: 'border-emerald-200', iconBg: 'bg-emerald-100 text-emerald-700', icon: '✓' },
  error: { ring: 'border-red-200', iconBg: 'bg-red-100 text-red-700', icon: '✕' },
  info: { ring: 'border-brand/20', iconBg: 'bg-brand-50 text-brand', icon: 'i' },
};

function ToastCard({ item, onClose }: { item: ToastItem; onClose: () => void }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const r = requestAnimationFrame(() => setShow(true));
    return () => cancelAnimationFrame(r);
  }, []);
  const s = STYLE[item.kind];
  return (
    <div
      role="status"
      className={`pointer-events-auto flex w-full items-start gap-3 rounded-xl border bg-white px-4 py-3 shadow-pop transition-all duration-300 ${s.ring} ${show ? 'translate-y-0 opacity-100' : '-translate-y-2 opacity-0'}`}
    >
      <span className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold ${s.iconBg}`}>{s.icon}</span>
      <p className="flex-1 pt-0.5 text-sm font-medium text-ink-soft">{item.msg}</p>
      <button onClick={onClose} aria-label="Fechar" className="flex-shrink-0 text-ink-muted transition hover:text-ink">✕</button>
    </div>
  );
}
