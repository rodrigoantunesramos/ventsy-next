'use client';

import { useMemo } from 'react';
import { DiaryEntry } from '@/types/diario';

interface Props {
  entries: DiaryEntry[];
  activeTag: string;
  onTagClick: (tag: string) => void;
}

export default function DiarioPopularTags({ entries, activeTag, onTagClick }: Props) {
  const tagCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    entries.flatMap(e => e.tags ?? []).forEach(t => {
      counts[t] = (counts[t] ?? 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 12);
  }, [entries]);

  if (!tagCounts.length) return null;

  return (
    <div className="rounded-2xl border border-black/[0.06] bg-white px-4 py-3.5 shadow-card">
      <div className="mb-2 text-[.75rem] font-bold uppercase tracking-[.06em] text-ink-muted">
        Tags populares
      </div>
      <div className="flex flex-wrap gap-1.5">
        {tagCounts.map(([tag, count]) => (
          <button
            key={tag}
            onClick={() => onTagClick(tag)}
            className="rounded-[20px] border border-[rgba(124,58,237,.15)] px-2.5 py-[3px] text-[.75rem] font-semibold transition-colors duration-150"
            style={{
              background: activeTag === tag ? '#7c3aed' : '#f5f0ff',
              color:      activeTag === tag ? '#fff'    : '#7c3aed',
            }}
          >
            #{tag} <span className="opacity-70">{count}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
