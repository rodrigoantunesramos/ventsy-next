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
      ? <mark key={i} className="bg-[#fff8e1] rounded-[3px] px-[2px]">{part}</mark>
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

  const cardShadow = entry.is_important
    ? 'shadow-[0_2px_16px_rgba(255,193,7,0.18),0_1px_4px_rgba(0,0,0,0.04)]'
    : 'shadow-[0_2px_12px_rgba(0,0,0,0.05)]';
  const cardBorder = entry.is_important
    ? 'border-[1.5px] border-[#f0c040]'
    : 'border border-[#f0f0f0]';

  return (
    <div className={`bg-white rounded-[14px] ${cardShadow} ${cardBorder} px-5 py-4 transition-shadow duration-200 relative`}>
      {/* Badge importante */}
      {entry.is_important && (
        <span className="absolute top-3.5 right-4 text-[.7rem] font-bold text-[#b8860b] bg-[#fffbea] border border-[#f0c040] rounded-[20px] px-2 py-[2px]">
          ⭐ Importante
        </span>
      )}

      {/* Data */}
      <div className="text-[.75rem] text-[#bbb] mb-2">
        {formatDate(entry.created_at)}
        {showUser && (
          <span className="ml-2 text-[#ddd]">· {entry.user_id.slice(0, 8)}…</span>
        )}
      </div>

      {/* Conteúdo */}
      <div className="text-[.92rem] leading-[1.7] text-[#333] whitespace-pre-wrap break-words">
        {highlightText(displayed)}
        {hasMore && !expanded && <span className="text-[#bbb]">…</span>}
      </div>

      {hasMore && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="bg-transparent border-none cursor-pointer text-[#ff385c] text-[.78rem] font-semibold py-1 mt-1"
        >
          {expanded ? '↑ Ver menos' : '↓ Ver mais'}
        </button>
      )}

      {/* Tags */}
      {entry.tags?.length > 0 && (
        <div className="flex flex-wrap gap-[5px] mt-2.5">
          {entry.tags.map(tag => (
            <button
              key={tag}
              onClick={() => onTagClick(tag)}
              className="bg-[#f5f0ff] text-[#7c3aed] border border-[rgba(124,58,237,.15)] rounded-[20px] px-2.5 py-[2px] text-[.72rem] font-semibold cursor-pointer transition-all duration-150"
            >
              #{tag}
            </button>
          ))}
        </div>
      )}

      {/* Lembrete */}
      {entry.reminder_date && (
        <div className={`mt-2.5 inline-flex items-center gap-[5px] rounded-[20px] px-2.5 py-[3px] text-[.75rem] font-medium
          ${reminderPast
            ? 'bg-[#fff0f0] text-[#c0392b] border border-[#fca5a5]'
            : reminderSoon
              ? 'bg-[#fff8e1] text-[#b8860b] border border-[#f0c040]'
              : 'bg-[#f0fff4] text-[#27ae60] border border-[#86efac]'}`}
        >
          {reminderPast ? '⏰ Lembrete vencido:' : reminderSoon ? '⏳ Em breve:' : '📅 Lembrete:'}{' '}
          {formatReminderDate(entry.reminder_date)}
        </div>
      )}

      {/* Ações */}
      <div className="flex gap-2 mt-3 justify-end">
        <button
          onClick={() => onToggleImportant(entry.id, entry.is_important)}
          title={entry.is_important ? 'Remover importância' : 'Marcar como importante'}
          className={`bg-transparent border-none cursor-pointer text-[.8rem] px-1.5 py-1 rounded-md
            ${entry.is_important ? 'text-[#b8860b]' : 'text-[#bbb]'}`}
        >
          ⭐
        </button>

        {confirming ? (
          <div className="flex gap-1 items-center">
            <span className="text-[.75rem] text-[#999]">Confirmar?</span>
            <button
              onClick={() => { onDelete(entry.id); setConfirming(false); }}
              className="bg-[#ff385c] text-white border-none rounded-md px-2.5 py-[3px] cursor-pointer text-[.75rem]"
            >
              Sim
            </button>
            <button
              onClick={() => setConfirming(false)}
              className="bg-[#f5f5f5] border-none rounded-md px-2.5 py-[3px] cursor-pointer text-[.75rem]"
            >
              Não
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirming(true)}
            className="bg-transparent border-none cursor-pointer text-[.8rem] text-[#ddd] px-1.5 py-1 rounded-md"
          >
            🗑️
          </button>
        )}
      </div>
    </div>
  );
}
