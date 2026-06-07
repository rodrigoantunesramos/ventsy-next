'use client';

// Diário — /painel/diario.
// Reaproveita o diário inteligente já existente (componentes @/components/diario/*
// + rotas /api/diario). Movido para a árvore consolidada do painel.

import { useEffect, useState, useMemo, useCallback } from 'react';
import { supabase as sb } from '@/lib/supabase';
import { DiaryEntry, DiaryFormData } from '@/types/diario';
import DiarioEditor from '@/components/diario/DiarioEditor';
import DiarioBusca from '@/components/diario/DiarioBusca';
import DiarioList from '@/components/diario/DiarioList';

function StatsBar({ entries }: { entries: DiaryEntry[] }) {
  const importants = entries.filter((e) => e.is_important).length;
  const withReminder = entries.filter((e) => e.reminder_date).length;
  const overdueReminders = entries.filter((e) => e.reminder_date && new Date(e.reminder_date) < new Date()).length;
  const uniqueTags = new Set(entries.flatMap((e) => e.tags ?? [])).size;

  return (
    <div className="flex flex-wrap gap-2.5">
      {[
        { label: 'Total', value: entries.length, icon: '📒', color: '#ff385c' },
        { label: 'Importantes', value: importants, icon: '⭐', color: '#b8860b' },
        { label: 'Lembretes', value: withReminder, icon: '📅', color: '#27ae60' },
        { label: 'Vencidos', value: overdueReminders, icon: '⏰', color: '#c0392b' },
        { label: 'Tags', value: uniqueTags, icon: '🏷️', color: '#7c3aed' },
      ].map((s) => (
        <div key={s.label} className="min-w-[70px] flex-[1_1_80px] rounded-2xl border border-black/[0.06] bg-white px-4 py-3 text-center shadow-card">
          <div className="text-[1.2rem]">{s.icon}</div>
          <div className="mt-0.5 text-[1.4rem] font-extrabold leading-tight" style={{ color: s.color }}>{s.value}</div>
          <div className="mt-0.5 text-[.68rem] text-ink-muted">{s.label}</div>
        </div>
      ))}
    </div>
  );
}

function PopularTags({ entries, activeTag, onTagClick }: { entries: DiaryEntry[]; activeTag: string; onTagClick: (tag: string) => void }) {
  const tagCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    entries.flatMap((e) => e.tags ?? []).forEach((t) => { counts[t] = (counts[t] ?? 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 12);
  }, [entries]);
  if (!tagCounts.length) return null;
  return (
    <div className="rounded-2xl border border-black/[0.06] bg-white px-4 py-3.5 shadow-card">
      <div className="mb-2 text-[.75rem] font-bold uppercase tracking-[.06em] text-ink-muted">Tags populares</div>
      <div className="flex flex-wrap gap-1.5">
        {tagCounts.map(([tag, count]) => (
          <button
            key={tag}
            onClick={() => onTagClick(tag)}
            className="rounded-[20px] border border-[rgba(124,58,237,.15)] px-2.5 py-[3px] text-[.75rem] font-semibold transition"
            style={{ background: activeTag === tag ? '#7c3aed' : '#f5f0ff', color: activeTag === tag ? '#fff' : '#7c3aed' }}
          >
            #{tag} <span className="opacity-70">{count}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function DiarioPage() {
  const [userId, setUserId] = useState('');
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [activeTag, setActiveTag] = useState('');
  const [importantOnly, setImportantOnly] = useState(false);
  const [reminderOnly, setReminderOnly] = useState(false);
  const [toast, setToast] = useState('');

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const loadEntries = useCallback(async (uid: string) => {
    setLoading(true);
    const res = await fetch(`/api/diario?user_id=${uid}`);
    const json = await res.json();
    setEntries(json.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await sb.auth.getSession();
      if (!session) { setLoading(false); return; }
      setUserId(session.user.id);
      await loadEntries(session.user.id);
    })();
  }, [loadEntries]);

  const handleSave = async (form: DiaryFormData) => {
    setSaving(true);
    const res = await fetch('/api/diario', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, user_id: userId }) });
    const json = await res.json();
    if (json.error) showToast('Erro ao salvar. Tente novamente.');
    else { setEntries((prev) => [json.data, ...prev]); showToast('✅ Anotação salva!'); }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/diario/${id}`, { method: 'DELETE' });
    setEntries((prev) => prev.filter((e) => e.id !== id));
    showToast('🗑️ Anotação removida.');
  };

  const handleToggleImportant = async (id: string, current: boolean) => {
    const res = await fetch(`/api/diario/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_important: !current }) });
    const json = await res.json();
    if (!json.error) setEntries((prev) => prev.map((e) => (e.id === id ? json.data : e)));
  };

  const filtered = useMemo(() => {
    let result = entries;
    if (search.trim()) { const q = search.toLowerCase(); result = result.filter((e) => e.content.toLowerCase().includes(q) || e.tags?.some((t) => t.toLowerCase().includes(q))); }
    if (activeTag) result = result.filter((e) => e.tags?.includes(activeTag));
    if (importantOnly) result = result.filter((e) => e.is_important);
    if (reminderOnly) result = result.filter((e) => !!e.reminder_date);
    return result;
  }, [entries, search, activeTag, importantOnly, reminderOnly]);

  const existingTags = useMemo(() => [...new Set(entries.flatMap((e) => e.tags ?? []))], [entries]);

  return (
    <div className="mx-auto max-w-[860px]">
      <div className="mb-6">
        <h1 className="flex items-center gap-2.5 text-xl font-bold text-ink sm:text-2xl">📒 Diário Inteligente</h1>
        <p className="mt-1.5 text-sm text-ink-muted">Sua memória de relacionamento com clientes. Registre interações, contextos e lembretes.</p>
      </div>

      <div className="mb-5"><StatsBar entries={entries} /></div>
      <div className="mb-5"><DiarioEditor existingTags={existingTags} onSave={handleSave} saving={saving} /></div>
      <div className="mb-4">
        <DiarioBusca
          search={search} onSearchChange={setSearch} activeTag={activeTag} onTagClear={() => setActiveTag('')}
          total={entries.length} filtered={filtered.length}
          onImportantOnly={setImportantOnly} importantOnly={importantOnly}
          onReminderOnly={setReminderOnly} reminderOnly={reminderOnly}
        />
      </div>
      {entries.length > 0 && (
        <div className="mb-5"><PopularTags entries={entries} activeTag={activeTag} onTagClick={(tag) => setActiveTag(activeTag === tag ? '' : tag)} /></div>
      )}
      <DiarioList entries={filtered} loading={loading} onTagClick={(tag) => setActiveTag(activeTag === tag ? '' : tag)} onDelete={handleDelete} onToggleImportant={handleToggleImportant} />

      {toast && <div className="fixed bottom-6 left-1/2 z-[9999] -translate-x-1/2 rounded-[10px] bg-ink px-5 py-2.5 text-sm font-medium text-white shadow-pop">{toast}</div>}
    </div>
  );
}
