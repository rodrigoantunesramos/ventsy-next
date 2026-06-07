'use client';

interface Props {
  search: string;
  onSearchChange: (val: string) => void;
  activeTag: string;
  onTagClear: () => void;
  activeLeadLabel?: string;
  onLeadClear?: () => void;
  total: number;
  filtered: number;
  onImportantOnly: (val: boolean) => void;
  importantOnly: boolean;
  onReminderOnly: (val: boolean) => void;
  reminderOnly: boolean;
}

export default function DiarioBusca({
  search, onSearchChange, activeTag, onTagClear,
  activeLeadLabel, onLeadClear,
  total, filtered, onImportantOnly, importantOnly,
  onReminderOnly, reminderOnly,
}: Props) {
  return (
    <div className="rounded-2xl border border-black/[0.06] bg-white p-4 shadow-card">
      {/* Campo de busca */}
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[1rem] text-ink-muted">
          🔍
        </span>
        <input
          type="text"
          value={search}
          onChange={e => onSearchChange(e.target.value)}
          placeholder="Buscar por texto, nome, empresa..."
          className="box-border w-full rounded-[10px] border-[1.5px] border-black/[0.08] bg-gray-50 py-2.5 pl-9 pr-3 text-[.9rem] text-ink-soft outline-none transition-colors duration-150 focus:border-brand"
        />
        {search && (
          <button
            onClick={() => onSearchChange('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 cursor-pointer border-none bg-transparent text-[1rem] text-ink-muted hover:text-ink-soft"
          >
            ×
          </button>
        )}
      </div>

      {/* Filtros rápidos */}
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        <button
          onClick={() => onImportantOnly(!importantOnly)}
          className={`cursor-pointer rounded-[20px] px-3 py-1 text-[.78rem] transition-all duration-150
            ${importantOnly
              ? 'border border-amber-300 bg-amber-50 font-bold text-amber-700'
              : 'border border-black/[0.08] bg-gray-50 font-normal text-ink-muted'}`}
        >
          ⭐ Importantes
        </button>

        <button
          onClick={() => onReminderOnly(!reminderOnly)}
          className={`cursor-pointer rounded-[20px] px-3 py-1 text-[.78rem] transition-all duration-150
            ${reminderOnly
              ? 'border border-emerald-300 bg-emerald-50 font-bold text-emerald-700'
              : 'border border-black/[0.08] bg-gray-50 font-normal text-ink-muted'}`}
        >
          📅 Com lembrete
        </button>

        {activeTag && (
          <div className="inline-flex items-center gap-1 rounded-[20px] border border-[rgba(124,58,237,.2)] bg-[#f5f0ff] px-3 py-1 text-[.78rem] font-semibold text-[#7c3aed]">
            #{activeTag}
            <button
              onClick={onTagClear}
              className="cursor-pointer border-none bg-transparent p-0 leading-none text-[#7c3aed]"
            >
              ×
            </button>
          </div>
        )}

        {activeLeadLabel && (
          <div className="inline-flex items-center gap-1 rounded-[20px] border border-violet-200 bg-violet-50 px-3 py-1 text-[.78rem] font-semibold text-violet-700">
            🔗 {activeLeadLabel}
            <button
              onClick={onLeadClear}
              className="cursor-pointer border-none bg-transparent p-0 leading-none text-violet-700"
            >
              ×
            </button>
          </div>
        )}

        <span className="ml-auto text-[.75rem] text-ink-muted">
          {filtered === total
            ? `${total} ${total === 1 ? 'anotação' : 'anotações'}`
            : `${filtered} de ${total} anotações`}
        </span>
      </div>
    </div>
  );
}
