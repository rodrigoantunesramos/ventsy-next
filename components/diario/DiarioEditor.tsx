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
    <div style={{
      background: '#fff',
      borderRadius: 16,
      boxShadow: '0 2px 20px rgba(0,0,0,0.06)',
      border: '1px solid #f0f0f0',
      overflow: 'hidden',
    }}>
      {/* Barra superior */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 16px', borderBottom: '1px solid #f5f5f5',
        background: '#fafafa',
      }}>
        <span style={{ fontSize: '.82rem', color: '#999', fontWeight: 500 }}>
          ✏️ Nova anotação
        </span>
        <span style={{ fontSize: '.75rem', color: charCount > 1000 ? '#ff385c' : '#bbb' }}>
          {charCount} caracteres
        </span>
      </div>

      {/* Textarea */}
      <div style={{ position: 'relative' }}>
        <textarea
          value={content}
          onChange={e => handleContentChange(e.target.value)}
          placeholder="O que aconteceu? Com quem você falou? Anote tudo aqui..."
          rows={6}
          style={{
            width: '100%', border: 'none', outline: 'none', resize: 'none',
            padding: '16px', fontSize: '1rem', lineHeight: 1.7,
            fontFamily: 'inherit', color: '#222',
            background: 'transparent', boxSizing: 'border-box',
          }}
        />
      </div>

      {/* Sugestões de tags baseadas no texto */}
      {suggestions.length > 0 && (
        <div style={{ padding: '0 16px 8px', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ fontSize: '.72rem', color: '#bbb' }}>Sugestões:</span>
          {suggestions.map(s => (
            <button
              key={s}
              onClick={() => addTag(s)}
              style={{
                background: '#f5f5f5', border: '1px dashed #ddd',
                borderRadius: 20, padding: '2px 10px',
                fontSize: '.72rem', color: '#666', cursor: 'pointer',
              }}
            >
              + {s}
            </button>
          ))}
        </div>
      )}

      {/* Tags adicionadas */}
      {tags.length > 0 && (
        <div style={{ padding: '0 16px 8px', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {tags.map(tag => (
            <span
              key={tag}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                background: '#fff0f2', color: '#ff385c',
                border: '1px solid rgba(255,56,92,.2)',
                borderRadius: 20, padding: '3px 10px', fontSize: '.78rem', fontWeight: 500,
              }}
            >
              #{tag}
              <button
                onClick={() => removeTag(tag)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ff385c', lineHeight: 1, padding: 0 }}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Barra de ferramentas inferior */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8,
        padding: '12px 16px', borderTop: '1px solid #f5f5f5',
        background: '#fafafa',
      }}>
        {/* Input de tag */}
        <div style={{ position: 'relative', flex: '1 1 180px' }}>
          <input
            ref={tagRef}
            value={tagInput}
            onChange={e => handleTagInputChange(e.target.value)}
            onKeyDown={handleTagKey}
            placeholder="+ Adicionar tag (Enter)"
            style={{
              width: '100%', border: '1px solid #eee', borderRadius: 8,
              padding: '6px 10px', fontSize: '.82rem', outline: 'none',
              background: '#fff', boxSizing: 'border-box',
            }}
          />
          {tagSuggest.length > 0 && (
            <div style={{
              position: 'absolute', bottom: '100%', left: 0, right: 0,
              background: '#fff', border: '1px solid #eee', borderRadius: 8,
              boxShadow: '0 4px 16px rgba(0,0,0,0.1)', zIndex: 50,
              marginBottom: 4, overflow: 'hidden',
            }}>
              {tagSuggest.map(t => (
                <div
                  key={t}
                  onMouseDown={() => addTag(t)}
                  style={{
                    padding: '7px 12px', cursor: 'pointer', fontSize: '.82rem',
                    color: '#333',
                  }}
                  className="tag-autocomplete-item"
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
          style={{
            border: '1px solid #eee', borderRadius: 8,
            padding: '6px 10px', fontSize: '.82rem', outline: 'none',
            background: reminder ? '#fff8f0' : '#fff', color: '#555',
          }}
          title="Lembrete"
        />

        {/* Importante */}
        <button
          onClick={() => setImportant(!important)}
          title={important ? 'Remover importância' : 'Marcar como importante'}
          style={{
            background: important ? '#fffbea' : '#f5f5f5',
            border: `1px solid ${important ? '#f0c040' : '#eee'}`,
            borderRadius: 8, padding: '6px 12px',
            fontSize: '.82rem', cursor: 'pointer', color: important ? '#b8860b' : '#999',
            fontWeight: important ? 700 : 400, whiteSpace: 'nowrap',
          }}
        >
          ⭐ {important ? 'Importante' : 'Marcar'}
        </button>

        {/* Salvar */}
        <button
          onClick={handleSave}
          disabled={saving || !content.trim()}
          style={{
            background: content.trim() ? '#ff385c' : '#f0f0f0',
            color: content.trim() ? '#fff' : '#bbb',
            border: 'none', borderRadius: 8, padding: '6px 18px',
            fontSize: '.88rem', fontWeight: 700, cursor: content.trim() ? 'pointer' : 'default',
            whiteSpace: 'nowrap', transition: 'all .15s',
          }}
        >
          {saving ? 'Salvando…' : '💾 Salvar'}
        </button>
      </div>

      <style>{`
        .tag-autocomplete-item:hover { background: #fff5f6; color: #ff385c; }
      `}</style>
    </div>
  );
}
