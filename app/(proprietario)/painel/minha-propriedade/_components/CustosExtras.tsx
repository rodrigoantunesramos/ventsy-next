'use client';

// Editor de custos/serviços extras — grava no Json `propriedades.custos_extras`
// (array {nome, valor}). `valor` é mantido mascarado no estado e convertido para
// número no salvamento da página (parseMoeda).

import { maskMoeda } from '@/lib/masks';

export type CustoItem = { nome: string; valor: string };

const inp = 'w-full rounded-xl border border-black/10 px-3.5 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20';

export default function CustosExtras({ items, onChange }: { items: CustoItem[]; onChange: (items: CustoItem[]) => void }) {
  const set = (i: number, patch: Partial<CustoItem>) => onChange(items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  const add = () => onChange([...items, { nome: '', valor: '' }]);
  const remove = (i: number) => onChange(items.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-3">
      <p className="text-sm text-ink-muted">Serviços opcionais cobrados à parte (limpeza pós-evento, segurança, hora extra…).</p>

      {items.map((it, i) => (
        <div key={i} className="flex items-center gap-2">
          <input className={inp} value={it.nome} onChange={(e) => set(i, { nome: e.target.value })} placeholder="Serviço (ex: Limpeza pós-evento)" />
          <div className="relative w-44 shrink-0">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-ink-muted">R$</span>
            <input
              className={`${inp} pl-9`}
              inputMode="numeric"
              value={it.valor}
              onChange={(e) => set(i, { valor: maskMoeda(e.target.value) })}
              placeholder="0,00"
            />
          </div>
          <button type="button" onClick={() => remove(i)} aria-label="Remover" className="rounded-lg px-2 py-1 text-ink-muted transition hover:bg-red-50 hover:text-red-600">
            ✕
          </button>
        </div>
      ))}

      <button type="button" onClick={add} className="rounded-xl border border-brand/30 bg-brand-50 px-4 py-2.5 text-sm font-semibold text-brand transition hover:bg-brand-100">
        + Adicionar custo extra
      </button>
    </div>
  );
}
