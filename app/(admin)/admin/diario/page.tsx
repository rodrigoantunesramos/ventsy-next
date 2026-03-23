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
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
      {[
        { label: 'Total de anotações', value: entries.length, icon: '📒', color: '#ff385c' },
        { label: 'Usuários ativos', value: uniqueUsers, icon: '👥', color: '#3b82f6' },
        { label: 'Importantes', value: importants, icon: '⭐', color: '#b8860b' },
        { label: 'Com lembrete', value: withReminder, icon: '📅', color: '#27ae60' },
        { label: 'Lembretes vencidos', value: overdue, icon: '⏰', color: '#c0392b' },
      ].map(s => (
        <div key={s.label} style={{
          background: '#fff', borderRadius: 12,
          boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
          border: '1px solid #f0f0f0',
          padding: '12px 16px', flex: '1 1 100px', textAlign: 'center', minWidth: 90,
        }}>
          <div style={{ fontSize: '1.2rem' }}>{s.icon}</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: s.color, lineHeight: 1.2, marginTop: 2 }}>
            {s.value}
          </div>
          <div style={{ fontSize: '.67rem', color: '#bbb', marginTop: 2 }}>{s.label}</div>
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
    <div style={{ minHeight: '100vh', background: '#f7f7f8', padding: '32px 24px' }}>
      <div style={{ maxWidth: 960, margin: '0 auto' }}>

        {/* ── Cabeçalho ──────────────────────────────────────────── */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#111', margin: 0 }}>
                📒 Diário Inteligente — Admin
              </h1>
              <p style={{ fontSize: '.88rem', color: '#888', margin: '6px 0 0' }}>
                Visualização global de todas as anotações da plataforma.
              </p>
            </div>
            <a
              href="/admin"
              style={{
                background: '#f5f5f5', border: '1px solid #eee',
                borderRadius: 10, padding: '8px 16px',
                fontSize: '.82rem', color: '#555', textDecoration: 'none',
                fontWeight: 500,
              }}
            >
              ← Voltar ao Admin
            </a>
          </div>
        </div>

        {/* ── Stats ──────────────────────────────────────────────── */}
        <AdminStatsBar entries={entries} />

        {/* ── Busca ──────────────────────────────────────────────── */}
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

        {/* ── Tags populares ────────────────────────────────────── */}
        {entries.length > 0 && (() => {
          const tagCounts: Record<string, number> = {};
          entries.flatMap(e => e.tags ?? []).forEach(t => {
            tagCounts[t] = (tagCounts[t] ?? 0) + 1;
          });
          const top = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]).slice(0, 15);

          return top.length > 0 ? (
            <div style={{
              background: '#fff', borderRadius: 14,
              boxShadow: '0 2px 12px rgba(0,0,0,0.05)',
              border: '1px solid #f0f0f0',
              padding: '14px 16px', marginBottom: 20,
            }}>
              <div style={{ fontSize: '.75rem', fontWeight: 700, color: '#bbb', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.06em' }}>
                Tags mais usadas na plataforma
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {top.map(([tag, count]) => (
                  <button
                    key={tag}
                    onClick={() => setActiveTag(activeTag === tag ? '' : tag)}
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
          <div style={{
            position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
            background: '#222', color: '#fff', borderRadius: 10,
            padding: '10px 20px', fontSize: '.88rem', fontWeight: 500,
            boxShadow: '0 4px 20px rgba(0,0,0,0.2)', zIndex: 9999,
          }}>
            {toast}
          </div>
        )}
      </div>
    </div>
  );
}
