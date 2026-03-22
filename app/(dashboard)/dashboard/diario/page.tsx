'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase as sb } from '@/lib/supabase';
import { DiaryEntry, DiaryFormData } from '@/types/diario';
import DiarioEditor from '@/components/diario/DiarioEditor';
import DiarioBusca  from '@/components/diario/DiarioBusca';
import DiarioList   from '@/components/diario/DiarioList';

// ── Estatísticas rápidas ───────────────────────────────────────────────────
function StatsBar({ entries }: { entries: DiaryEntry[] }) {
  const importants = entries.filter(e => e.is_important).length;
  const withReminder = entries.filter(e => e.reminder_date).length;
  const overdueReminders = entries.filter(e =>
    e.reminder_date && new Date(e.reminder_date) < new Date(),
  ).length;

  const allTags = entries.flatMap(e => e.tags ?? []);
  const uniqueTags = new Set(allTags).size;

  return (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
      {[
        { label: 'Total', value: entries.length, icon: '📒', color: '#ff385c' },
        { label: 'Importantes', value: importants, icon: '⭐', color: '#b8860b' },
        { label: 'Lembretes', value: withReminder, icon: '📅', color: '#27ae60' },
        { label: 'Vencidos', value: overdueReminders, icon: '⏰', color: '#c0392b' },
        { label: 'Tags', value: uniqueTags, icon: '🏷️', color: '#7c3aed' },
      ].map(s => (
        <div key={s.label} style={{
          background: '#fff', borderRadius: 12,
          boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
          border: '1px solid #f0f0f0',
          padding: '12px 16px', flex: '1 1 80px', textAlign: 'center',
          minWidth: 70,
        }}>
          <div style={{ fontSize: '1.2rem' }}>{s.icon}</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: s.color, lineHeight: 1.2, marginTop: 2 }}>
            {s.value}
          </div>
          <div style={{ fontSize: '.68rem', color: '#bbb', marginTop: 2 }}>{s.label}</div>
        </div>
      ))}
    </div>
  );
}

// ── Tags populares ─────────────────────────────────────────────────────────
function PopularTags({ entries, activeTag, onTagClick }: {
  entries: DiaryEntry[];
  activeTag: string;
  onTagClick: (tag: string) => void;
}) {
  const tagCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    entries.flatMap(e => e.tags ?? []).forEach(t => {
      counts[t] = (counts[t] ?? 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 12);
  }, [entries]);

  if (!tagCounts.length) return null;

  return (
    <div style={{
      background: '#fff', borderRadius: 14,
      boxShadow: '0 2px 12px rgba(0,0,0,0.05)',
      border: '1px solid #f0f0f0', padding: '14px 16px',
    }}>
      <div style={{ fontSize: '.75rem', fontWeight: 700, color: '#bbb', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.06em' }}>
        Tags populares
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {tagCounts.map(([tag, count]) => (
          <button
            key={tag}
            onClick={() => onTagClick(tag)}
            style={{
              background: activeTag === tag ? '#7c3aed' : '#f5f0ff',
              color: activeTag === tag ? '#fff' : '#7c3aed',
              border: '1px solid rgba(124,58,237,.15)',
              borderRadius: 20, padding: '3px 10px',
              fontSize: '.75rem', fontWeight: 600, cursor: 'pointer',
              transition: 'all .15s',
            }}
          >
            #{tag} <span style={{ opacity: .7 }}>{count}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────
export default function DiarioPage() {
  const router = useRouter();

  const [userId,        setUserId]        = useState('');
  const [entries,       setEntries]       = useState<DiaryEntry[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [saving,        setSaving]        = useState(false);
  const [search,        setSearch]        = useState('');
  const [activeTag,     setActiveTag]     = useState('');
  const [importantOnly, setImportantOnly] = useState(false);
  const [reminderOnly,  setReminderOnly]  = useState(false);
  const [toast,         setToast]         = useState('');

  // ── Toast ──────────────────────────────────────────────────────────────
  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  // ── Auth + load ────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const { data: { session } } = await sb.auth.getSession();
      if (!session) { router.push('/login'); return; }
      setUserId(session.user.id);
      await loadEntries(session.user.id);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadEntries = useCallback(async (uid: string) => {
    setLoading(true);
    const res  = await fetch(`/api/diario?user_id=${uid}`);
    const json = await res.json();
    setEntries(json.data ?? []);
    setLoading(false);
  }, []);

  // ── Salvar nova anotação ───────────────────────────────────────────────
  const handleSave = async (form: DiaryFormData) => {
    setSaving(true);
    const res  = await fetch('/api/diario', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, user_id: userId }),
    });
    const json = await res.json();
    if (json.error) {
      showToast('Erro ao salvar. Tente novamente.');
    } else {
      setEntries(prev => [json.data, ...prev]);
      showToast('✅ Anotação salva!');
    }
    setSaving(false);
  };

  // ── Deletar ────────────────────────────────────────────────────────────
  const handleDelete = async (id: string) => {
    await fetch(`/api/diario/${id}`, { method: 'DELETE' });
    setEntries(prev => prev.filter(e => e.id !== id));
    showToast('🗑️ Anotação removida.');
  };

  // ── Marcar como importante ─────────────────────────────────────────────
  const handleToggleImportant = async (id: string, current: boolean) => {
    const res  = await fetch(`/api/diario/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_important: !current }),
    });
    const json = await res.json();
    if (!json.error) {
      setEntries(prev => prev.map(e => e.id === id ? json.data : e));
    }
  };

  // ── Filtros ────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let result = entries;

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(e =>
        e.content.toLowerCase().includes(q) ||
        e.tags?.some(t => t.toLowerCase().includes(q)),
      );
    }

    if (activeTag) {
      result = result.filter(e => e.tags?.includes(activeTag));
    }

    if (importantOnly) {
      result = result.filter(e => e.is_important);
    }

    if (reminderOnly) {
      result = result.filter(e => !!e.reminder_date);
    }

    return result;
  }, [entries, search, activeTag, importantOnly, reminderOnly]);

  const existingTags = useMemo(() =>
    [...new Set(entries.flatMap(e => e.tags ?? []))],
  [entries]);

  return (
    <div style={{ padding: '24px', maxWidth: 860, margin: '0 auto' }}>

      {/* ── Cabeçalho ────────────────────────────────────────────── */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{
          fontSize: '1.5rem', fontWeight: 800, color: '#111',
          margin: 0, display: 'flex', alignItems: 'center', gap: 10,
        }}>
          📒 Diário Inteligente
        </h1>
        <p style={{ fontSize: '.88rem', color: '#888', margin: '6px 0 0' }}>
          Sua memória de relacionamento com clientes. Registre interações, contextos e lembretes.
        </p>
      </div>

      {/* ── Stats ────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 20 }}>
        <StatsBar entries={entries} />
      </div>

      {/* ── Editor ───────────────────────────────────────────────── */}
      <div style={{ marginBottom: 20 }}>
        <DiarioEditor
          existingTags={existingTags}
          onSave={handleSave}
          saving={saving}
        />
      </div>

      {/* ── Busca + Tags populares ────────────────────────────────── */}
      <div style={{ marginBottom: 16 }}>
        <DiarioBusca
          search={search}
          onSearchChange={setSearch}
          activeTag={activeTag}
          onTagClear={() => setActiveTag('')}
          total={entries.length}
          filtered={filtered.length}
          onImportantOnly={setImportantOnly}
          importantOnly={importantOnly}
          onReminderOnly={setReminderOnly}
          reminderOnly={reminderOnly}
        />
      </div>

      {entries.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <PopularTags
            entries={entries}
            activeTag={activeTag}
            onTagClick={tag => setActiveTag(activeTag === tag ? '' : tag)}
          />
        </div>
      )}

      {/* ── Lista ────────────────────────────────────────────────── */}
      <DiarioList
        entries={filtered}
        loading={loading}
        onTagClick={tag => setActiveTag(activeTag === tag ? '' : tag)}
        onDelete={handleDelete}
        onToggleImportant={handleToggleImportant}
      />

      {/* ── Toast ────────────────────────────────────────────────── */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          background: '#222', color: '#fff', borderRadius: 10,
          padding: '10px 20px', fontSize: '.88rem', fontWeight: 500,
          boxShadow: '0 4px 20px rgba(0,0,0,0.2)', zIndex: 9999,
          animation: 'slideUp .25s ease',
        }}>
          {toast}
        </div>
      )}

      <style>{`@keyframes slideUp{from{opacity:0;transform:translate(-50%,12px)}to{opacity:1;transform:translate(-50%,0)}}`}</style>
    </div>
  );
}
