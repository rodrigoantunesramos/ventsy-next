'use client';

import { useState, useRef, KeyboardEvent } from 'react';
import { DiaryFormData } from '@/types/diario';

// ── Sugestão simples de tags baseada no texto ──────────────────────────────
const COMMON_ENTITIES = [
  'contrato', 'reunião', 'proposta', 'pagamento', 'visita',
  'ligação', 'email', 'whatsapp', 'follow-up', 'urgente',
];

function suggestTagsFromText(text: string, existing: string[]): string[] {
  const words = text.toLowerCase().match(/[a-záéíóúâêîôûãõàèìòùç]{3,}/g) ?? [];
  const proper = text.match(/\b[A-ZÁÉÍÓÚ][a-záéíóúâêîôûãõ]+/g) ?? [];
  const suggestions = new Set<string>();

  COMMON_ENTITIES.forEach(e => {
    if (text.toLowerCase().includes(e)) suggestions.add(e);
  });

  proper.forEach(p => {
    if (p.length >= 3) suggestions.add(p);
  });

  words.forEach(w => {
    if (COMMON_ENTITIES.includes(w)) suggestions.add(w);
  });

  return [...suggestions].filter(s => !existing.includes(s)).slice(0, 5);
}

// ── Props ─────────────────────────────────────────────────────────────────
interface Props {
  existingTags: string[];
  onSave: (data: DiaryFormData) => Promise<void>;
  saving: boolean;
}

export default function DiarioEditor({ existingTags, onSave, saving }: Props) {
  const [content,      setContent]      = useState('');
  const [tags,         setTags]         = useState<string[]>([]);
  const [tagInput,     setTagInput]     = useState('');
  const [reminder,     setReminder]     = useState('');
  const [important,    setImportant]    = useState(false);
  const [suggestions,  setSuggestions]  = useState<string[]>([]);
  const [tagSuggest,   setTagSuggest]   = useState<string[]>([]);
  const tagRef = useRef<HTMLInputElement>(null);

  // Autocomplete de tags já existentes
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
    if (clean && !tags.includes(clean)) {
      setTags(prev => [...prev, clean]);
    }
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
    await onSave({ content, tags, reminder_date: reminder, is_important: important });
    setContent('');
    setTags([]);
    setReminder('');
    setImportant(false);
    setSuggestions([]);
  };

  const charCount = content.length;

  return (
    <div className="bg-white rounded-2xl shadow-[0_2px_20px_rgba(0,0,0,0.06)] border border-[#f0f0f0] overflow-hidden">
      {/* Barra superior */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#f5f5f5] bg-[#fafafa]">
        <span className="text-[.82rem] text-[#999] font-medium">✏️ Nova anotação</span>
        <span className={`text-[.75rem] ${charCount > 1000 ? 'text-[#ff385c]' : 'text-[#bbb]'}`}>
          {charCount} caracteres
        </span>
      </div>

      {/* Textarea */}
      <div className="relative">
        <textarea
          value={content}
          onChange={e => handleContentChange(e.target.value)}
          placeholder="O que aconteceu? Com quem você falou? Anote tudo aqui..."
          rows={6}
          className="w-full border-none outline-none resize-none p-4 text-[1rem] leading-[1.7] font-[inherit] text-[#222] bg-transparent box-border"
        />
      </div>

      {/* Sugestões de tags baseadas no texto */}
      {suggestions.length > 0 && (
        <div className="px-4 pb-2 flex items-center gap-1.5 flex-wrap">
          <span className="text-[.72rem] text-[#bbb]">Sugestões:</span>
          {suggestions.map(s => (
            <button
              key={s}
              onClick={() => addTag(s)}
              className="bg-[#f5f5f5] border border-dashed border-[#ddd] rounded-[20px] px-2.5 py-[2px] text-[.72rem] text-[#666] cursor-pointer"
            >
              + {s}
            </button>
          ))}
        </div>
      )}

      {/* Tags adicionadas */}
      {tags.length > 0 && (
        <div className="px-4 pb-2 flex flex-wrap gap-1.5">
          {tags.map(tag => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 bg-[#fff0f2] text-[#ff385c] border border-[rgba(255,56,92,.2)] rounded-[20px] px-2.5 py-[3px] text-[.78rem] font-medium"
            >
              #{tag}
              <button
                onClick={() => removeTag(tag)}
                className="bg-transparent border-none cursor-pointer text-[#ff385c] leading-none p-0"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Barra de ferramentas inferior */}
      <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-t border-[#f5f5f5] bg-[#fafafa]">
        {/* Input de tag */}
        <div className="relative flex-[1_1_180px]">
          <input
            ref={tagRef}
            value={tagInput}
            onChange={e => handleTagInputChange(e.target.value)}
            onKeyDown={handleTagKey}
            placeholder="+ Adicionar tag (Enter)"
            className="w-full border border-[#eee] rounded-lg px-2.5 py-[6px] text-[.82rem] outline-none bg-white box-border"
          />
          {tagSuggest.length > 0 && (
            <div className="absolute bottom-full left-0 right-0 bg-white border border-[#eee] rounded-lg shadow-[0_4px_16px_rgba(0,0,0,0.1)] z-50 mb-1 overflow-hidden">
              {tagSuggest.map(t => (
                <div
                  key={t}
                  onMouseDown={() => addTag(t)}
                  className="tag-autocomplete-item px-3 py-[7px] cursor-pointer text-[.82rem] text-[#333]"
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
          className={`border border-[#eee] rounded-lg px-2.5 py-[6px] text-[.82rem] outline-none text-[#555] ${reminder ? 'bg-[#fff8f0]' : 'bg-white'}`}
          title="Lembrete"
        />

        {/* Importante */}
        <button
          onClick={() => setImportant(!important)}
          title={important ? 'Remover importância' : 'Marcar como importante'}
          className={`rounded-lg px-3 py-[6px] text-[.82rem] cursor-pointer whitespace-nowrap transition-all duration-150
            ${important
              ? 'bg-[#fffbea] border border-[#f0c040] text-[#b8860b] font-bold'
              : 'bg-[#f5f5f5] border border-[#eee] text-[#999] font-normal'}`}
        >
          ⭐ {important ? 'Importante' : 'Marcar'}
        </button>

        {/* Salvar */}
        <button
          onClick={handleSave}
          disabled={saving || !content.trim()}
          className={`border-none rounded-lg px-[18px] py-[6px] text-[.88rem] font-bold whitespace-nowrap transition-all duration-150
            ${content.trim()
              ? 'bg-[#ff385c] text-white cursor-pointer'
              : 'bg-[#f0f0f0] text-[#bbb] cursor-default'}`}
        >
          {saving ? 'Salvando…' : '💾 Salvar'}
        </button>
      </div>

      <style>{`.tag-autocomplete-item:hover { background: #fff5f6; color: #ff385c; }`}</style>
    </div>
  );
}
