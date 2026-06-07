'use client';

// Editor de FAQ — grava no campo Json `propriedades.faq` (array {pergunta,resposta}).
// A vitrine pública já renderiza esse FAQ.

export type FaqItem = { pergunta: string; resposta: string };

const inp = 'w-full rounded-xl border border-black/10 px-3.5 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20';

export default function FaqEditor({ items, onChange }: { items: FaqItem[]; onChange: (items: FaqItem[]) => void }) {
  const set = (i: number, patch: Partial<FaqItem>) => onChange(items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  const add = () => onChange([...items, { pergunta: '', resposta: '' }]);
  const remove = (i: number) => onChange(items.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-muted">Responda dúvidas frequentes (horário limite de som, estacionamento, política de cancelamento…). Aparecem no anúncio.</p>

      {items.length === 0 && (
        <div className="rounded-xl border border-dashed border-black/15 px-4 py-6 text-center text-sm text-ink-muted">
          Nenhuma pergunta ainda.
        </div>
      )}

      {items.map((it, i) => (
        <div key={i} className="rounded-xl border border-black/[0.08] p-3">
          <div className="flex items-start gap-2">
            <div className="flex-1 space-y-2">
              <input className={inp} value={it.pergunta} onChange={(e) => set(i, { pergunta: e.target.value })} placeholder="Pergunta (ex: Qual o horário limite para som alto?)" />
              <textarea className={`${inp} min-h-[72px]`} value={it.resposta} onChange={(e) => set(i, { resposta: e.target.value })} placeholder="Resposta…" />
            </div>
            <button type="button" onClick={() => remove(i)} aria-label="Remover" className="mt-1 rounded-lg px-2 py-1 text-ink-muted transition hover:bg-red-50 hover:text-red-600">
              ✕
            </button>
          </div>
        </div>
      ))}

      <button type="button" onClick={add} className="rounded-xl border border-brand/30 bg-brand-50 px-4 py-2.5 text-sm font-semibold text-brand transition hover:bg-brand-100">
        + Adicionar pergunta
      </button>
    </div>
  );
}
