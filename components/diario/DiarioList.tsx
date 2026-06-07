'use client';

import { DiaryEntry, LeadRef } from '@/types/diario';
import DiarioCard from './DiarioCard';

interface Props {
  entries: DiaryEntry[];
  loading: boolean;
  leads?: LeadRef[];
  onTagClick: (tag: string) => void;
  onLeadClick?: (leadId: string) => void;
  onDelete: (id: string) => void;
  onToggleImportant: (id: string, current: boolean) => void;
  onEdit?: (id: string, data: Partial<DiaryEntry>) => Promise<void>;
  showUser?: boolean;
}

function groupByDate(entries: DiaryEntry[]) {
  const groups: Record<string, DiaryEntry[]> = {};
  entries.forEach(e => {
    const key = new Date(e.created_at).toLocaleDateString('pt-BR', {
      weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
    });
    if (!groups[key]) groups[key] = [];
    groups[key].push(e);
  });
  return Object.entries(groups);
}

export default function DiarioList({
  entries, loading, leads, onTagClick, onLeadClick, onDelete, onToggleImportant, onEdit, showUser,
}: Props) {
  if (loading) {
    return (
      <div className="flex flex-col gap-3">
        {[0, 1, 2].map(i => (
          <div
            key={i}
            className="h-[120px] animate-[pulse_1.4s_ease-in-out_infinite] rounded-[14px] bg-gray-100"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </div>
    );
  }

  if (!entries.length) {
    return (
      <div className="px-4 py-12 text-center">
        <div className="mb-3 text-[3rem]">📒</div>
        <div className="font-semibold text-ink-muted">Nenhuma anotação encontrada</div>
        <div className="mt-1.5 text-[.82rem] text-ink-muted">
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
          {/* Separador de data + contador */}
          <div className="mb-3 flex items-center gap-2.5">
            <div className="h-px flex-1 bg-black/[0.05]" />
            <span className="whitespace-nowrap text-[.72rem] font-bold capitalize tracking-[.04em] text-ink-muted">
              {dateLabel}
            </span>
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[.65rem] font-bold text-ink-muted">
              {dayEntries.length}
            </span>
            <div className="h-px flex-1 bg-black/[0.05]" />
          </div>

          {/* Cards do dia */}
          <div className="flex flex-col gap-2.5">
            {dayEntries.map(entry => (
              <div key={entry.id} className="flex items-start gap-3">
                {/* Ponto da linha do tempo */}
                <div className="flex flex-shrink-0 flex-col items-center pt-[18px]">
                  <div
                    className="h-2.5 w-2.5 flex-shrink-0 rounded-full border-2 border-white"
                    style={{
                      background: entry.is_important ? '#f59e0b' : '#ff385c',
                      boxShadow:  `0 0 0 2px ${entry.is_important ? '#f59e0b' : '#ff385c'}44`,
                    }}
                  />
                </div>

                {/* Card */}
                <div className="min-w-0 flex-1">
                  <DiarioCard
                    entry={entry}
                    leads={leads}
                    onTagClick={onTagClick}
                    onLeadClick={onLeadClick}
                    onDelete={onDelete}
                    onToggleImportant={onToggleImportant}
                    onEdit={onEdit}
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
