'use client';

interface Props {
  search: string;
  onSearchChange: (val: string) => void;
  activeTag: string;
  onTagClear: () => void;
  total: number;
  filtered: number;
  onImportantOnly: (val: boolean) => void;
  importantOnly: boolean;
  onReminderOnly: (val: boolean) => void;
  reminderOnly: boolean;
}

export default function DiarioBusca({
  search, onSearchChange, activeTag, onTagClear,
  total, filtered, onImportantOnly, importantOnly,
  onReminderOnly, reminderOnly,
}: Props) {
  return (
    <div className="bg-white rounded-[14px] shadow-[0_2px_12px_rgba(0,0,0,0.05)] border border-[#f0f0f0] p-4">
      {/* Campo de busca */}
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[1rem] pointer-events-none text-[#bbb]">
          🔍
        </span>
        <input
          type="text"
          value={search}
          onChange={e => onSearchChange(e.target.value)}
          placeholder="Buscar por texto, nome, empresa..."
          className="w-full border-[1.5px] border-[#eee] rounded-[10px] py-2.5 pr-3 pl-9 text-[.9rem] outline-none box-border bg-[#fafafa] text-[#333] transition-[border] duration-150 focus:border-[#ff385c]"
        />
        {search && (
          <button
            onClick={() => onSearchChange('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 bg-transparent border-none cursor-pointer text-[#bbb] text-[1rem]"
          >
            ×
          </button>
        )}
      </div>

      {/* Filtros rápidos */}
      <div className="flex flex-wrap gap-1.5 mt-2.5 items-center">
        <button
          onClick={() => onImportantOnly(!importantOnly)}
          className={`rounded-[20px] px-3 py-1 text-[.78rem] cursor-pointer transition-all duration-150
            ${importantOnly
              ? 'bg-[#fffbea] border border-[#f0c040] text-[#b8860b] font-bold'
              : 'bg-[#f5f5f5] border border-[#eee] text-[#666] font-normal'}`}
        >
          ⭐ Importantes
        </button>

        <button
          onClick={() => onReminderOnly(!reminderOnly)}
          className={`rounded-[20px] px-3 py-1 text-[.78rem] cursor-pointer transition-all duration-150
            ${reminderOnly
              ? 'bg-[#f0fff4] border border-[#86efac] text-[#27ae60] font-bold'
              : 'bg-[#f5f5f5] border border-[#eee] text-[#666] font-normal'}`}
        >
          📅 Com lembrete
        </button>

        {activeTag && (
          <div className="inline-flex items-center gap-1 bg-[#f5f0ff] text-[#7c3aed] border border-[rgba(124,58,237,.2)] rounded-[20px] px-3 py-1 text-[.78rem] font-semibold">
            #{activeTag}
            <button
              onClick={onTagClear}
              className="bg-transparent border-none cursor-pointer text-[#7c3aed] leading-none p-0"
            >
              ×
            </button>
          </div>
        )}

        <span className="ml-auto text-[.75rem] text-[#bbb]">
          {filtered === total
            ? `${total} anotação${total !== 1 ? 'ões' : ''}`
            : `${filtered} de ${total} anotações`}
        </span>
      </div>
    </div>
  );
}
