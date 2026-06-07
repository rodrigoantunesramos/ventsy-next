'use client';

import { useState, useRef, KeyboardEvent } from 'react';
import { DiaryFormData, LeadRef } from '@/types/diario';
import DiarioLeadSelect from './DiarioLeadSelect';

const COMMON_ENTITIES = [
  'contrato', 'reunião', 'proposta', 'pagamento', 'visita',
  'ligação', 'email', 'whatsapp', 'follow-up', 'urgente',
];

function suggestTagsFromText(text: string, existing: string[]): string[] {
  const words  = text.toLowerCase().match(/[a-záéíóúâêîôûãõàèìòùç]{3,}/g) ?? [];
  const proper = text.match(/\b[A-ZÁÉÍÓÚ][a-záéíóúâêîôûãõ]+/g) ?? [];
  const suggestions = new Set<string>();
  COMMON_ENTITIES.forEach(e => { if (text.toLowerCase().includes(e)) suggestions.add(e); });
  proper.forEach(p => { if (p.length >= 3) suggestions.add(p); });
  words.forEach(w => { if (COMMON_ENTITIES.includes(w)) suggestions.add(w); });
  return [...suggestions].filter(s => !existing.includes(s)).slice(0, 5);
}

interface Props {
  existingTags: string[];
  leads?: LeadRef[];
  onSave: (data: DiaryFormData) => Promise<void>;
  saving: boolean;
}

export default function DiarioEditor({ existingTags, leads = [], onSave, saving }: Props) {
  const [content,     setContent]     = useState('');
  const [tags,        setTags]        = useState<string[]>([]);
  const [tagInput,    setTagInput]    = useState('');
  const [reminder,    setReminder]    = useState('');
  const [important,   setImportant]   = useState(false);
  const [leadId,      setLeadId]      = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [tagSuggest,  setTagSuggest]  = useState<string[]>([]);
  const tagRef = useRef<HTMLInputElement>(null);

  const handleTagInputChange = (val: string) => {
    setTagInput(val);
    if (val.trim().length >= 1) {
      const matches = existingTags
        .filter(t => t.toLowerCase().includes(val.toLowerCase()) && !tags.includes(t))
        .slice(0, 6);
      setTagSuggest(matches);
    } else {
      setTagSuggest([]);
    }
  };

  const addTag = (tag: string) => {
    const clean = tag.trim();
    if (clean && !tags.includes(clean)) setTags(prev => [...prev, clean]);
    setTagInput('');
    setTagSuggest([]);
    tagRef.current?.focus();
  };

  const removeTag = (tag: string) => setTags(prev => prev.filter(t => t !== tag));

  const handleTagKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if ((e.key === 'Enter' || e.key === ',') && tagInput.trim()) {
      e.preventDefault();
      addTag(tagInput);
    } else if (e.key === 'Backspace' && !tagInput && tags.length) {
      setTags(prev => prev.slice(0, -1));
    }
  };

  const handleContentChange = (val: string) => {
    setContent(val);
    setSuggestions(suggestTagsFromText(val, tags));
  };

  const handleSave = async () => {
    if (!content.trim()) return;
    await onSave({ content, tags, reminder_date: reminder, is_important: important, lead_id: leadId });
    setContent('');
    setTags([]);
    setReminder('');
    setImportant(false);
    setLeadId(null);
    setSuggestions([]);
  };

  const charCount = content.length;

  return (
    <div className="overflow-hidden rounded-2xl border border-black/[0.06] bg-white shadow-card">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-black/[0.04] bg-gray-50 px-4 py-3">
        <span className="text-[.82rem] font-medium text-ink-muted">✏️ Nova anotação</span>
        <span className={`text-[.75rem] ${charCount > 1000 ? 'text-brand' : 'text-ink-muted'}`}>
          {charCount} caracteres
        </span>
      </div>

      {/* Textarea */}
      <textarea
        value={content}
        onChange={e => handleContentChange(e.target.value)}
        onKeyDown={e => {
          if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            handleSave();
          }
        }}
        placeholder="O que aconteceu? Com quem você falou? Anote tudo aqui..."
        rows={6}
        className="box-border w-full resize-none border-none bg-transparent p-4 font-[inherit] text-[1rem] leading-[1.7] text-ink-soft outline-none"
      />

      {/* Sugestões de tags baseadas no texto */}
      {suggestions.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 px-4 pb-2">
          <span className="text-[.72rem] text-ink-muted">Sugestões:</span>
          {suggestions.map(s => (
            <button
              key={s}
              onClick={() => addTag(s)}
              className="cursor-pointer rounded-[20px] border border-dashed border-black/[0.12] bg-gray-50 px-2.5 py-[2px] text-[.72rem] text-ink-muted transition-colors hover:border-brand hover:text-brand"
            >
              + {s}
            </button>
          ))}
        </div>
      )}

      {/* Tags adicionadas */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-4 pb-2">
          {tags.map(tag => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 rounded-[20px] border border-brand-100 bg-brand-50 px-2.5 py-[3px] text-[.78rem] font-medium text-brand"
            >
              #{tag}
              <button
                onClick={() => removeTag(tag)}
                className="cursor-pointer border-none bg-transparent p-0 leading-none text-brand"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Barra de ferramentas */}
      <div className="flex flex-wrap items-center gap-2 border-t border-black/[0.04] bg-gray-50 px-4 py-3">
        {/* Input de tag */}
        <div className="relative flex-[1_1_180px]">
          <input
            ref={tagRef}
            value={tagInput}
            onChange={e => handleTagInputChange(e.target.value)}
            onKeyDown={handleTagKey}
            placeholder="+ Adicionar tag (Enter)"
            className="box-border w-full rounded-lg border border-black/[0.08] bg-white px-2.5 py-[6px] text-[.82rem] outline-none focus:border-brand"
          />
          {tagSuggest.length > 0 && (
            <div className="absolute bottom-full left-0 right-0 z-50 mb-1 overflow-hidden rounded-lg border border-black/[0.08] bg-white shadow-pop">
              {tagSuggest.map(t => (
                <div
                  key={t}
                  onMouseDown={() => addTag(t)}
                  className="cursor-pointer px-3 py-[7px] text-[.82rem] text-ink-soft hover:bg-brand-50 hover:text-brand"
                >
                  #{t}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Lembrete */}
        <input
          type="date"
          value={reminder}
          onChange={e => setReminder(e.target.value)}
          min={new Date().toISOString().split('T')[0]}
          className={`rounded-lg border border-black/[0.08] px-2.5 py-[6px] text-[.82rem] text-ink-muted outline-none focus:border-brand ${reminder ? 'bg-amber-50' : 'bg-white'}`}
          title="Lembrete"
        />

        {/* Vincular a evento/cliente */}
        {leads.length > 0 && (
          <DiarioLeadSelect leads={leads} value={leadId} onChange={setLeadId} />
        )}

        {/* Importante */}
        <button
          onClick={() => setImportant(!important)}
          title={important ? 'Remover importância' : 'Marcar como importante'}
          className={`cursor-pointer whitespace-nowrap rounded-lg px-3 py-[6px] text-[.82rem] transition-all duration-150
            ${important
              ? 'border border-amber-300 bg-amber-50 font-bold text-amber-700'
              : 'border border-black/[0.08] bg-white font-normal text-ink-muted'}`}
        >
          ⭐ {important ? 'Importante' : 'Marcar'}
        </button>

        {/* Hint atalho */}
        <span className="hidden text-[.7rem] text-ink-muted sm:block">Ctrl+↵</span>

        {/* Salvar */}
        <button
          onClick={handleSave}
          disabled={saving || !content.trim()}
          className={`cursor-pointer whitespace-nowrap rounded-lg border-none px-[18px] py-[6px] text-[.88rem] font-bold transition-all duration-150
            ${content.trim()
              ? 'bg-brand text-white hover:opacity-90'
              : 'cursor-default bg-gray-100 text-ink-muted'}`}
        >
          {saving ? 'Salvando…' : '💾 Salvar'}
        </button>
      </div>
    </div>
  );
}
