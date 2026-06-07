'use client';

// Calendário de disponibilidade — /painel/calendario.
// Consolida a versão React de (public)/calendario (modelo de dados correto:
// disponibilidade com bloqueado/preco/min_horas, upsert por prop_id,data) com
// a UX da versão legada (ações rápidas + painel-resumo + lista de bloqueios).
// Substitui (public)/calendario e dashboard/modules/calendario.js.

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { supabaseAny as sb } from '@/lib/supabase';
import { formatMoney } from '@/lib/format';

type Prop = { id: number; nome: string | null; valor_hora: number | null; valor_base: number | null };
type Disp = {
  prop_id: number;
  data: string;
  motivo: string | null;
  bloqueado: boolean;
  preco: number | null;
  min_horas: number | null;
};

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function CalendarioPage() {
  const [props, setProps] = useState<Prop[]>([]);
  const [selProp, setSelProp] = useState<number | ''>('');
  const [cursor, setCursor] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [dispMap, setDispMap] = useState<Record<string, Disp>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [editDay, setEditDay] = useState<string | null>(null);
  const [fBloq, setFBloq] = useState(false);
  const [fPreco, setFPreco] = useState('');
  const [fMin, setFMin] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await sb.auth.getSession();
      if (!session) { setLoading(false); return; }
      const { data } = await sb
        .from('propriedades')
        .select('id,nome,valor_hora,valor_base')
        .eq('usuario_id', session.user.id)
        .order('id');
      const list = (data || []) as Prop[];
      setProps(list);
      if (list.length) setSelProp(list[0].id);
      setLoading(false);
    })();
  }, []);

  const loadMonth = useCallback(async (propId: number, monthStart: Date) => {
    const first = ymd(new Date(monthStart.getFullYear(), monthStart.getMonth(), 1));
    const last = ymd(new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0));
    const { data } = await sb.from('disponibilidade').select('*').eq('prop_id', propId).gte('data', first).lte('data', last);
    const map: Record<string, Disp> = {};
    (data || []).forEach((r: Disp) => { map[r.data] = r; });
    setDispMap(map);
  }, []);

  useEffect(() => {
    if (selProp === '') return;
    loadMonth(selProp as number, cursor);
  }, [selProp, cursor, loadMonth]);

  const selPropObj = props.find((p) => p.id === selProp);
  const precoBase = selPropObj ? (selPropObj.valor_hora || selPropObj.valor_base || 0) : 0;
  const precoLabel = selPropObj?.valor_hora ? '/h' : '';

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (string | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(ymd(new Date(year, month, d)));
  const todayStr = ymd(new Date());

  // Resumo do mês
  const diasNoMes = Object.values(dispMap);
  const numBloq = diasNoMes.filter((r) => r.bloqueado).length;
  const numPreco = diasNoMes.filter((r) => !r.bloqueado && r.preco != null).length;
  const numLivres = daysInMonth - numBloq;
  const bloqueados = diasNoMes.filter((r) => r.bloqueado).sort((a, b) => a.data.localeCompare(b.data));

  const irMes = (delta: number) => setCursor(new Date(year, month + delta, 1));

  function openDay(dateStr: string) {
    const r = dispMap[dateStr];
    setEditDay(dateStr);
    setFBloq(r ? r.bloqueado : false);
    setFPreco(r?.preco != null ? String(r.preco) : '');
    setFMin(r?.min_horas != null ? String(r.min_horas) : '');
  }

  async function salvar() {
    if (!editDay || selProp === '') return;
    setSaving(true);
    const row: Disp = {
      prop_id: selProp as number,
      data: editDay,
      bloqueado: fBloq,
      preco: !fBloq && fPreco ? Number(fPreco) : null,
      min_horas: !fBloq && fMin ? Number(fMin) : null,
      motivo: fBloq ? 'Bloqueado pelo anfitrião' : null,
    };
    const { error } = await sb.from('disponibilidade').upsert(row, { onConflict: 'prop_id,data' });
    setSaving(false);
    if (!error) { setDispMap((m) => ({ ...m, [editDay]: row })); setEditDay(null); }
  }

  async function limpar(dateStr: string) {
    if (selProp === '') return;
    await sb.from('disponibilidade').delete().eq('prop_id', selProp).eq('data', dateStr);
    setDispMap((m) => { const n = { ...m }; delete n[dateStr]; return n; });
    if (editDay === dateStr) setEditDay(null);
  }

  async function bloquearFimsDeSemana() {
    if (selProp === '') return;
    setBusy(true);
    const rows: Disp[] = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month, d);
      const k = ymd(date);
      const wd = date.getDay();
      if ((wd === 0 || wd === 6) && k >= todayStr && !dispMap[k]?.bloqueado) {
        rows.push({ prop_id: selProp as number, data: k, bloqueado: true, preco: null, min_horas: null, motivo: 'Fim de semana' });
      }
    }
    if (rows.length) {
      await sb.from('disponibilidade').upsert(rows, { onConflict: 'prop_id,data' });
      await loadMonth(selProp as number, cursor);
    }
    setBusy(false);
  }

  async function liberarMes() {
    if (selProp === '' || numBloq === 0) return;
    if (!confirm(`Liberar todos os ${numBloq} dia(s) bloqueado(s) de ${MESES[month]}? Esta ação não pode ser desfeita.`)) return;
    setBusy(true);
    const first = ymd(new Date(year, month, 1));
    const last = ymd(new Date(year, month + 1, 0));
    await sb.from('disponibilidade').delete().eq('prop_id', selProp).gte('data', first).lte('data', last).eq('bloqueado', true);
    await loadMonth(selProp as number, cursor);
    setBusy(false);
  }

  const dataLonga = editDay
    ? new Date(editDay + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })
    : '';

  return (
    <div className="mx-auto max-w-6xl">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink sm:text-2xl">Calendário</h1>
          <p className="mt-1 text-sm text-ink-muted">Bloqueie datas, defina preço especial e mínimo de horas por dia.</p>
        </div>
        {props.length > 1 && (
          <select
            value={selProp}
            onChange={(e) => setSelProp(Number(e.target.value))}
            className="rounded-xl border border-black/10 bg-white px-3.5 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
          >
            {props.map((p) => <option key={p.id} value={p.id}>{p.nome || `Espaço #${p.id}`}</option>)}
          </select>
        )}
      </div>

      {loading ? (
        <div className="mt-6 h-[420px] animate-pulse rounded-2xl bg-black/[0.05]" />
      ) : props.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-brand/30 bg-white p-8 text-center shadow-card">
          <p className="mb-4 text-sm text-ink-soft">Cadastre um espaço para gerenciar a disponibilidade.</p>
          <Link href="/anunciar" className="inline-flex rounded-full bg-brand px-6 py-3 text-sm font-semibold text-white hover:bg-brand-600">
            Anunciar meu espaço
          </Link>
        </div>
      ) : (
        <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-[1fr_300px]">
          {/* Calendário */}
          <div className="rounded-2xl bg-white p-5 shadow-card">
            <div className="mb-4 flex items-center justify-between">
              <button onClick={() => irMes(-1)} className="flex h-9 w-9 items-center justify-center rounded-full border border-black/10 text-ink-soft hover:bg-black/[0.03]">‹</button>
              <h2 className="font-display text-lg font-bold text-ink">{MESES[month]} {year}</h2>
              <button onClick={() => irMes(1)} className="flex h-9 w-9 items-center justify-center rounded-full border border-black/10 text-ink-soft hover:bg-black/[0.03]">›</button>
            </div>

            <div className="mb-1.5 grid grid-cols-7 gap-1.5">
              {DIAS.map((d) => <div key={d} className="py-1 text-center text-xs font-bold text-ink-muted">{d}</div>)}
            </div>

            <div className="grid grid-cols-7 gap-1.5">
              {cells.map((dateStr, i) => {
                if (!dateStr) return <div key={`b${i}`} />;
                const r = dispMap[dateStr];
                const dia = Number(dateStr.slice(-2));
                const passado = dateStr < todayStr;
                const hoje = dateStr === todayStr;
                let cls = 'bg-white border-black/10 hover:border-brand hover:bg-brand/5 text-ink';
                if (passado) cls = 'bg-black/[0.02] border-black/[0.04] text-ink-muted/40 cursor-not-allowed';
                else if (r?.bloqueado) cls = 'bg-red-50 border-red-200 text-red-700 hover:border-red-300';
                else if (r?.preco != null) cls = 'bg-emerald-50 border-emerald-200 text-emerald-800 hover:border-emerald-300';
                return (
                  <button
                    key={dateStr}
                    disabled={passado}
                    onClick={() => openDay(dateStr)}
                    className={`relative flex aspect-square flex-col items-center justify-center rounded-xl border text-sm font-semibold transition ${cls} ${hoje ? 'ring-2 ring-brand/40' : ''}`}
                  >
                    <span>{dia}</span>
                    {!passado && r?.bloqueado && <span className="mt-0.5 text-[10px] font-bold leading-none">bloq.</span>}
                    {!passado && !r?.bloqueado && r?.preco != null && (
                      <span className="mt-0.5 text-[10px] font-bold leading-none">{formatMoney(Number(r.preco), { maximumFractionDigits: 0 }).replace(/\s/g, '')}</span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Legenda */}
            <div className="mt-5 flex flex-wrap gap-4 border-t border-black/[0.06] pt-4 text-xs text-ink-muted">
              <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded border border-black/15 bg-white" /> Disponível</span>
              <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded border border-red-300 bg-red-100" /> Bloqueado</span>
              <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded border border-emerald-300 bg-emerald-100" /> Preço especial</span>
            </div>
          </div>

          {/* Painel lateral */}
          <div className="space-y-4">
            <div className="rounded-2xl bg-white p-5 shadow-card">
              <h3 className="text-sm font-bold text-ink">Resumo do mês</h3>
              <dl className="mt-3 space-y-2.5 text-sm">
                <div className="flex items-center justify-between"><dt className="text-ink-muted">Total de dias</dt><dd className="font-semibold text-ink-soft">{daysInMonth}</dd></div>
                <div className="flex items-center justify-between"><dt className="text-ink-muted">Dias livres</dt><dd className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-700">{numLivres}</dd></div>
                <div className="flex items-center justify-between"><dt className="text-ink-muted">Dias bloqueados</dt><dd className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-bold text-red-700">{numBloq}</dd></div>
                <div className="flex items-center justify-between"><dt className="text-ink-muted">Preço especial</dt><dd className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-bold text-amber-700">{numPreco}</dd></div>
              </dl>
              {precoBase > 0 && (
                <p className="mt-3 border-t border-black/[0.06] pt-3 text-xs text-ink-muted">
                  Preço base: <strong className="text-ink-soft">{formatMoney(precoBase)}{precoLabel}</strong>
                </p>
              )}
            </div>

            <div className="rounded-2xl bg-white p-5 shadow-card">
              <h3 className="text-sm font-bold text-ink">Ações rápidas</h3>
              <div className="mt-3 space-y-2">
                <button onClick={bloquearFimsDeSemana} disabled={busy} className="w-full rounded-xl border border-black/10 px-3 py-2.5 text-sm font-semibold text-ink-soft transition hover:border-brand hover:text-brand disabled:opacity-50">
                  Bloquear fins de semana
                </button>
                <button onClick={liberarMes} disabled={busy || numBloq === 0} className="w-full rounded-xl border border-black/10 px-3 py-2.5 text-sm font-semibold text-ink-soft transition hover:border-red-300 hover:text-red-600 disabled:opacity-50">
                  Liberar mês
                </button>
              </div>
            </div>

            <div className="rounded-2xl bg-white p-5 shadow-card">
              <h3 className="text-sm font-bold text-ink">Dias bloqueados</h3>
              {bloqueados.length === 0 ? (
                <p className="mt-3 text-sm text-ink-muted">Nenhum dia bloqueado neste mês.</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {bloqueados.map((r) => (
                    <li key={r.data} className="flex items-center justify-between gap-2 rounded-xl bg-black/[0.02] px-3 py-2">
                      <div>
                        <div className="text-sm font-semibold text-ink-soft">Dia {Number(r.data.slice(-2))}</div>
                        <div className="text-xs text-ink-muted">{r.motivo || 'Bloqueado'}</div>
                      </div>
                      <button onClick={() => limpar(r.data)} title="Liberar" className="flex h-7 w-7 items-center justify-center rounded-full text-ink-muted hover:bg-red-50 hover:text-red-600">✕</button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal de configuração do dia */}
      {editDay && (
        <div className="fixed inset-0 z-[10000] flex items-start justify-center overflow-y-auto bg-black/50 p-4">
          <div className="relative my-8 w-full max-w-md rounded-2xl bg-white p-6 shadow-pop">
            <button onClick={() => setEditDay(null)} className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full border border-black/10 text-ink-muted hover:bg-black/[0.03]">✕</button>
            <h3 className="mb-1 font-display text-xl font-bold capitalize text-ink">{dataLonga}</h3>
            <p className="mb-5 text-sm text-ink-muted">{selPropObj?.nome || `Espaço #${selProp}`}</p>

            <label className="mb-4 flex cursor-pointer items-center gap-3 rounded-xl border border-black/10 px-4 py-3">
              <input type="checkbox" checked={fBloq} onChange={(e) => setFBloq(e.target.checked)} className="h-4 w-4 accent-brand" />
              <span className="text-sm font-semibold text-ink-soft">Bloquear esta data (indisponível)</span>
            </label>

            {!fBloq && (
              <div className="mb-2 grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-ink-soft">Preço neste dia</label>
                  <input type="number" min={0} value={fPreco} onChange={(e) => setFPreco(e.target.value)} placeholder={precoBase ? String(precoBase) : 'base'} className="w-full rounded-xl border border-black/10 px-3.5 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-ink-soft">Mín. de horas</label>
                  <input type="number" min={0} value={fMin} onChange={(e) => setFMin(e.target.value)} placeholder="—" className="w-full rounded-xl border border-black/10 px-3.5 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20" />
                </div>
              </div>
            )}

            <div className="mt-6 flex items-center gap-3">
              <button onClick={salvar} disabled={saving} className="rounded-xl bg-brand px-6 py-3 text-sm font-bold text-white transition hover:bg-brand-600 disabled:opacity-60">
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
              {dispMap[editDay] && (
                <button onClick={() => limpar(editDay)} disabled={saving} className="text-sm font-medium text-ink-muted hover:text-red-600">Limpar dia</button>
              )}
              <button onClick={() => setEditDay(null)} className="ml-auto text-sm font-medium text-ink-muted hover:text-ink">Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
