'use client';

// Pré-visualização fiel de como o card do anúncio aparece na busca pública,
// montada a partir dos valores atuais do formulário. Usa lib/format (i18n-ready).

import { formatMoneyShort } from '@/lib/format';

export type PreviewData = {
  nome: string;
  cidade: string;
  estado: string;
  categoria: string;
  capacidade: string;
  valorBase: number;
  valorHora: number;
  imagem: string | null;
  nota: number | null;
};

export default function PreviewAnuncio({ data }: { data: PreviewData }) {
  const img = data.imagem || `https://picsum.photos/seed/preview/420/320`;
  const preco =
    data.valorHora > 0 ? `${formatMoneyShort(data.valorHora)} / hora` : data.valorBase > 0 ? formatMoneyShort(data.valorBase) : 'Sob consulta';

  return (
    <div className="rounded-2xl bg-white p-4 shadow-card">
      <h3 className="text-sm font-bold text-ink">Prévia do anúncio</h3>
      <p className="mb-3 text-xs text-ink-muted">É assim que seu espaço aparece nos resultados de busca.</p>

      <div className="overflow-hidden rounded-2xl border border-black/[0.08]">
        <div className="relative h-40 w-full overflow-hidden bg-black/[0.04]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={img} alt={data.nome || 'Prévia'} className="h-full w-full object-cover" />
          {data.categoria && (
            <span className="absolute bottom-2 left-2 rounded-full bg-black/50 px-2 py-0.5 text-[0.6rem] font-semibold text-white">
              {data.categoria}
            </span>
          )}
        </div>
        <div className="flex flex-col gap-1.5 p-3">
          <div className="flex items-start justify-between gap-2">
            <h4 className="line-clamp-2 flex-1 text-sm font-semibold leading-tight text-ink">{data.nome || 'Nome do espaço'}</h4>
            {data.nota != null && data.nota > 0 && (
              <span className="flex shrink-0 items-center gap-0.5 text-xs text-ink-soft">★ {data.nota.toFixed(1)}</span>
            )}
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-ink-muted">
            {(data.cidade || data.estado) && <span>📍 {[data.cidade, data.estado].filter(Boolean).join(', ')}</span>}
            {data.capacidade && <span>👥 {data.capacidade} pessoas</span>}
          </div>
          <p className="mt-1 border-t border-black/[0.06] pt-2 text-sm font-bold text-brand">{preco}</p>
        </div>
      </div>
    </div>
  );
}
