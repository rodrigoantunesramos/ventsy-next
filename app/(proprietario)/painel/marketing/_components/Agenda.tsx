'use client';

// Agenda de conteúdo/ações (/painel/marketing · aba Agenda).
// Calendário mensal com ações de marketing (post, anúncio, parceria, evento,
// e-mail) — ARRASTAR para reagendar (HTML5 drag-and-drop → onMove) e clicar
// para editar. Campanhas agendadas/enviadas (de /painel/campanhas) aparecem
// sobrepostas em modo leitura. Persiste em marketing_acoes via callbacks do
// painel. Sem "R$" hardcoded — símbolo de moeda vem do i18n (moedaSimbolo).

import { useMemo, useState, useEffect } from 'react';
import { formatMonth, getFormatPrefs } from '@/lib/format';
import {
  type Acao, type Canal, type TipoAcao, type StatusAcao,
  TIPOS_ACAO, STATUS_ACAO, TIPO_ACAO_BY, gradeDoMes, acoesPorDia, validarAcao, ymd,
} from '@/lib/marketing';
import { moedaSimbolo, IcoPlus, IcoX, IcoTrash, IcoChevronL, IcoChevronR } from './ui';

const inp = 'w-full rounded-xl border border-black/10 bg-white px-3.5 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20';

// Item de campanha sobreposto (somente leitura) no calendário.
export type CampanhaCal = { id: string; nome: string; data: string; tipo: 'agendada' | 'enviada' };

type FormState = {
  id: string | null; titulo: string; tipo: TipoAcao; canal_id: string; data: string;
  status: StatusAcao; investimento: string; alcance: string; cliques: string; leads: string; obs: string;
};
function emptyForm(data: string): FormState {
  return { id: null, titulo: '', tipo: 'post', canal_id: '', data, status: 'planejado', investimento: '', alcance: '', cliques: '', leads: '', obs: '' };
}
function formFromAcao(a: Acao): FormState {
  const r = a.resultado || {};
  return {
    id: a.id, titulo: a.titulo, tipo: a.tipo, canal_id: a.canal_id || '', data: (a.data || '').slice(0, 10),
    status: a.status, investimento: a.investimento_num ? String(a.investimento_num) : '',
    alcance: r.alcance != null ? String(r.alcance) : '', cliques: r.cliques != null ? String(r.cliques) : '',
    leads: r.leads != null ? String(r.leads) : '', obs: r.obs || '',
  };
}

export function Agenda({
  acoes, canais, campanhas, now, onSave, onDelete, onMove,
}: {
  acoes: Acao[];
  canais: Canal[];
  campanhas: CampanhaCal[];
  now: Date;
  onSave: (payload: {
    id: string | null; titulo: string; tipo: TipoAcao; canal_id: string | null; data: string;
    status: StatusAcao; investimento_num: number; resultado: Record<string, number | string>;
  }) => Promise<boolean>;
  onDelete: (id: string) => Promise<void>;
  onMove: (id: string, data: string) => Promise<void>;
}) {
  const [ano, setAno] = useState(now.getFullYear());
  const [mes, setMes] = useState(now.getMonth());
  const [dragId, setDragId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [erros, setErros] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const { locale } = getFormatPrefs();
  const weekdays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(new Date(2024, 0, 7 + i))),
    [locale],
  );
  const grade = useMemo(() => gradeDoMes(ano, mes), [ano, mes]);
  const porDia = useMemo(() => acoesPorDia(acoes), [acoes]);
  const campPorDia = useMemo(() => {
    const m = new Map<string, CampanhaCal[]>();
    for (const c of campanhas) { const k = (c.data || '').slice(0, 10); if (!k) continue; const arr = m.get(k); if (arr) arr.push(c); else m.set(k, [c]); }
    return m;
  }, [campanhas]);
  const hoje = ymd(now);

  useEffect(() => {
    if (!form) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setForm(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [form]);

  function navega(delta: number) {
    const d = new Date(ano, mes + delta, 1);
    setAno(d.getFullYear()); setMes(d.getMonth());
  }
  function abrirNovo(data: string) { setErros([]); setForm(emptyForm(data)); }
  function abrirEdicao(a: Acao) { setErros([]); setForm(formFromAcao(a)); }

  async function salvar() {
    if (!form) return;
    const investimento_num = Number(form.investimento) || 0;
    const errs = validarAcao({ titulo: form.titulo, data: form.data, investimento_num });
    if (errs.length) { setErros(errs); return; }
    setSaving(true);
    const resultado: Record<string, number | string> = {};
    if (form.alcance) resultado.alcance = Number(form.alcance) || 0;
    if (form.cliques) resultado.cliques = Number(form.cliques) || 0;
    if (form.leads) resultado.leads = Number(form.leads) || 0;
    if (form.obs.trim()) resultado.obs = form.obs.trim();
    const ok = await onSave({
      id: form.id, titulo: form.titulo.trim(), tipo: form.tipo, canal_id: form.canal_id || null,
      data: form.data, status: form.status, investimento_num, resultado,
    });
    setSaving(false);
    if (ok) setForm(null);
  }

  async function excluir() {
    if (!form?.id) return;
    setSaving(true);
    await onDelete(form.id);
    setSaving(false);
    setForm(null);
  }

  async function soltarEm(data: string) {
    if (dragId) { const id = dragId; setDragId(null); await onMove(id, data); }
  }

  return (
    <div className="mt-4 rounded-2xl bg-white p-4 shadow-card sm:p-5">
      {/* Cabeçalho do mês */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-1">
          <button onClick={() => navega(-1)} aria-label="Mês anterior" className="rounded-lg p-2 text-ink-muted hover:bg-black/[0.04] hover:text-brand"><IcoChevronL /></button>
          <h3 className="min-w-[140px] text-center text-base font-bold capitalize text-ink">{formatMonth(new Date(ano, mes, 1), { withYear: true })}</h3>
          <button onClick={() => navega(1)} aria-label="Próximo mês" className="rounded-lg p-2 text-ink-muted hover:bg-black/[0.04] hover:text-brand"><IcoChevronR /></button>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { setAno(now.getFullYear()); setMes(now.getMonth()); }} className="rounded-lg border border-black/10 px-3 py-1.5 text-xs font-semibold text-ink-soft hover:border-brand/30 hover:text-brand">Hoje</button>
          <button onClick={() => abrirNovo(hoje)} className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-3 py-2 text-sm font-semibold text-white hover:bg-brand-600"><IcoPlus /> Nova ação</button>
        </div>
      </div>

      {/* Dias da semana */}
      <div className="grid grid-cols-7 gap-1 text-center text-[0.65rem] font-semibold uppercase tracking-wide text-ink-muted">
        {weekdays.map((w, i) => <div key={i} className="py-1">{w}</div>)}
      </div>

      {/* Grade */}
      <div className="mt-1 grid grid-cols-7 gap-1">
        {grade.map((cel) => {
          const acoesDia = porDia.get(cel.ymd) || [];
          const campsDia = campPorDia.get(cel.ymd) || [];
          const isHoje = cel.ymd === hoje;
          return (
            <div
              key={cel.ymd}
              onDragOver={(e) => { if (dragId) e.preventDefault(); }}
              onDrop={() => soltarEm(cel.ymd)}
              className={`group min-h-[92px] rounded-xl border p-1.5 text-left transition ${cel.mesAtual ? 'border-black/[0.06] bg-white' : 'border-transparent bg-black/[0.015]'} ${dragId ? 'hover:border-brand/40 hover:bg-brand-50/40' : ''}`}
            >
              <div className="mb-1 flex items-center justify-between">
                <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[0.7rem] font-semibold ${isHoje ? 'bg-brand text-white' : cel.mesAtual ? 'text-ink-soft' : 'text-ink-muted/50'}`}>{cel.dia}</span>
                {cel.mesAtual && <button onClick={() => abrirNovo(cel.ymd)} aria-label="Adicionar ação" className="opacity-0 transition group-hover:opacity-100"><span className="flex h-5 w-5 items-center justify-center rounded-full text-ink-muted hover:bg-brand-50 hover:text-brand"><IcoPlus size={12} /></span></button>}
              </div>
              <div className="space-y-1">
                {acoesDia.map((a) => {
                  const t = TIPO_ACAO_BY[a.tipo];
                  return (
                    <button
                      key={a.id}
                      draggable
                      onDragStart={() => setDragId(a.id)}
                      onDragEnd={() => setDragId(null)}
                      onClick={() => abrirEdicao(a)}
                      title={`${a.titulo}`}
                      className={`flex w-full cursor-grab items-center gap-1 truncate rounded-md px-1.5 py-1 text-left text-[0.7rem] font-medium active:cursor-grabbing ${t.cls} ${a.status === 'cancelado' ? 'line-through opacity-60' : ''}`}
                    >
                      <span aria-hidden>{t.icon}</span><span className="truncate">{a.titulo}</span>
                    </button>
                  );
                })}
                {campsDia.map((c) => (
                  <div key={c.id} title={`Campanha: ${c.nome}`} className="flex items-center gap-1 truncate rounded-md bg-brand-50 px-1.5 py-1 text-[0.7rem] font-medium text-brand">
                    <span aria-hidden>📨</span><span className="truncate">{c.nome}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-3 text-xs text-ink-muted">Arraste uma ação para outro dia para reagendar. <span aria-hidden>📨</span> são campanhas (de <span className="font-medium">Campanhas</span>).</p>

      {/* Modal de ação */}
      {form && (
        <div className="fixed inset-0 z-[10000] flex items-start justify-center overflow-y-auto bg-black/50 p-4" onClick={() => setForm(null)}>
          <div className="relative my-8 w-full max-w-md rounded-2xl bg-white p-6 shadow-pop" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setForm(null)} aria-label="Fechar" className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full border border-black/10 text-ink-muted hover:bg-black/[0.03]"><IcoX /></button>
            <h3 className="mb-5 font-display text-xl font-bold text-ink">{form.id ? 'Editar ação' : 'Nova ação'}</h3>
            <div className="space-y-4">
              <label className="block"><span className="mb-1.5 block text-sm font-semibold text-ink-soft">Título</span><input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} className={inp} autoFocus placeholder="Ex: Reels do salão decorado" /></label>
              <div className="grid grid-cols-2 gap-4">
                <label className="block"><span className="mb-1.5 block text-sm font-semibold text-ink-soft">Tipo</span><select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value as TipoAcao })} className={inp}>{TIPOS_ACAO.map((t) => <option key={t.v} value={t.v}>{t.icon} {t.label}</option>)}</select></label>
                <label className="block"><span className="mb-1.5 block text-sm font-semibold text-ink-soft">Canal</span><select value={form.canal_id} onChange={(e) => setForm({ ...form, canal_id: e.target.value })} className={inp}><option value="">—</option>{canais.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></label>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <label className="block"><span className="mb-1.5 block text-sm font-semibold text-ink-soft">Data</span><input type="date" value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} className={inp} /></label>
                <label className="block"><span className="mb-1.5 block text-sm font-semibold text-ink-soft">Status</span><select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as StatusAcao })} className={inp}>{STATUS_ACAO.map((s) => <option key={s.v} value={s.v}>{s.label}</option>)}</select></label>
              </div>
              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold text-ink-soft">Investimento</span>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-ink-muted">{moedaSimbolo()}</span>
                  <input type="number" min={0} step="0.01" value={form.investimento} onChange={(e) => setForm({ ...form, investimento: e.target.value })} className={`${inp} pl-10`} placeholder="0,00" />
                </div>
              </label>
              <div>
                <span className="mb-1.5 block text-sm font-semibold text-ink-soft">Resultado <span className="font-normal text-ink-muted">(opcional)</span></span>
                <div className="grid grid-cols-3 gap-2">
                  <label className="block"><span className="mb-1 block text-[0.7rem] text-ink-muted">Alcance</span><input type="number" min={0} value={form.alcance} onChange={(e) => setForm({ ...form, alcance: e.target.value })} className={inp} /></label>
                  <label className="block"><span className="mb-1 block text-[0.7rem] text-ink-muted">Cliques</span><input type="number" min={0} value={form.cliques} onChange={(e) => setForm({ ...form, cliques: e.target.value })} className={inp} /></label>
                  <label className="block"><span className="mb-1 block text-[0.7rem] text-ink-muted">Leads</span><input type="number" min={0} value={form.leads} onChange={(e) => setForm({ ...form, leads: e.target.value })} className={inp} /></label>
                </div>
              </div>
              <label className="block"><span className="mb-1.5 block text-sm font-semibold text-ink-soft">Observação</span><input value={form.obs} onChange={(e) => setForm({ ...form, obs: e.target.value })} className={inp} placeholder="Briefing, parceiro, link…" /></label>
              {erros.length > 0 && <ul className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-600">{erros.map((e) => <li key={e}>• {e}</li>)}</ul>}
            </div>
            <div className="mt-6 flex items-center gap-3">
              <button onClick={salvar} disabled={saving} className="rounded-xl bg-brand px-6 py-3 text-sm font-bold text-white transition hover:bg-brand-600 disabled:opacity-60">{saving ? 'Salvando…' : form.id ? 'Salvar' : 'Criar ação'}</button>
              {form.id && <button onClick={excluir} disabled={saving} className="inline-flex items-center gap-1.5 rounded-xl border border-black/10 px-3 py-3 text-sm font-medium text-red-600 hover:bg-red-50"><IcoTrash /> Excluir</button>}
              <button onClick={() => setForm(null)} className="ml-auto text-sm font-medium text-ink-muted hover:text-ink">Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
