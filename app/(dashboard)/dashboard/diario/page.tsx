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
    <div className="flex gap-2.5 flex-wrap">
      {[
        { label: 'Total',      value: entries.length,    icon: '📒', color: '#ff385c' },
        { label: 'Importantes', value: importants,        icon: '⭐', color: '#b8860b' },
        { label: 'Lembretes',  value: withReminder,      icon: '📅', color: '#27ae60' },
        { label: 'Vencidos',   value: overdueReminders,  icon: '⏰', color: '#c0392b' },
        { label: 'Tags',       value: uniqueTags,        icon: '🏷️', color: '#7c3aed' },
      ].map(s => (
        <div
          key={s.label}
          className="bg-white rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.05)] border border-[#f0f0f0] px-4 py-3 flex-[1_1_80px] text-center min-w-[70px]"
        >
          <div className="text-[1.2rem]">{s.icon}</div>
          <div className="text-[1.4rem] font-extrabold leading-[1.2] mt-0.5" style={{ color: s.color }}>
            {s.value}
          </div>
          <div className="text-[.68rem] text-[#bbb] mt-0.5">{s.label}</div>
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
    <div className="bg-white rounded-[14px] shadow-[0_2px_12px_rgba(0,0,0,0.05)] border border-[#f0f0f0] px-4 py-3.5">
      <div className="text-[.75rem] font-bold text-[#bbb] mb-2 uppercase tracking-[.06em]">
        Tags populares
      </div>
      <div className="flex flex-wrap gap-1.5">
        {tagCounts.map(([tag, count]) => (
          <button
            key={tag}
            onClick={() => onTagClick(tag)}
            className="border border-[rgba(124,58,237,.15)] rounded-[20px] px-2.5 py-[3px] text-[.75rem] font-semibold cursor-pointer transition-all duration-150"
            style={{
              background: activeTag === tag ? '#7c3aed' : '#f5f0ff',
              color:      activeTag === tag ? '#fff'    : '#7c3aed',
            }}
          >
            #{tag} <span className="opacity-70">{count}</span>
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
    <div className="p-6 max-w-[860px] mx-auto">

      {/* ── Cabeçalho ────────────────────────────────────────────── */}
      <div className="mb-6">
        <h1 className="text-[1.5rem] font-extrabold text-[#111] m-0 flex items-center gap-2.5">
          📒 Diário Inteligente
        </h1>
        <p className="text-[.88rem] text-[#888] mt-1.5 mb-0">
          Sua memória de relacionamento com clientes. Registre interações, contextos e lembretes.
        </p>
      </div>

      {/* ── Stats ────────────────────────────────────────────────── */}
      <div className="mb-5">
        <StatsBar entries={entries} />
      </div>

      {/* ── Editor ───────────────────────────────────────────────── */}
      <div className="mb-5">
        <DiarioEditor
          existingTags={existingTags}
          onSave={handleSave}
          saving={saving}
        />
      </div>

      {/* ── Busca + Tags populares ────────────────────────────────── */}
      <div className="mb-4">
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
        <div className="mb-5">
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
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-[#222] text-white rounded-[10px] px-5 py-2.5 text-[.88rem] font-medium shadow-[0_4px_20px_rgba(0,0,0,0.2)] z-[9999] animate-[slideUp_.25s_ease]">
          {toast}
        </div>
      )}
    </div>
  );
}
