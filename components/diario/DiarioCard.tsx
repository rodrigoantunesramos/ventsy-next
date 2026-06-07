'use client';

import { useState, useRef, KeyboardEvent } from 'react';
import { DiaryEntry, LeadRef } from '@/types/diario';
import DiarioLeadSelect from './DiarioLeadSelect';

interface Props {
  entry: DiaryEntry;
  leads?: LeadRef[];
  onTagClick: (tag: string) => void;
  onLeadClick?: (leadId: string) => void;
  onDelete: (id: string) => void;
  onToggleImportant: (id: string, current: boolean) => void;
  onEdit?: (id: string, data: Partial<DiaryEntry>) => Promise<void>;
  showUser?: boolean;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return (
    d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }) +
    ' às ' +
    d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  );
}

function formatReminderDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function isReminderPast(iso: string) { return new Date(iso) < new Date(); }
function isReminderSoon(iso: string) {
  const diff = new Date(iso).getTime() - Date.now();
  return diff > 0 && diff < 1000 * 60 * 60 * 24 * 3;
}

function highlightText(text: string) {
  const parts = text.split(/(\b[A-ZÁÉÍÓÚ][a-záéíóúâêîôûãõ]+\b)/g);
  return parts.map((part, i) =>
    /^[A-ZÁÉÍÓÚ]/.test(part)
      ? <mark key={i} className="rounded-[3px] bg-amber-100 px-[2px]">{part}</mark>
      : part,
  );
}

export default function DiarioCard({ entry, leads = [], onTagClick, onLeadClick, onDelete, onToggleImportant, onEdit, showUser }: Props) {
  const [expanded,     setExpanded]     = useState(false);
  const [confirming,   setConfirming]   = useState(false);
  const [editing,      setEditing]      = useState(false);
  const [editContent,  setEditContent]  = useState('');
  const [editTags,     setEditTags]     = useState<string[]>([]);
  const [editTagInput, setEditTagInput] = useState('');
  const [editReminder, setEditReminder] = useState('');
  const [editLeadId,   setEditLeadId]   = useState<string | null>(null);
  const [editSaving,   setEditSaving]   = useState(false);
  const editTagRef = useRef<HTMLInputElement>(null);

  const preview   = entry.content.slice(0, 200);
  const hasMore   = entry.content.length > 200;
  const displayed = expanded ? entry.content : preview;

  const reminderPast = entry.reminder_date && isReminderPast(entry.reminder_date);
  const reminderSoon = entry.reminder_date && isReminderSoon(entry.reminder_date);

  const cardShadow = entry.is_important
    ? 'shadow-[0_2px_16px_rgba(255,193,7,0.18),0_1px_4px_rgba(0,0,0,0.04)]'
    : 'shadow-card';
  const cardBorder = entry.is_important
    ? 'border-[1.5px] border-amber-300'
    : 'border border-black/[0.06]';

  function startEditing() {
    setEditContent(entry.content);
    setEditTags(entry.tags ?? []);
    setEditReminder(entry.reminder_date ? entry.reminder_date.slice(0, 10) : '');
    setEditLeadId(entry.lead_id ?? null);
    setEditing(true);
  }

  function cancelEditing() {
    setEditing(false);
    setEditTagInput('');
  }

  async function saveEdit() {
    if (!onEdit || !editContent.trim()) return;
    setEditSaving(true);
    await onEdit(entry.id, {
      content:       editContent,
      tags:          editTags,
      reminder_date: editReminder || null,
      lead_id:       editLeadId || null,
    });
    setEditSaving(false);
    setEditing(false);
    setEditTagInput('');
  }

  function addEditTag(tag: string) {
    const clean = tag.trim();
    if (clean && !editTags.includes(clean)) setEditTags(prev => [...prev, clean]);
    setEditTagInput('');
    editTagRef.current?.focus();
  }

  function handleEditTagKey(e: KeyboardEvent<HTMLInputElement>) {
    if ((e.key === 'Enter' || e.key === ',') && editTagInput.trim()) {
      e.preventDefault();
      addEditTag(editTagInput);
    } else if (e.key === 'Backspace' && !editTagInput && editTags.length) {
      setEditTags(prev => prev.slice(0, -1));
    } else if (e.key === 'Escape') {
      cancelEditing();
    }
  }

  // ── Modo edição ────────────────────────────────────────────────────────────
  if (editing) {
    return (
      <div className={`rounded-[14px] bg-white px-5 py-4 ${cardShadow} ${cardBorder}`}>
        <textarea
          value={editContent}
          onChange={e => setEditContent(e.target.value)}
          onKeyDown={e => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); saveEdit(); }
            if (e.key === 'Escape') cancelEditing();
          }}
          rows={5}
          autoFocus
          className="box-border w-full resize-none rounded-lg border border-black/[0.08] bg-gray-50 p-3 font-[inherit] text-[.92rem] leading-[1.7] text-ink-soft outline-none focus:border-brand"
        />

        {/* Tags em edição */}
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {editTags.map(tag => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 rounded-[20px] border border-brand-100 bg-brand-50 px-2.5 py-[2px] text-[.75rem] font-medium text-brand"
            >
              #{tag}
              <button
                onClick={() => setEditTags(p => p.filter(t => t !== tag))}
                className="cursor-pointer border-none bg-transparent p-0 leading-none text-brand"
              >
                ×
              </button>
            </span>
          ))}
          <input
            ref={editTagRef}
            value={editTagInput}
            onChange={e => setEditTagInput(e.target.value)}
            onKeyDown={handleEditTagKey}
            placeholder="+ tag"
            className="min-w-[80px] flex-1 rounded-md border border-black/[0.08] bg-white px-2 py-[3px] text-[.78rem] outline-none focus:border-brand"
          />
        </div>

        {/* Lembrete em edição */}
        <div className="mt-2 flex items-center gap-2">
          <span className="text-[.75rem] text-ink-muted">📅 Lembrete:</span>
          <input
            type="date"
            value={editReminder}
            onChange={e => setEditReminder(e.target.value)}
            min={new Date().toISOString().split('T')[0]}
            className={`rounded-md border border-black/[0.08] px-2 py-[3px] text-[.78rem] outline-none focus:border-brand ${editReminder ? 'bg-amber-50' : 'bg-white'}`}
          />
          {editReminder && (
            <button
              onClick={() => setEditReminder('')}
              className="cursor-pointer text-[.75rem] text-ink-muted hover:text-brand"
            >
              remover
            </button>
          )}
        </div>

        {/* Vincular a evento/cliente */}
        {leads.length > 0 && (
          <div className="mt-2 flex items-center gap-2">
            <span className="text-[.75rem] text-ink-muted">🔗 Evento:</span>
            <DiarioLeadSelect leads={leads} value={editLeadId} onChange={setEditLeadId} className="flex-1" />
          </div>
        )}

        {/* Ações de edição */}
        <div className="mt-3 flex items-center justify-end gap-2">
          <span className="mr-auto hidden text-[.7rem] text-ink-muted sm:block">
            Ctrl+↵ salva · Esc cancela
          </span>
          <button
            onClick={cancelEditing}
            className="cursor-pointer rounded-lg border border-black/[0.08] bg-gray-50 px-3 py-[5px] text-[.8rem] text-ink-muted hover:bg-gray-100"
          >
            Cancelar
          </button>
          <button
            onClick={saveEdit}
            disabled={editSaving || !editContent.trim()}
            className={`cursor-pointer rounded-lg border-none px-4 py-[5px] text-[.8rem] font-bold transition-opacity
              ${editContent.trim() ? 'bg-brand text-white hover:opacity-90' : 'cursor-default bg-gray-100 text-ink-muted'}`}
          >
            {editSaving ? 'Salvando…' : '✓ Salvar'}
          </button>
        </div>
      </div>
    );
  }

  // ── Modo visualização ──────────────────────────────────────────────────────
  return (
    <div className={`relative rounded-[14px] bg-white px-5 py-4 transition-shadow duration-200 ${cardShadow} ${cardBorder}`}>
      {/* Badge importante */}
      {entry.is_important && (
        <span className="absolute right-4 top-3.5 rounded-[20px] border border-amber-300 bg-amber-50 px-2 py-[2px] text-[.7rem] font-bold text-amber-700">
          ⭐ Importante
        </span>
      )}

      {/* Data */}
      <div className="mb-2 text-[.75rem] text-ink-muted">
        {formatDate(entry.created_at)}
        {showUser && (
          <span className="ml-2 opacity-40">· {entry.user_id.slice(0, 8)}…</span>
        )}
      </div>

      {/* Conteúdo */}
      <div className="whitespace-pre-wrap break-words text-[.92rem] leading-[1.7] text-ink-soft">
        {highlightText(displayed)}
        {hasMore && !expanded && <span className="text-ink-muted">…</span>}
      </div>

      {hasMore && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-1 cursor-pointer border-none bg-transparent py-1 text-[.78rem] font-semibold text-brand"
        >
          {expanded ? '↑ Ver menos' : '↓ Ver mais'}
        </button>
      )}

      {/* Tags */}
      {entry.tags?.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-[5px]">
          {entry.tags.map(tag => (
            <button
              key={tag}
              onClick={() => onTagClick(tag)}
              className="cursor-pointer rounded-[20px] border border-[rgba(124,58,237,.15)] bg-[#f5f0ff] px-2.5 py-[2px] text-[.72rem] font-semibold text-[#7c3aed] transition-colors duration-150 hover:bg-[#7c3aed] hover:text-white"
            >
              #{tag}
            </button>
          ))}
        </div>
      )}

      {/* Evento/cliente vinculado */}
      {entry.lead && (
        <div className="mt-2.5">
          <button
            onClick={() => onLeadClick?.(entry.lead!.id)}
            title="Filtrar por este evento"
            className="inline-flex items-center gap-1.5 rounded-[20px] border border-violet-200 bg-violet-50 px-2.5 py-[3px] text-[.75rem] font-semibold text-violet-700 transition-colors hover:bg-violet-100"
          >
            🔗 {entry.lead.nome_evento}
            <span className="font-normal opacity-70">· {entry.lead.quem_contratou}</span>
          </button>
        </div>
      )}

      {/* Lembrete */}
      {entry.reminder_date && (
        <div
          className={`mt-2.5 inline-flex items-center gap-[5px] rounded-[20px] px-2.5 py-[3px] text-[.75rem] font-medium
            ${reminderPast
              ? 'border border-red-200 bg-red-50 text-red-700'
              : reminderSoon
                ? 'border border-amber-300 bg-amber-50 text-amber-700'
                : 'border border-emerald-300 bg-emerald-50 text-emerald-700'}`}
        >
          {reminderPast ? '⏰ Lembrete vencido:' : reminderSoon ? '⏳ Em breve:' : '📅 Lembrete:'}{' '}
          {formatReminderDate(entry.reminder_date)}
        </div>
      )}

      {/* Ações */}
      <div className="mt-3 flex items-center justify-end gap-2">
        {onEdit && (
          <button
            onClick={startEditing}
            title="Editar anotação"
            className="cursor-pointer rounded-md border-none bg-transparent px-1.5 py-1 text-[.8rem] text-ink-muted hover:text-brand"
          >
            ✏️
          </button>
        )}

        <button
          onClick={() => onToggleImportant(entry.id, entry.is_important)}
          title={entry.is_important ? 'Remover importância' : 'Marcar como importante'}
          className={`cursor-pointer rounded-md border-none bg-transparent px-1.5 py-1 text-[.8rem]
            ${entry.is_important ? 'text-amber-500' : 'text-ink-muted hover:text-amber-400'}`}
        >
          ⭐
        </button>

        {confirming ? (
          <div className="flex items-center gap-1">
            <span className="text-[.75rem] text-ink-muted">Confirmar?</span>
            <button
              onClick={() => { onDelete(entry.id); setConfirming(false); }}
              className="cursor-pointer rounded-md border-none bg-brand px-2.5 py-[3px] text-[.75rem] text-white"
            >
              Sim
            </button>
            <button
              onClick={() => setConfirming(false)}
              className="cursor-pointer rounded-md border border-black/[0.08] bg-gray-50 px-2.5 py-[3px] text-[.75rem] text-ink-muted"
            >
              Não
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirming(true)}
            className="cursor-pointer rounded-md border-none bg-transparent px-1.5 py-1 text-[.8rem] text-ink-muted hover:text-red-500"
          >
            🗑️
          </button>
        )}
      </div>
    </div>
  );
}
