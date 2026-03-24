'use client';

import { DiaryEntry } from '@/types/diario';
import DiarioCard from './DiarioCard';

interface Props {
  entries: DiaryEntry[];
  loading: boolean;
  onTagClick: (tag: string) => void;
  onDelete: (id: string) => void;
  onToggleImportant: (id: string, current: boolean) => void;
  showUser?: boolean;
}

function groupByDate(entries: DiaryEntry[]) {
  const groups: Record<string, DiaryEntry[]> = {};

  entries.forEach(e => {
    const d   = new Date(e.created_at);
    const key = d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
    if (!groups[key]) groups[key] = [];
    groups[key].push(e);
  });

  return Object.entries(groups);
}

export default function DiarioList({ entries, loading, onTagClick, onDelete, onToggleImportant, showUser }: Props) {
  if (loading) {
    return (
      <div className="flex flex-col gap-3">
        {[0, 1, 2].map(i => (
          <div
            key={i}
            className="bg-[#f5f5f5] rounded-[14px] h-[120px] animate-[pulse_1.4s_ease-in-out_infinite]"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </div>
    );
  }

  if (!entries.length) {
    return (
      <div className="text-center px-4 py-12 text-[#bbb] text-[.92rem]">
        <div className="text-[3rem] mb-3">📒</div>
        <div className="font-semibold text-[#999]">Nenhuma anotação encontrada</div>
        <div className="mt-1.5 text-[.82rem]">
          Comece escrevendo sobre suas interações com clientes.
        </div>
      </div>
    );
  }

  const grouped = groupByDate(entries);

  return (
    <div className="flex flex-col">
      {grouped.map(([dateLabel, dayEntries]) => (
        <div key={dateLabel} className="mb-6">
          {/* Separador de data */}
          <div className="flex items-center gap-2.5 mb-3">
            <div className="flex-1 h-px bg-[#f0f0f0]" />
            <span className="text-[.72rem] font-bold text-[#ccc] capitalize tracking-[.04em] whitespace-nowrap">
              {dateLabel}
            </span>
            <div className="flex-1 h-px bg-[#f0f0f0]" />
          </div>

          {/* Cards do dia */}
          <div className="flex flex-col gap-2.5">
            {dayEntries.map(entry => (
              <div key={entry.id} className="flex gap-3 items-start">
                {/* Linha do tempo */}
                <div className="flex flex-col items-center pt-[18px] flex-shrink-0">
                  <div
                    className="w-2.5 h-2.5 rounded-full border-2 border-white flex-shrink-0"
                    style={{
                      background: entry.is_important ? '#f0c040' : '#ff385c',
                      boxShadow: `0 0 0 2px ${entry.is_important ? '#f0c040' : '#ff385c'}44`,
                    }}
                  />
                </div>

                {/* Card */}
                <div className="flex-1 min-w-0">
                  <DiarioCard
                    entry={entry}
                    onTagClick={onTagClick}
                    onDelete={onDelete}
                    onToggleImportant={onToggleImportant}
                    showUser={showUser}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
