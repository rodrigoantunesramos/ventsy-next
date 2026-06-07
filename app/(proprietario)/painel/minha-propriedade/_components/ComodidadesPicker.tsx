'use client';

// Seletor rico de comodidades (estilo Airbnb). Trabalha com slugs canônicos
// (lib/data COMODIDADES); a sincronização com as colunas boolean da busca é
// feita no salvamento da página.

import { COMODIDADES, COMODIDADES_GRUPOS } from '@/lib/data';

export default function ComodidadesPicker({ value, onToggle }: { value: Set<string>; onToggle: (slug: string) => void }) {
  return (
    <div className="space-y-5">
      <p className="text-sm text-ink-muted">
        Marque tudo que seu espaço oferece — aparece em “O que o lugar oferece” no anúncio e melhora os filtros de busca.
      </p>
      {COMODIDADES_GRUPOS.map((grupo) => (
        <div key={grupo}>
          <div className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-muted">{grupo}</div>
          <div className="flex flex-wrap gap-2">
            {COMODIDADES.filter((c) => c.grupo === grupo).map((c) => {
              const on = value.has(c.slug);
              return (
                <button
                  key={c.slug}
                  type="button"
                  aria-pressed={on}
                  onClick={() => onToggle(c.slug)}
                  className={`rounded-full border px-3 py-1.5 text-sm transition ${
                    on ? 'border-brand bg-brand-50 font-semibold text-brand' : 'border-black/10 text-ink-soft hover:border-brand/50'
                  }`}
                >
                  {c.emoji} {c.label}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
