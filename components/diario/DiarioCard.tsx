'use client';

import { useState } from 'react';
import { DiaryEntry } from '@/types/diario';

interface Props {
  entry: DiaryEntry;
  onTagClick: (tag: string) => void;
  onDelete: (id: string) => void;
  onToggleImportant: (id: string, current: boolean) => void;
  showUser?: boolean;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'short', year: 'numeric',
  }) + ' às ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function formatReminderDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function isReminderPast(iso: string) {
  return new Date(iso) < new Date();
}

function isReminderSoon(iso: string) {
  const diff = new Date(iso).getTime() - Date.now();
  return diff > 0 && diff < 1000 * 60 * 60 * 24 * 3; // 3 days
}

// Highlight termos capitalizados (nomes próprios)
function highlightText(text: string) {
  const parts = text.split(/(\b[A-ZÁÉÍÓÚ][a-záéíóúâêîôûãõ]+\b)/g);
  return parts.map((part, i) =>
    /^[A-ZÁÉÍÓÚ]/.test(part)
      ? <mark key={i} style={{ background: '#fff8e1', borderRadius: 3, padding: '0 2px' }}>{part}</mark>
      : part,
  );
}

export default function DiarioCard({ entry, onTagClick, onDelete, onToggleImportant, showUser }: Props) {
  const [expanded, setExpanded]     = useState(false);
  const [confirming, setConfirming] = useState(false);

  const preview   = entry.content.slice(0, 200);
  const hasMore   = entry.content.length > 200;
  const displayed = expanded ? entry.content : preview;

  const reminderPast  = entry.reminder_date && isReminderPast(entry.reminder_date);
  const reminderSoon  = entry.reminder_date && isReminderSoon(entry.reminder_date);

  return (
    <div style={{
      background: '#fff',
      borderRadius: 14,
      boxShadow: entry.is_important
        ? '0 2px 16px rgba(255,193,7,0.18), 0 1px 4px rgba(0,0,0,0.04)'
        : '0 2px 12px rgba(0,0,0,0.05)',
      border: entry.is_important ? '1.5px solid #f0c040' : '1px solid #f0f0f0',
      padding: '16px 20px',
      transition: 'box-shadow .2s',
      position: 'relative',
    }}>
      {/* Badge importante */}
      {entry.is_important && (
        <span style={{
          position: 'absolute', top: 14, right: 16,
          fontSize: '.7rem', fontWeight: 700, color: '#b8860b',
          background: '#fffbea', border: '1px solid #f0c040',
          borderRadius: 20, padding: '2px 8px',
        }}>
          ⭐ Importante
        </span>
      )}

      {/* Data */}
      <div style={{ fontSize: '.75rem', color: '#bbb', marginBottom: 8 }}>
        {formatDate(entry.created_at)}
        {showUser && (
          <span style={{ marginLeft: 8, color: '#ddd' }}>· {entry.user_id.slice(0, 8)}…</span>
        )}
      </div>

      {/* Conteúdo */}
      <div style={{
        fontSize: '.92rem', lineHeight: 1.7, color: '#333',
        whiteSpace: 'pre-wrap', wordBreak: 'break-word',
      }}>
        {highlightText(displayed)}
        {hasMore && !expanded && <span style={{ color: '#bbb' }}>…</span>}
      </div>

      {hasMore && (
        <button
          onClick={() => setExpanded(!expanded)}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: '#ff385c', fontSize: '.78rem', fontWeight: 600,
            padding: '4px 0', marginTop: 4,
          }}
        >
          {expanded ? '↑ Ver menos' : '↓ Ver mais'}
        </button>
      )}

      {/* Tags */}
      {entry.tags?.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 10 }}>
          {entry.tags.map(tag => (
            <button
              key={tag}
              onClick={() => onTagClick(tag)}
              style={{
                background: '#f5f0ff', color: '#7c3aed',
                border: '1px solid rgba(124,58,237,.15)',
                borderRadius: 20, padding: '2px 10px',
                fontSize: '.72rem', fontWeight: 600, cursor: 'pointer',
                transition: 'all .15s',
              }}
            >
              #{tag}
            </button>
          ))}
        </div>
      )}

      {/* Lembrete */}
      {entry.reminder_date && (
        <div style={{
          marginTop: 10, display: 'inline-flex', alignItems: 'center', gap: 5,
          background: reminderPast ? '#fff0f0' : reminderSoon ? '#fff8e1' : '#f0fff4',
          color: reminderPast ? '#c0392b' : reminderSoon ? '#b8860b' : '#27ae60',
          border: `1px solid ${reminderPast ? '#fca5a5' : reminderSoon ? '#f0c040' : '#86efac'}`,
          borderRadius: 20, padding: '3px 10px', fontSize: '.75rem', fontWeight: 500,
        }}>
          {reminderPast ? '⏰ Lembrete vencido:' : reminderSoon ? '⏳ Em breve:' : '📅 Lembrete:'}{' '}
          {formatReminderDate(entry.reminder_date)}
        </div>
      )}

      {/* Ações */}
      <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'flex-end' }}>
        <button
          onClick={() => onToggleImportant(entry.id, entry.is_important)}
          title={entry.is_important ? 'Remover importância' : 'Marcar como importante'}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: '.8rem', color: entry.is_important ? '#b8860b' : '#bbb',
            padding: '4px 6px', borderRadius: 6,
          }}
        >
          ⭐
        </button>

        {confirming ? (
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <span style={{ fontSize: '.75rem', color: '#999' }}>Confirmar?</span>
            <button
              onClick={() => { onDelete(entry.id); setConfirming(false); }}
              style={{
                background: '#ff385c', color: '#fff', border: 'none',
                borderRadius: 6, padding: '3px 10px', cursor: 'pointer', fontSize: '.75rem',
              }}
            >
              Sim
            </button>
            <button
              onClick={() => setConfirming(false)}
              style={{
                background: '#f5f5f5', border: 'none',
                borderRadius: 6, padding: '3px 10px', cursor: 'pointer', fontSize: '.75rem',
              }}
            >
              Não
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirming(true)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: '.8rem', color: '#ddd', padding: '4px 6px', borderRadius: 6,
            }}
          >
            🗑️
          </button>
        )}
      </div>
    </div>
  );
}
