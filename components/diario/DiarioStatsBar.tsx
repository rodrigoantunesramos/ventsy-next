'use client';

import { useMemo } from 'react';
import { DiaryEntry } from '@/types/diario';
import { dayDiff } from '@/lib/diarioDates';

export default function DiarioStatsBar({ entries }: { entries: DiaryEntry[] }) {
  const stats = useMemo(() => {
    const importants       = entries.filter(e => e.is_important).length;
    const withReminder     = entries.filter(e => e.reminder_date).length;
    const overdueReminders = entries.filter(e =>
      e.reminder_date && dayDiff(e.reminder_date) < 0
    ).length;
    const uniqueTags = new Set(entries.flatMap(e => e.tags ?? [])).size;
    return [
      { label: 'Total',       value: entries.length,   icon: '📒', color: '#ff385c' },
      { label: 'Importantes', value: importants,        icon: '⭐', color: '#b8860b' },
      { label: 'Lembretes',   value: withReminder,      icon: '📅', color: '#27ae60' },
      { label: 'Vencidos',    value: overdueReminders,  icon: '⏰', color: '#c0392b' },
      { label: 'Tags',        value: uniqueTags,        icon: '🏷️', color: '#7c3aed' },
    ];
  }, [entries]);

  return (
    <div className="flex flex-wrap gap-2.5">
      {stats.map(s => (
        <div
          key={s.label}
          className="min-w-[70px] flex-[1_1_80px] rounded-2xl border border-black/[0.06] bg-white px-4 py-3 text-center shadow-card"
        >
          <div className="text-[1.2rem]">{s.icon}</div>
          <div className="mt-0.5 text-[1.4rem] font-extrabold leading-tight" style={{ color: s.color }}>
            {s.value}
          </div>
          <div className="mt-0.5 text-[.68rem] text-ink-muted">{s.label}</div>
        </div>
      ))}
    </div>
  );
}
