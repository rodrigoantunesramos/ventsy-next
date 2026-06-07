'use client';

// Controle de publicação. Grava `propriedades.publicada` (o gate real da vitrine).
// Bloqueia a publicação enquanto faltarem os mínimos (lista `missing`).

export default function PublishToggle({
  publicada,
  canPublish,
  missing,
  saving,
  onChange,
}: {
  publicada: boolean;
  canPublish: boolean;
  missing: string[];
  saving?: boolean;
  onChange: (v: boolean) => void;
}) {
  const blocked = !publicada && !canPublish;
  return (
    <div className="flex flex-col items-start gap-1 sm:items-end">
      <div className="flex items-center gap-2">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${
            publicada ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-black/10 bg-black/[0.04] text-ink-muted'
          }`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${publicada ? 'bg-emerald-500' : 'bg-ink-muted/50'}`} />
          {publicada ? 'Publicado' : 'Rascunho'}
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={publicada}
          disabled={blocked || saving}
          onClick={() => onChange(!publicada)}
          title={blocked ? 'Complete os itens obrigatórios para publicar' : publicada ? 'Despublicar' : 'Publicar'}
          className={`relative h-6 w-11 rounded-full transition disabled:cursor-not-allowed disabled:opacity-50 ${publicada ? 'bg-brand' : 'bg-black/15'}`}
        >
          <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${publicada ? 'left-[22px]' : 'left-0.5'}`} />
        </button>
      </div>
      {blocked && missing.length > 0 && (
        <span className="text-[0.7rem] text-amber-600">Falta p/ publicar: {missing.join(', ')}</span>
      )}
    </div>
  );
}
