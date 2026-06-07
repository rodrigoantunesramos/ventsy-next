'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase as sb, authHeaders } from '@/lib/supabase';
import { DiaryEntry, DiaryFormData, LeadRef } from '@/types/diario';
import DiarioEditor      from '@/components/diario/DiarioEditor';
import DiarioBusca       from '@/components/diario/DiarioBusca';
import DiarioList        from '@/components/diario/DiarioList';
import DiarioStatsBar    from '@/components/diario/DiarioStatsBar';
import DiarioPopularTags from '@/components/diario/DiarioPopularTags';
import DiarioReminders   from '@/components/diario/DiarioReminders';

export default function DiarioPage() {
  const router = useRouter();

  const [userId,        setUserId]        = useState('');
  const [entries,       setEntries]       = useState<DiaryEntry[]>([]);
  const [leads,         setLeads]         = useState<LeadRef[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [saving,        setSaving]        = useState(false);
  const [search,        setSearch]        = useState('');
  const [activeTag,     setActiveTag]     = useState('');
  const [activeLead,    setActiveLead]    = useState<LeadRef | null>(null);
  const [importantOnly, setImportantOnly] = useState(false);
  const [reminderOnly,  setReminderOnly]  = useState(false);
  const [toast,         setToast]         = useState('');
  const [aiSummary,     setAiSummary]     = useState('');
  const [aiBusy,        setAiBusy]        = useState(false);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }, []);

  const loadEntries = useCallback(async (uid: string) => {
    setLoading(true);
    const [entriesRes, leadsRes] = await Promise.all([
      fetch(`/api/diario?user_id=${uid}`, { headers: await authHeaders() }).then(r => r.json()),
      sb.from('clientes_eventos')
        .select('id, nome_evento, quem_contratou, status')
        .eq('usuario_id', uid)
        .order('nome_evento'),
    ]);
    setEntries(entriesRes.data ?? []);
    setLeads((leadsRes.data as LeadRef[]) ?? []);
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

  // ── Salvar nova anotação ───────────────────────────────────────────────────
  const handleSave = async (form: DiaryFormData) => {
    setSaving(true);
    try {
      const res  = await fetch('/api/diario', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
        body:    JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok || json.error) { showToast('Erro ao salvar. Tente novamente.'); return; }
      setEntries(prev => [json.data, ...prev]);
      showToast('✅ Anotação salva!');
    } catch {
      showToast('Erro de conexão. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  // ── Editar (com rollback otimista) ─────────────────────────────────────────
  const handleEdit = async (id: string, data: Partial<DiaryEntry>) => {
    const prev = entries;
    setEntries(p => p.map(e => e.id === id ? { ...e, ...data } : e));
    try {
      const res  = await fetch(`/api/diario/${id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
        body:    JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok || json.error) { setEntries(prev); showToast('Erro ao atualizar. Alteração desfeita.'); return; }
      setEntries(p => p.map(e => e.id === id ? json.data : e));
      showToast('✅ Anotação atualizada!');
    } catch {
      setEntries(prev);
      showToast('Erro de conexão. Alteração desfeita.');
    }
  };

  // ── Concluir lembrete (limpa reminder_date) ────────────────────────────────
  const handleResolveReminder = async (id: string) => {
    const prev = entries;
    setEntries(p => p.map(e => e.id === id ? { ...e, reminder_date: null } : e));
    try {
      const res  = await fetch(`/api/diario/${id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
        body:    JSON.stringify({ reminder_date: null }),
      });
      const json = await res.json();
      if (!res.ok || json.error) { setEntries(prev); showToast('Erro ao concluir lembrete.'); return; }
      setEntries(p => p.map(e => e.id === id ? json.data : e));
      showToast('✅ Lembrete concluído!');
    } catch {
      setEntries(prev);
      showToast('Erro de conexão.');
    }
  };

  // ── Deletar (com rollback otimista) ────────────────────────────────────────
  const handleDelete = async (id: string) => {
    const prev = entries;
    setEntries(p => p.filter(e => e.id !== id));
    try {
      const res  = await fetch(`/api/diario/${id}`, { method: 'DELETE', headers: await authHeaders() });
      const json = await res.json();
      if (!res.ok || json.error) { setEntries(prev); showToast('Erro ao remover. Restaurado.'); return; }
      showToast('🗑️ Anotação removida.');
    } catch {
      setEntries(prev);
      showToast('Erro de conexão. Restaurado.');
    }
  };

  // ── Marcar importante (com rollback otimista) ──────────────────────────────
  const handleToggleImportant = async (id: string, current: boolean) => {
    const prev = entries;
    setEntries(p => p.map(e => e.id === id ? { ...e, is_important: !current } : e));
    try {
      const res  = await fetch(`/api/diario/${id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
        body:    JSON.stringify({ is_important: !current }),
      });
      const json = await res.json();
      if (!res.ok || json.error) { setEntries(prev); showToast('Erro ao atualizar.'); return; }
      setEntries(p => p.map(e => e.id === id ? json.data : e));
    } catch {
      setEntries(prev);
      showToast('Erro de conexão.');
    }
  };

  // ── IA: sugerir tags a partir do texto ─────────────────────────────────────
  const aiSuggestTags = async (content: string): Promise<string[]> => {
    try {
      const res  = await fetch('/api/diario/ai', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
        body:    JSON.stringify({ action: 'tags', content }),
      });
      const json = await res.json();
      if (json.code === 'NO_KEY') { showToast('✨ IA não configurada (AI_GATEWAY_API_KEY).'); return []; }
      if (json.error) { showToast('Erro na IA. Tente novamente.'); return []; }
      return json.tags ?? [];
    } catch {
      showToast('Erro de conexão com a IA.');
      return [];
    }
  };

  // ── IA: resumir relacionamento do evento + sugerir follow-up ───────────────
  const runAiSummary = async (leadId: string) => {
    setAiBusy(true);
    setAiSummary('');
    try {
      const res  = await fetch('/api/diario/ai', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
        body:    JSON.stringify({ action: 'summary', lead_id: leadId }),
      });
      const json = await res.json();
      if (json.code === 'NO_KEY') { showToast('✨ IA não configurada (AI_GATEWAY_API_KEY).'); return; }
      if (json.error) { showToast('Erro na IA. Tente novamente.'); return; }
      setAiSummary(json.summary ?? '');
    } catch {
      showToast('Erro de conexão com a IA.');
    } finally {
      setAiBusy(false);
    }
  };

  // ── Filtros ────────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let result = entries;
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(e =>
        e.content.toLowerCase().includes(q) ||
        e.tags?.some(t => t.toLowerCase().includes(q)) ||
        e.lead?.nome_evento.toLowerCase().includes(q)
      );
    }
    if (activeTag)     result = result.filter(e => e.tags?.includes(activeTag));
    if (activeLead)    result = result.filter(e => e.lead_id === activeLead.id);
    if (importantOnly) result = result.filter(e => e.is_important);
    if (reminderOnly)  result = result.filter(e => !!e.reminder_date);
    return result;
  }, [entries, search, activeTag, activeLead, importantOnly, reminderOnly]);

  const existingTags = useMemo(() =>
    [...new Set(entries.flatMap(e => e.tags ?? []))],
  [entries]);

  const toggleTag  = (tag: string) => setActiveTag(prev => prev === tag ? '' : tag);
  const filterLead = (leadId: string) => {
    setAiSummary('');
    setActiveLead(prev => prev?.id === leadId ? null : (leads.find(l => l.id === leadId) ?? null));
  };

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
        <DiarioReminders
          entries={entries}
          onResolve={handleResolveReminder}
          onOpenLead={filterLead}
        />
      </div>

      <div className="mb-5">
        <DiarioEditor
          existingTags={existingTags}
          leads={leads}
          onSave={handleSave}
          onAiSuggestTags={aiSuggestTags}
          saving={saving}
        />
      </div>

      <div className="mb-4">
        <DiarioBusca
          search={search}             onSearchChange={setSearch}
          activeTag={activeTag}       onTagClear={() => setActiveTag('')}
          activeLeadLabel={activeLead?.nome_evento}
          onLeadClear={() => setActiveLead(null)}
          total={entries.length}      filtered={filtered.length}
          onImportantOnly={setImportantOnly} importantOnly={importantOnly}
          onReminderOnly={setReminderOnly}   reminderOnly={reminderOnly}
        />
      </div>

      {entries.length > 0 && (
        <div className="mb-5">
          <DiarioPopularTags entries={entries} activeTag={activeTag} onTagClick={toggleTag} />
        </div>
      )}

      {activeLead && (
        <div className="mb-5 overflow-hidden rounded-2xl border border-violet-200 bg-violet-50/50 shadow-card">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-violet-100 bg-violet-50 px-4 py-3">
            <span className="text-[.85rem] font-bold text-violet-800">
              🔗 {activeLead.nome_evento} <span className="font-normal text-violet-600">· {activeLead.quem_contratou}</span>
            </span>
            <button
              onClick={() => runAiSummary(activeLead.id)}
              disabled={aiBusy}
              className="cursor-pointer rounded-lg border border-violet-300 bg-white px-3 py-[6px] text-[.8rem] font-semibold text-violet-700 transition-colors hover:bg-violet-100 disabled:opacity-60"
            >
              {aiBusy ? '✨ Analisando…' : '✨ Resumir relacionamento (IA)'}
            </button>
          </div>
          {aiSummary && (
            <div className="whitespace-pre-wrap px-4 py-3 text-[.88rem] leading-[1.6] text-ink-soft">
              {aiSummary}
            </div>
          )}
        </div>
      )}

      <DiarioList
        entries={filtered}
        loading={loading}
        leads={leads}
        onTagClick={toggleTag}
        onLeadClick={filterLead}
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
