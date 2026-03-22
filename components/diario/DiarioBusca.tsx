'use client';

interface Props {
  search: string;
  onSearchChange: (val: string) => void;
  activeTag: string;
  onTagClear: () => void;
  total: number;
  filtered: number;
  onImportantOnly: (val: boolean) => void;
  importantOnly: boolean;
  onReminderOnly: (val: boolean) => void;
  reminderOnly: boolean;
}

export default function DiarioBusca({
  search, onSearchChange, activeTag, onTagClear,
  total, filtered, onImportantOnly, importantOnly,
  onReminderOnly, reminderOnly,
}: Props) {
  return (
    <div style={{
      background: '#fff', borderRadius: 14,
      boxShadow: '0 2px 12px rgba(0,0,0,0.05)',
      border: '1px solid #f0f0f0',
      padding: '16px',
    }}>
      {/* Campo de busca */}
      <div style={{ position: 'relative' }}>
        <span style={{
          position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
          fontSize: '1rem', pointerEvents: 'none', color: '#bbb',
        }}>
          🔍
        </span>
        <input
          type="text"
          value={search}
          onChange={e => onSearchChange(e.target.value)}
          placeholder="Buscar por texto, nome, empresa..."
          style={{
            width: '100%', border: '1.5px solid #eee', borderRadius: 10,
            padding: '10px 12px 10px 36px', fontSize: '.9rem',
            outline: 'none', boxSizing: 'border-box',
            background: '#fafafa', color: '#333',
            transition: 'border .15s',
          }}
          onFocus={e => (e.target.style.borderColor = '#ff385c')}
          onBlur={e => (e.target.style.borderColor = '#eee')}
        />
        {search && (
          <button
            onClick={() => onSearchChange('')}
            style={{
              position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
              background: 'none', border: 'none', cursor: 'pointer', color: '#bbb', fontSize: '1rem',
            }}
          >
            ×
          </button>
        )}
      </div>

      {/* Filtros rápidos */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10, alignItems: 'center' }}>
        <button
          onClick={() => onImportantOnly(!importantOnly)}
          style={{
            background: importantOnly ? '#fffbea' : '#f5f5f5',
            border: `1px solid ${importantOnly ? '#f0c040' : '#eee'}`,
            borderRadius: 20, padding: '4px 12px',
            fontSize: '.78rem', fontWeight: importantOnly ? 700 : 400,
            cursor: 'pointer', color: importantOnly ? '#b8860b' : '#666',
          }}
        >
          ⭐ Importantes
        </button>

        <button
          onClick={() => onReminderOnly(!reminderOnly)}
          style={{
            background: reminderOnly ? '#f0fff4' : '#f5f5f5',
            border: `1px solid ${reminderOnly ? '#86efac' : '#eee'}`,
            borderRadius: 20, padding: '4px 12px',
            fontSize: '.78rem', fontWeight: reminderOnly ? 700 : 400,
            cursor: 'pointer', color: reminderOnly ? '#27ae60' : '#666',
          }}
        >
          📅 Com lembrete
        </button>

        {activeTag && (
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            background: '#f5f0ff', color: '#7c3aed',
            border: '1px solid rgba(124,58,237,.2)',
            borderRadius: 20, padding: '4px 12px', fontSize: '.78rem', fontWeight: 600,
          }}>
            #{activeTag}
            <button
              onClick={onTagClear}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#7c3aed', lineHeight: 1, padding: 0 }}
            >
              ×
            </button>
          </div>
        )}

        <span style={{ marginLeft: 'auto', fontSize: '.75rem', color: '#bbb' }}>
          {filtered === total
            ? `${total} anotação${total !== 1 ? 'ões' : ''}`
            : `${filtered} de ${total} anotações`}
        </span>
      </div>
    </div>
  );
}
