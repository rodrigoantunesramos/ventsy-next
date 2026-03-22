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
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{
            background: '#f5f5f5', borderRadius: 14, height: 120,
            animation: 'pulse 1.4s ease-in-out infinite',
            animationDelay: `${i * 0.15}s`,
          }} />
        ))}
        <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}`}</style>
      </div>
    );
  }

  if (!entries.length) {
    return (
      <div style={{
        textAlign: 'center', padding: '48px 16px',
        color: '#bbb', fontSize: '.92rem',
      }}>
        <div style={{ fontSize: '3rem', marginBottom: 12 }}>📒</div>
        <div style={{ fontWeight: 600, color: '#999' }}>Nenhuma anotação encontrada</div>
        <div style={{ marginTop: 6, fontSize: '.82rem' }}>
          Comece escrevendo sobre suas interações com clientes.
        </div>
      </div>
    );
  }

  const grouped = groupByDate(entries);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {grouped.map(([dateLabel, dayEntries]) => (
        <div key={dateLabel} style={{ marginBottom: 24 }}>
          {/* Separador de data */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12,
          }}>
            <div style={{ flex: 1, height: 1, background: '#f0f0f0' }} />
            <span style={{
              fontSize: '.72rem', fontWeight: 700, color: '#ccc',
              textTransform: 'capitalize', letterSpacing: '.04em',
              whiteSpace: 'nowrap',
            }}>
              {dateLabel}
            </span>
            <div style={{ flex: 1, height: 1, background: '#f0f0f0' }} />
          </div>

          {/* Cards do dia */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {dayEntries.map(entry => (
              <div key={entry.id} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                {/* Linha do tempo */}
                <div style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  paddingTop: 18, flexShrink: 0,
                }}>
                  <div style={{
                    width: 10, height: 10, borderRadius: '50%',
                    background: entry.is_important ? '#f0c040' : '#ff385c',
                    border: '2px solid #fff',
                    boxShadow: `0 0 0 2px ${entry.is_important ? '#f0c040' : '#ff385c'}44`,
                    flexShrink: 0,
                  }} />
                </div>

                {/* Card */}
                <div style={{ flex: 1, minWidth: 0 }}>
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
