'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase as sb } from '@/lib/supabase';
import { DiaryEntry } from '@/types/diario';
import DiarioBusca from '@/components/diario/DiarioBusca';
import DiarioList  from '@/components/diario/DiarioList';

// Verificação local de admin (mesma lógica do admin.js)
const ADMIN_EMAILS = ['admin@ventsy.com.br', 'suporte@ventsy.com.br'];

// ── Stats Admin ────────────────────────────────────────────────────────────
function AdminStatsBar({ entries }: { entries: DiaryEntry[] }) {
  const uniqueUsers    = new Set(entries.map(e => e.user_id)).size;
  const importants     = entries.filter(e => e.is_important).length;
  const withReminder   = entries.filter(e => e.reminder_date).length;
  const overdue        = entries.filter(e => e.reminder_date && new Date(e.reminder_date) < new Date()).length;

  return (
    <div className="flex gap-[10px] flex-wrap mb-5">
      {[
        { label: 'Total de anotações', value: entries.length, icon: '📒', color: '#ff385c' },
        { label: 'Usuários ativos', value: uniqueUsers, icon: '👥', color: '#3b82f6' },
        { label: 'Importantes', value: importants, icon: '⭐', color: '#b8860b' },
        { label: 'Com lembrete', value: withReminder, icon: '📅', color: '#27ae60' },
        { label: 'Lembretes vencidos', value: overdue, icon: '⏰', color: '#c0392b' },
      ].map(s => (
        <div key={s.label} className="bg-white rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.06)] border border-[#f0f0f0] px-4 py-3 flex-[1_1_100px] text-center min-w-[90px]">
          <div className="text-[1.2rem]">{s.icon}</div>
          <div className="text-[1.5rem] font-extrabold leading-[1.2] mt-[2px]" style={{ color: s.color }}>
            {s.value}
          </div>
          <div className="text-[.67rem] text-[#bbb] mt-[2px]">{s.label}</div>
        </div>
      ))}
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────
export default function AdminDiarioPage() {
  const router = useRouter();

  const [entries,       setEntries]       = useState<DiaryEntry[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [search,        setSearch]        = useState('');
  const [activeTag,     setActiveTag]     = useState('');
  const [importantOnly, setImportantOnly] = useState(false);
  const [reminderOnly,  setReminderOnly]  = useState(false);
  const [toast,         setToast]         = useState('');
  const [authorized,    setAuthorized]    = useState(false);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  // ── Auth check ─────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const { data: { session } } = await sb.auth.getSession();
      if (!session) { router.push('/login'); return; }

      const email = session.user.email ?? '';
      if (!ADMIN_EMAILS.includes(email)) {
        router.push('/admin');
        return;
      }

      setAuthorized(true);
      await loadAll();
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    const res  = await fetch('/api/diario?admin=true');
    const json = await res.json();
    setEntries(json.data ?? []);
    setLoading(false);
  }, []);

  const handleDelete = async (id: string) => {
    await fetch(`/api/diario/${id}`, { method: 'DELETE' });
    setEntries(prev => prev.filter(e => e.id !== id));
    showToast('🗑️ Anotação removida.');
  };

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
        e.tags?.some(t => t.toLowerCase().includes(q)) ||
        e.user_id.includes(q),
      );
    }

    if (activeTag) result = result.filter(e => e.tags?.includes(activeTag));
    if (importantOnly) result = result.filter(e => e.is_important);
    if (reminderOnly) result = result.filter(e => !!e.reminder_date);

    return result;
  }, [entries, search, activeTag, importantOnly, reminderOnly]);

  if (!authorized && !loading) return null;

  return (
    <div className="min-h-screen bg-[#f7f7f8] px-6 py-8">
      <div className="max-w-[960px] mx-auto">

        {/* ── Cabeçalho ──────────────────────────────────────────── */}
        <div className="mb-6">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-[1.6rem] font-extrabold text-[#111] m-0">
                📒 Diário Inteligente — Admin
              </h1>
              <p className="text-[.88rem] text-[#888] mt-[6px] mb-0">
                Visualização global de todas as anotações da plataforma.
              </p>
            </div>
            <a
              href="/admin"
              className="bg-[#f5f5f5] border border-[#eee] rounded-[10px] px-4 py-2 text-[.82rem] text-[#555] no-underline font-medium"
            >
              ← Voltar ao Admin
            </a>
          </div>
        </div>

        {/* ── Stats ──────────────────────────────────────────────── */}
        <AdminStatsBar entries={entries} />

        {/* ── Busca ──────────────────────────────────────────────── */}
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

        {/* ── Tags populares ────────────────────────────────────── */}
        {entries.length > 0 && (() => {
          const tagCounts: Record<string, number> = {};
          entries.flatMap(e => e.tags ?? []).forEach(t => {
            tagCounts[t] = (tagCounts[t] ?? 0) + 1;
          });
          const top = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]).slice(0, 15);

          return top.length > 0 ? (
            <div className="bg-white rounded-[14px] shadow-[0_2px_12px_rgba(0,0,0,0.05)] border border-[#f0f0f0] px-4 py-[14px] mb-5">
              <div className="text-[.75rem] font-bold text-[#bbb] mb-2 uppercase tracking-[.06em]">
                Tags mais usadas na plataforma
              </div>
              <div className="flex flex-wrap gap-[6px]">
                {top.map(([tag, count]) => (
                  <button
                    key={tag}
                    onClick={() => setActiveTag(activeTag === tag ? '' : tag)}
                    className={`border border-[rgba(124,58,237,.15)] rounded-[20px] px-[10px] py-[3px] text-[.75rem] font-semibold cursor-pointer transition-all duration-[150ms] ${activeTag === tag ? 'bg-[#7c3aed] text-white' : 'bg-[#f5f0ff] text-[#7c3aed]'}`}
                  >
                    #{tag} <span className="opacity-70">{count}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : null;
        })()}

        {/* ── Lista ──────────────────────────────────────────────── */}
        <DiarioList
          entries={filtered}
          loading={loading}
          onTagClick={tag => setActiveTag(activeTag === tag ? '' : tag)}
          onDelete={handleDelete}
          onToggleImportant={handleToggleImportant}
          showUser
        />

        {/* ── Toast ──────────────────────────────────────────────── */}
        {toast && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-[#222] text-white rounded-[10px] px-5 py-[10px] text-[.88rem] font-medium shadow-[0_4px_20px_rgba(0,0,0,0.2)] z-[9999]">
            {toast}
          </div>
        )}
      </div>
    </div>
  );
}
