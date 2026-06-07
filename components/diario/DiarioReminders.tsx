'use client';

import { useMemo } from 'react';
import { DiaryEntry } from '@/types/diario';

interface Props {
  entries: DiaryEntry[];
  onResolve: (id: string) => void;          // limpa o reminder_date (concluir)
  onOpenLead?: (leadId: string) => void;    // filtrar pelo evento vinculado
}

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function relativeLabel(iso: string): string {
  const today = startOfToday();
  const d = new Date(iso);
  d.setHours(0, 0, 0, 0);
  const days = Math.round((d.getTime() - today.getTime()) / 86_400_000);
  if (days === 0)  return 'hoje';
  if (days === 1)  return 'amanhã';
  if (days === -1) return 'ontem';
  if (days < 0)    return `há ${Math.abs(days)} dias`;
  return `em ${days} dias`;
}

export default function DiarioReminders({ entries, onResolve, onOpenLead }: Props) {
  const groups = useMemo(() => {
    const today = startOfToday();
    const in7   = new Date(today.getTime() + 7 * 86_400_000);
    const overdue: DiaryEntry[] = [];
    const todayList: DiaryEntry[] = [];
    const upcoming: DiaryEntry[] = [];

    for (const e of entries) {
      if (!e.reminder_date) continue;
      const d = new Date(e.reminder_date);
      const day = new Date(d); day.setHours(0, 0, 0, 0);
      if (day < today)        overdue.push(e);
      else if (day.getTime() === today.getTime()) todayList.push(e);
      else if (day <= in7)    upcoming.push(e);
    }
    const byDate = (a: DiaryEntry, b: DiaryEntry) =>
      new Date(a.reminder_date!).getTime() - new Date(b.reminder_date!).getTime();
    return {
      overdue:  overdue.sort(byDate),
      today:    todayList.sort(byDate),
      upcoming: upcoming.sort(byDate),
    };
  }, [entries]);

  const total = groups.overdue.length + groups.today.length + groups.upcoming.length;
  if (!total) return null;

  const sections = [
    { key: 'overdue',  title: 'Vencidos',        items: groups.overdue,  tone: 'border-red-200 bg-red-50',        dot: 'bg-red-500',     text: 'text-red-700' },
    { key: 'today',    title: 'Vence hoje',      items: groups.today,    tone: 'border-amber-300 bg-amber-50',    dot: 'bg-amber-500',   text: 'text-amber-700' },
    { key: 'upcoming', title: 'Próximos 7 dias', items: groups.upcoming, tone: 'border-emerald-200 bg-emerald-50', dot: 'bg-emerald-500', text: 'text-emerald-700' },
  ].filter(s => s.items.length > 0);

  return (
    <div className="overflow-hidden rounded-2xl border border-black/[0.06] bg-white shadow-card">
      <div className="flex items-center justify-between border-b border-black/[0.04] bg-gray-50 px-4 py-3">
        <span className="text-[.82rem] font-bold text-ink-soft">⏰ Lembretes</span>
        <span className="rounded-full bg-brand px-2 py-0.5 text-[.68rem] font-bold text-white">{total}</span>
      </div>

      <div className="flex flex-col gap-3 p-4">
        {sections.map(sec => (
          <div key={sec.key}>
            <div className={`mb-1.5 flex items-center gap-1.5 text-[.7rem] font-bold uppercase tracking-[.05em] ${sec.text}`}>
              <span className={`inline-block h-2 w-2 rounded-full ${sec.dot}`} />
              {sec.title}
              <span className="opacity-70">({sec.items.length})</span>
            </div>
            <div className="flex flex-col gap-1.5">
              {sec.items.map(e => (
                <div key={e.id} className={`flex items-start gap-2 rounded-lg border ${sec.tone} px-3 py-2`}>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[.82rem] text-ink-soft">{e.content}</div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[.7rem]">
                      <span className={`font-semibold ${sec.text}`}>{relativeLabel(e.reminder_date!)}</span>
                      {e.lead && (
                        <button
                          onClick={() => onOpenLead?.(e.lead!.id)}
                          className="rounded-full bg-violet-100 px-1.5 py-px font-medium text-violet-700 hover:bg-violet-200"
                        >
                          🔗 {e.lead.nome_evento}
                        </button>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => onResolve(e.id)}
                    title="Concluir lembrete"
                    className="shrink-0 rounded-md border border-black/[0.08] bg-white px-2 py-1 text-[.72rem] font-semibold text-ink-muted hover:border-emerald-300 hover:text-emerald-700"
                  >
                    ✓ Concluir
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
