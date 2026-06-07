'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase as sb } from '@/lib/supabase';
import { DiaryEntry, DiaryFormData } from '@/types/diario';
import DiarioEditor      from '@/components/diario/DiarioEditor';
import DiarioBusca       from '@/components/diario/DiarioBusca';
import DiarioList        from '@/components/diario/DiarioList';
import DiarioStatsBar    from '@/components/diario/DiarioStatsBar';
import DiarioPopularTags from '@/components/diario/DiarioPopularTags';

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

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }, []);

  const loadEntries = useCallback(async (uid: string) => {
    setLoading(true);
    const res  = await fetch(`/api/diario?user_id=${uid}`);
    const json = await res.json();
    setEntries(json.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await sb.auth.getSession();
      if (!session) { router.push('/login'); return; }
      setUserId(session.user.id);
      await loadEntries(session.user.id);
    })();
  }, [loadEntries, router]);

  const handleSave = async (form: DiaryFormData) => {
    setSaving(true);
    const res  = await fetch('/api/diario', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ ...form, user_id: userId }),
    });
    const json = await res.json();
    if (json.error) showToast('Erro ao salvar. Tente novamente.');
    else { setEntries(prev => [json.data, ...prev]); showToast('✅ Anotação salva!'); }
    setSaving(false);
  };

  const handleEdit = async (id: string, data: Partial<DiaryEntry>) => {
    const res  = await fetch(`/api/diario/${id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(data),
    });
    const json = await res.json();
    if (json.error) showToast('Erro ao atualizar. Tente novamente.');
    else { setEntries(prev => prev.map(e => e.id === id ? json.data : e)); showToast('✅ Anotação atualizada!'); }
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/diario/${id}`, { method: 'DELETE' });
    setEntries(prev => prev.filter(e => e.id !== id));
    showToast('🗑️ Anotação removida.');
  };

  const handleToggleImportant = async (id: string, current: boolean) => {
    const res  = await fetch(`/api/diario/${id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ is_important: !current }),
    });
    const json = await res.json();
    if (!json.error) setEntries(prev => prev.map(e => e.id === id ? json.data : e));
  };

  const filtered = useMemo(() => {
    let result = entries;
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(e =>
        e.content.toLowerCase().includes(q) || e.tags?.some(t => t.toLowerCase().includes(q))
      );
    }
    if (activeTag)     result = result.filter(e => e.tags?.includes(activeTag));
    if (importantOnly) result = result.filter(e => e.is_important);
    if (reminderOnly)  result = result.filter(e => !!e.reminder_date);
    return result;
  }, [entries, search, activeTag, importantOnly, reminderOnly]);

  const existingTags = useMemo(() =>
    [...new Set(entries.flatMap(e => e.tags ?? []))],
  [entries]);

  const toggleTag = (tag: string) => setActiveTag(prev => prev === tag ? '' : tag);

  return (
    <div className="mx-auto max-w-[860px]">
      <div className="mb-6">
        <h1 className="flex items-center gap-2.5 text-xl font-bold text-ink sm:text-2xl">
          📒 Diário Inteligente
        </h1>
        <p className="mt-1.5 text-sm text-ink-muted">
          Sua memória de relacionamento com clientes. Registre interações, contextos e lembretes.
        </p>
      </div>

      <div className="mb-5"><DiarioStatsBar entries={entries} /></div>
      <div className="mb-5">
        <DiarioEditor existingTags={existingTags} onSave={handleSave} saving={saving} />
      </div>
      <div className="mb-4">
        <DiarioBusca
          search={search}         onSearchChange={setSearch}
          activeTag={activeTag}   onTagClear={() => setActiveTag('')}
          total={entries.length}  filtered={filtered.length}
          onImportantOnly={setImportantOnly} importantOnly={importantOnly}
          onReminderOnly={setReminderOnly}   reminderOnly={reminderOnly}
        />
      </div>
      {entries.length > 0 && (
        <div className="mb-5">
          <DiarioPopularTags entries={entries} activeTag={activeTag} onTagClick={toggleTag} />
        </div>
      )}
      <DiarioList
        entries={filtered}
        loading={loading}
        onTagClick={toggleTag}
        onDelete={handleDelete}
        onToggleImportant={handleToggleImportant}
        onEdit={handleEdit}
      />

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-[9999] -translate-x-1/2 rounded-[10px] bg-ink px-5 py-2.5 text-sm font-medium text-white shadow-pop">
          {toast}
        </div>
      )}
    </div>
  );
}
