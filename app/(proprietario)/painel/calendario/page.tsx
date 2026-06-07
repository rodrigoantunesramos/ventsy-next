'use client';

// Calendário de host premium — /painel/calendario.
// Reúne numa só visão: reservas reais (tabela `reservas`), bloqueios do dono e
// preço por dia (tabela `disponibilidade`, upsert por prop_id,data). Suporta
// seleção por intervalo (arrastar / shift-clique) com edição em massa, KPIs de
// ocupação/receita e feedback via toast. Substitui dashboard/modules/calendario.js.

import { useEffect, useState, useCallback, useRef, type ReactNode } from 'react';
import Link from 'next/link';
import { supabaseAny as sb } from '@/lib/supabase';
import { DEFAULT_LOCALE, formatMoney, formatPercent, formatDate } from '@/lib/format';
import { useToast } from '@/components/Toast';

type Prop = { id: number; nome: string | null; valor_hora: number | null; valor_base: number | null };
type Disp = {
  prop_id: number;
  data: string;
  motivo: string | null;
  bloqueado: boolean;
  preco: number | null;
  min_horas: number | null;
};
type Reserva = {
  id: string;
  propriedade_id: number;
  nome: string | null;
  tipo_evento: string | null;
  modo: string | null;
  data_inicio: string | null;
  data_fim: string | null;
  horas: number | null;
  pessoas: number | null;
  valor_estimado: number | null;
  status: string;
};

// ── i18n-ready: rótulos derivados do locale + dicionário de copy ──────────────
const LOCALE = DEFAULT_LOCALE;
const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const MESES = Array.from({ length: 12 }, (_, m) =>
  cap(new Intl.DateTimeFormat(LOCALE, { month: 'long' }).format(new Date(2021, m, 15))),
);
// 2021-08-01 é domingo → índice 0 = domingo.
const DIAS = Array.from({ length: 7 }, (_, d) =>
  cap(new Intl.DateTimeFormat(LOCALE, { weekday: 'short' }).format(new Date(2021, 7, 1 + d)).replace(/\.$/, '')),
);

const MOTIVOS = ['Evento particular', 'Manutenção', 'Reserva externa', 'Indisponível', 'Outro'];
const ATIVAS = new Set(['aprovada', 'paga', 'confirmada', 'realizada']);

const STATUS: Record<string, { label: string; cls: string }> = {
  solicitada: { label: 'Solicitada', cls: 'bg-amber-100 text-amber-700' },
  aprovada: { label: 'Aprovada', cls: 'bg-emerald-100 text-emerald-700' },
  recusada: { label: 'Recusada', cls: 'bg-red-100 text-red-700' },
  paga: { label: 'Paga', cls: 'bg-emerald-100 text-emerald-700' },
  confirmada: { label: 'Confirmada', cls: 'bg-emerald-100 text-emerald-700' },
  realizada: { label: 'Realizada', cls: 'bg-gray-100 text-gray-600' },
  cancelada: { label: 'Cancelada', cls: 'bg-gray-100 text-gray-500' },
  avaliada: { label: 'Avaliada', cls: 'bg-gray-100 text-gray-600' },
};

const t = {
  title: 'Calendário',
  subtitle: 'Reservas, bloqueios e preço por dia — tudo num só lugar. Arraste para selecionar um período.',
  emptyMsg: 'Cadastre um espaço para gerenciar a disponibilidade.',
  emptyCta: 'Anunciar meu espaço',
  kpi: { occupancy: 'Ocupação', revenue: 'Receita estimada', bookings: 'Reservas no mês', blocked: 'Dias bloqueados' },
  legend: { available: 'Disponível', today: 'Hoje', booked: 'Reservado', pending: 'Pendente', blocked: 'Bloqueado', special: 'Preço especial' },
  cell: { booked: 'reserv.', pending: 'pend.', blocked: 'bloq.' },
  quick: { title: 'Ações rápidas', weekends: 'Bloquear fins de semana', release: 'Liberar mês', base: 'Preço base' },
  bookingsList: { title: 'Reservas do mês', empty: 'Nenhuma reserva neste mês.' },
  blockedList: { title: 'Dias bloqueados', empty: 'Nenhum dia bloqueado neste mês.', release: 'Liberar' },
  editor: { blockLabel: 'Bloquear esta data (indisponível)', motivo: 'Motivo do bloqueio', motivoPh: 'Descreva o motivo', price: 'Preço neste dia', minHours: 'Mín. de horas', save: 'Salvar', saving: 'Salvando...', clear: 'Limpar dia', cancel: 'Cancelar' },
  bulk: { title: 'Editar período', count: (n: number) => `${n} dia(s) no período`, block: 'Bloquear datas', price: 'Definir preço', apply: 'Aplicar', applying: 'Aplicando...' },
  rel: { title: 'Liberar mês', msg: (n: number, m: string) => `Isso remove os ${n} bloqueio(s) de ${m}. Reservas confirmadas não são afetadas.`, gate: 'Digite LIBERAR para confirmar', action: 'Liberar', cancel: 'Cancelar' },
  booking: { people: 'Pessoas', event: 'Evento', estimate: 'Estimativa', requester: 'Solicitante', toCombine: 'A combinar', manage: 'Gerenciar nos leads' },
  toast: {
    saved: 'Dia atualizado.',
    cleared: 'Dia liberado.',
    error: 'Não foi possível salvar. Tente novamente.',
    weekends: (n: number) => `${n} fim(ns) de semana bloqueado(s).`,
    released: (n: number) => `${n} dia(s) liberado(s).`,
    bulk: (n: number) => `${n} dia(s) atualizado(s).`,
    none: 'Nenhum dia elegível no período (datas passadas ou com reserva são ignoradas).',
  },
};

function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function eachDayStr(a: string, b: string): string[] {
  const start = new Date(a + 'T12:00:00');
  const end = new Date(b + 'T12:00:00');
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return [];
  const out: string[] = [];
  for (let d = start, i = 0; d <= end && i < 400; d = new Date(d.getTime() + 86400000), i++) out.push(ymd(d));
  return out;
}

function longDate(dateStr: string) {
  return cap(new Intl.DateTimeFormat(LOCALE, { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(dateStr + 'T12:00:00')));
}

function periodoReserva(r: Reserva) {
  const f = (d: string | null) => (d ? formatDate(d.slice(0, 10), { style: 'short' }) : '—');
  if (r.modo === 'diaria') return `${f(r.data_inicio)}${r.data_fim ? ' — ' + f(r.data_fim) : ''}`;
  if (r.modo === 'hora') return `${f(r.data_inicio)} · ${r.horas || 0}h`;
  return f(r.data_inicio);
}

export default function CalendarioPage() {
  const toast = useToast();

  const [props, setProps] = useState<Prop[]>([]);
  const [selProp, setSelProp] = useState<number | ''>('');
  const [cursor, setCursor] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [dispMap, setDispMap] = useState<Record<string, Disp>>({});
  const [resvMap, setResvMap] = useState<Record<string, Reserva[]>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  // Editor de 1 dia
  const [editDay, setEditDay] = useState<string | null>(null);
  const [fBloq, setFBloq] = useState(false);
  const [fMotivo, setFMotivo] = useState('');
  const [fPreco, setFPreco] = useState('');
  const [fMin, setFMin] = useState('');
  const [saving, setSaving] = useState(false);

  // Modal de reserva
  const [bookingDay, setBookingDay] = useState<string | null>(null);

  // Modal "liberar mês"
  const [relOpen, setRelOpen] = useState(false);
  const [relText, setRelText] = useState('');

  // Edição em massa por período
  const [bulk, setBulk] = useState<{ from: string; to: string } | null>(null);
  const [bulkMode, setBulkMode] = useState<'block' | 'price'>('block');
  const [bMotivo, setBMotivo] = useState('');
  const [bPreco, setBPreco] = useState('');
  const [bMin, setBMin] = useState('');

  // Seleção por arrastar
  const [dragRange, setDragRange] = useState<{ a: string; b: string } | null>(null);
  const draggingRef = useRef(false);
  const dragRef = useRef<{ a: string; b: string } | null>(null);
  const suppressClickRef = useRef(false);
  const lastClickRef = useRef<string | null>(null);

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
    const firstNext = ymd(new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1));
    const last = ymd(new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0));
    const [dispRes, resvRes] = await Promise.all([
      sb.from('disponibilidade').select('*').eq('prop_id', propId).gte('data', first).lte('data', last),
      sb
        .from('reservas')
        .select('id,propriedade_id,nome,tipo_evento,modo,data_inicio,data_fim,horas,pessoas,valor_estimado,status')
        .eq('propriedade_id', propId)
        .lt('data_inicio', firstNext)
        .or(`data_fim.gte.${first},data_inicio.gte.${first}`),
    ]);
    const dm: Record<string, Disp> = {};
    (dispRes.data || []).forEach((r: Disp) => { dm[r.data] = r; });
    const rm: Record<string, Reserva[]> = {};
    (resvRes.data || []).forEach((r: Reserva) => {
      if (r.status === 'recusada' || r.status === 'cancelada' || !r.data_inicio) return;
      const s = r.data_inicio.slice(0, 10);
      const e = r.modo === 'diaria' && r.data_fim ? r.data_fim.slice(0, 10) : s;
      eachDayStr(s, e).forEach((k) => { (rm[k] = rm[k] || []).push(r); });
    });
    setDispMap(dm);
    setResvMap(rm);
  }, []);

  useEffect(() => {
    if (selProp === '') return;
    loadMonth(selProp as number, cursor);
  }, [selProp, cursor, loadMonth]);

  // Mapas atuais p/ o listener estável de pointerup
  const mapsRef = useRef({ dispMap, resvMap });
  mapsRef.current = { dispMap, resvMap };

  useEffect(() => {
    const onUp = () => {
      if (!draggingRef.current || !dragRef.current) return;
      draggingRef.current = false;
      const { a, b } = dragRef.current;
      dragRef.current = null;
      setDragRange(null);
      if (a !== b) {
        suppressClickRef.current = true;
        const [from, to] = a <= b ? [a, b] : [b, a];
        setBulkMode('block'); setBMotivo(''); setBPreco(''); setBMin('');
        setBulk({ from, to });
      }
    };
    window.addEventListener('pointerup', onUp);
    return () => window.removeEventListener('pointerup', onUp);
  }, []);

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

  const dayState = (dateStr: string) => {
    const rs = resvMap[dateStr] || [];
    const active = rs.some((r) => ATIVAS.has(r.status));
    const pending = !active && rs.some((r) => r.status === 'solicitada');
    const disp = dispMap[dateStr];
    return {
      rs,
      active,
      pending,
      hasBooking: rs.length > 0,
      blocked: !!disp?.bloqueado,
      preco: disp && !disp.bloqueado ? disp.preco : null,
    };
  };

  // ── KPIs do mês ─────────────────────────────────────────────────────────────
  let numBloq = 0;
  let diasOcupados = 0;
  const ativasMes = new Map<string, Reserva>();
  const reservasMes = new Map<string, Reserva>();
  for (let d = 1; d <= daysInMonth; d++) {
    const st = dayState(ymd(new Date(year, month, d)));
    if (st.blocked) numBloq++;
    if (st.active || st.blocked) diasOcupados++;
    st.rs.forEach((r) => { reservasMes.set(r.id, r); if (ATIVAS.has(r.status)) ativasMes.set(r.id, r); });
  }
  const receita = [...ativasMes.values()].reduce((s, r) => s + (r.valor_estimado || 0), 0);
  const ocupacao = daysInMonth ? diasOcupados / daysInMonth : 0;
  const bloqueados = Object.values(dispMap).filter((r) => r.bloqueado).sort((a, b) => a.data.localeCompare(b.data));
  const reservasList = [...reservasMes.values()].sort((a, b) => (a.data_inicio || '').localeCompare(b.data_inicio || ''));

  const irMes = (delta: number) => setCursor(new Date(year, month + delta, 1));

  function openDay(dateStr: string) {
    const r = dispMap[dateStr];
    setEditDay(dateStr);
    setFBloq(r ? r.bloqueado : false);
    setFMotivo(r?.bloqueado && r.motivo ? r.motivo : '');
    setFPreco(r?.preco != null ? String(r.preco) : '');
    setFMin(r?.min_horas != null ? String(r.min_horas) : '');
  }

  function onCellDown(dateStr: string, passado: boolean) {
    if (passado) return;
    draggingRef.current = true;
    dragRef.current = { a: dateStr, b: dateStr };
  }
  function onCellEnter(dateStr: string) {
    if (!draggingRef.current || !dragRef.current) return;
    if (dateStr !== dragRef.current.b) {
      dragRef.current = { a: dragRef.current.a, b: dateStr };
      setDragRange({ a: dragRef.current.a, b: dateStr });
    }
  }
  function onCellClick(e: React.MouseEvent, dateStr: string, passado: boolean) {
    if (passado) return;
    if (suppressClickRef.current) { suppressClickRef.current = false; return; }
    if (e.shiftKey && lastClickRef.current && lastClickRef.current !== dateStr) {
      const a = lastClickRef.current;
      const [from, to] = a <= dateStr ? [a, dateStr] : [dateStr, a];
      setBulkMode('block'); setBMotivo(''); setBPreco(''); setBMin('');
      setBulk({ from, to });
      return;
    }
    lastClickRef.current = dateStr;
    if ((resvMap[dateStr] || []).length) setBookingDay(dateStr);
    else openDay(dateStr);
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
      motivo: fBloq ? (fMotivo.trim() || 'Bloqueado pelo anfitrião') : null,
    };
    const { error } = await sb.from('disponibilidade').upsert(row, { onConflict: 'prop_id,data' });
    setSaving(false);
    if (error) { toast.error(t.toast.error); return; }
    setDispMap((m) => ({ ...m, [editDay]: row }));
    setEditDay(null);
    toast.success(t.toast.saved);
  }

  async function limpar(dateStr: string) {
    if (selProp === '') return;
    const { error } = await sb.from('disponibilidade').delete().eq('prop_id', selProp).eq('data', dateStr);
    if (error) { toast.error(t.toast.error); return; }
    setDispMap((m) => { const n = { ...m }; delete n[dateStr]; return n; });
    if (editDay === dateStr) setEditDay(null);
    toast.success(t.toast.cleared);
  }

  async function bloquearFimsDeSemana() {
    if (selProp === '') return;
    setBusy(true);
    const rows: Disp[] = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month, d);
      const k = ymd(date);
      const wd = date.getDay();
      const st = dayState(k);
      if ((wd === 0 || wd === 6) && k >= todayStr && !st.blocked && !st.hasBooking) {
        rows.push({ prop_id: selProp as number, data: k, bloqueado: true, preco: null, min_horas: null, motivo: 'Fim de semana' });
      }
    }
    if (!rows.length) { setBusy(false); toast.info(t.toast.none); return; }
    const { error } = await sb.from('disponibilidade').upsert(rows, { onConflict: 'prop_id,data' });
    if (!error) { await loadMonth(selProp as number, cursor); toast.success(t.toast.weekends(rows.length)); }
    else toast.error(t.toast.error);
    setBusy(false);
  }

  async function confirmarLiberar() {
    if (selProp === '') return;
    setBusy(true);
    const first = ymd(new Date(year, month, 1));
    const last = ymd(new Date(year, month + 1, 0));
    const n = numBloq;
    const { error } = await sb.from('disponibilidade').delete().eq('prop_id', selProp).gte('data', first).lte('data', last).eq('bloqueado', true);
    setBusy(false);
    if (error) { toast.error(t.toast.error); return; }
    await loadMonth(selProp as number, cursor);
    setRelOpen(false);
    toast.success(t.toast.released(n));
  }

  async function aplicarBulk() {
    if (!bulk || selProp === '') return;
    setBusy(true);
    const days = eachDayStr(bulk.from, bulk.to).filter((k) => k >= todayStr && (resvMap[k] || []).length === 0);
    if (!days.length) { setBusy(false); toast.info(t.toast.none); setBulk(null); return; }
    const rows: Disp[] = days.map((k) =>
      bulkMode === 'block'
        ? { prop_id: selProp as number, data: k, bloqueado: true, preco: null, min_horas: null, motivo: bMotivo.trim() || 'Bloqueado pelo anfitrião' }
        : { prop_id: selProp as number, data: k, bloqueado: false, preco: bPreco ? Number(bPreco) : null, min_horas: bMin ? Number(bMin) : null, motivo: null },
    );
    const { error } = await sb.from('disponibilidade').upsert(rows, { onConflict: 'prop_id,data' });
    setBusy(false);
    if (error) { toast.error(t.toast.error); return; }
    await loadMonth(selProp as number, cursor);
    setBulk(null);
    toast.success(t.toast.bulk(rows.length));
  }

  const bulkDays = bulk ? eachDayStr(bulk.from, bulk.to) : [];

  return (
    <div className="mx-auto max-w-6xl">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink sm:text-2xl">{t.title}</h1>
          <p className="mt-1 text-sm text-ink-muted">{t.subtitle}</p>
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
          <p className="mb-4 text-sm text-ink-soft">{t.emptyMsg}</p>
          <Link href="/anunciar" className="inline-flex rounded-full bg-brand px-6 py-3 text-sm font-semibold text-white hover:bg-brand-600">
            {t.emptyCta}
          </Link>
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi label={t.kpi.occupancy} value={formatPercent(ocupacao)} tone="gold" />
            <Kpi label={t.kpi.revenue} value={formatMoney(receita)} tone="verde" />
            <Kpi label={t.kpi.bookings} value={String(ativasMes.size)} tone="azul" />
            <Kpi label={t.kpi.blocked} value={String(numBloq)} tone="vermelho" />
          </div>

          <div className="mt-4 grid grid-cols-1 gap-5 lg:grid-cols-[1fr_300px]">
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
                  const dia = Number(dateStr.slice(-2));
                  const passado = dateStr < todayStr;
                  const hoje = dateStr === todayStr;
                  const st = dayState(dateStr);
                  const inDrag = !!dragRange && dateStr >= (dragRange.a <= dragRange.b ? dragRange.a : dragRange.b) && dateStr <= (dragRange.a <= dragRange.b ? dragRange.b : dragRange.a);

                  let cls = 'bg-white border-black/10 hover:border-brand hover:bg-brand/5 text-ink';
                  let sub: ReactNode = null;
                  if (passado) cls = 'bg-black/[0.02] border-black/[0.04] text-ink-muted/40 cursor-not-allowed';
                  else if (st.active) { cls = 'bg-brand-50 border-brand/30 text-brand hover:border-brand'; sub = t.cell.booked; }
                  else if (st.pending) { cls = 'bg-amber-50 border-amber-200 text-amber-700 hover:border-amber-300'; sub = t.cell.pending; }
                  else if (st.blocked) { cls = 'bg-red-50 border-red-200 text-red-700 hover:border-red-300'; sub = t.cell.blocked; }
                  else if (st.preco != null) { cls = 'bg-emerald-50 border-emerald-200 text-emerald-800 hover:border-emerald-300'; sub = formatMoney(Number(st.preco), { maximumFractionDigits: 0 }).replace(/\s/g, ''); }

                  return (
                    <button
                      key={dateStr}
                      disabled={passado}
                      onPointerDown={() => onCellDown(dateStr, passado)}
                      onPointerEnter={() => onCellEnter(dateStr)}
                      onClick={(e) => onCellClick(e, dateStr, passado)}
                      className={`relative flex aspect-square select-none flex-col items-center justify-center rounded-xl border text-sm font-semibold transition ${cls} ${hoje ? 'ring-2 ring-brand/40' : ''} ${inDrag ? 'ring-2 ring-brand ring-offset-1' : ''}`}
                    >
                      <span>{dia}</span>
                      {!passado && sub && <span className="mt-0.5 text-[10px] font-bold leading-none">{sub}</span>}
                    </button>
                  );
                })}
              </div>

              {/* Legenda */}
              <div className="mt-5 flex flex-wrap gap-x-4 gap-y-2 border-t border-black/[0.06] pt-4 text-xs text-ink-muted">
                <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded border border-black/15 bg-white" /> {t.legend.available}</span>
                <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded border border-brand/40 bg-brand-50" /> {t.legend.booked}</span>
                <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded border border-amber-300 bg-amber-100" /> {t.legend.pending}</span>
                <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded border border-red-300 bg-red-100" /> {t.legend.blocked}</span>
                <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded border border-emerald-300 bg-emerald-100" /> {t.legend.special}</span>
              </div>
            </div>

            {/* Painel lateral */}
            <div className="space-y-4">
              <div className="rounded-2xl bg-white p-5 shadow-card">
                <h3 className="text-sm font-bold text-ink">{t.quick.title}</h3>
                <div className="mt-3 space-y-2">
                  <button onClick={bloquearFimsDeSemana} disabled={busy} className="w-full rounded-xl border border-black/10 px-3 py-2.5 text-sm font-semibold text-ink-soft transition hover:border-brand hover:text-brand disabled:opacity-50">
                    {t.quick.weekends}
                  </button>
                  <button onClick={() => { setRelText(''); setRelOpen(true); }} disabled={busy || numBloq === 0} className="w-full rounded-xl border border-black/10 px-3 py-2.5 text-sm font-semibold text-ink-soft transition hover:border-red-300 hover:text-red-600 disabled:opacity-50">
                    {t.quick.release}
                  </button>
                </div>
                {precoBase > 0 && (
                  <p className="mt-3 border-t border-black/[0.06] pt-3 text-xs text-ink-muted">
                    {t.quick.base}: <strong className="text-ink-soft">{formatMoney(precoBase)}{precoLabel}</strong>
                  </p>
                )}
              </div>

              <div className="rounded-2xl bg-white p-5 shadow-card">
                <h3 className="text-sm font-bold text-ink">{t.bookingsList.title}</h3>
                {reservasList.length === 0 ? (
                  <p className="mt-3 text-sm text-ink-muted">{t.bookingsList.empty}</p>
                ) : (
                  <ul className="mt-3 space-y-2">
                    {reservasList.map((r) => {
                      const s = STATUS[r.status] || { label: r.status, cls: 'bg-gray-100 text-gray-600' };
                      return (
                        <li key={r.id} className="rounded-xl bg-black/[0.02] px-3 py-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-semibold text-ink-soft">{periodoReserva(r)}</span>
                            <span className={`rounded-full px-2 py-0.5 text-[0.65rem] font-bold ${s.cls}`}>{s.label}</span>
                          </div>
                          <div className="mt-0.5 truncate text-xs text-ink-muted">{r.nome || r.tipo_evento || '—'}</div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              <div className="rounded-2xl bg-white p-5 shadow-card">
                <h3 className="text-sm font-bold text-ink">{t.blockedList.title}</h3>
                {bloqueados.length === 0 ? (
                  <p className="mt-3 text-sm text-ink-muted">{t.blockedList.empty}</p>
                ) : (
                  <ul className="mt-3 space-y-2">
                    {bloqueados.map((r) => (
                      <li key={r.data} className="flex items-center justify-between gap-2 rounded-xl bg-black/[0.02] px-3 py-2">
                        <div>
                          <div className="text-sm font-semibold text-ink-soft">Dia {Number(r.data.slice(-2))}</div>
                          <div className="text-xs text-ink-muted">{r.motivo || t.legend.blocked}</div>
                        </div>
                        <button onClick={() => limpar(r.data)} title={t.blockedList.release} className="flex h-7 w-7 items-center justify-center rounded-full text-ink-muted hover:bg-red-50 hover:text-red-600">✕</button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Modal: configuração de 1 dia */}
      {editDay && (
        <Modal onClose={() => setEditDay(null)}>
          <h3 className="mb-1 font-display text-xl font-bold capitalize text-ink">{longDate(editDay)}</h3>
          <p className="mb-5 text-sm text-ink-muted">{selPropObj?.nome || `Espaço #${selProp}`}</p>

          <label className="mb-4 flex cursor-pointer items-center gap-3 rounded-xl border border-black/10 px-4 py-3">
            <input type="checkbox" checked={fBloq} onChange={(e) => setFBloq(e.target.checked)} className="h-4 w-4 accent-brand" />
            <span className="text-sm font-semibold text-ink-soft">{t.editor.blockLabel}</span>
          </label>

          {fBloq ? (
            <div className="mb-2">
              <label className="mb-1.5 block text-sm font-semibold text-ink-soft">{t.editor.motivo}</label>
              <div className="mb-2 flex flex-wrap gap-2">
                {MOTIVOS.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setFMotivo(m === 'Outro' ? '' : m)}
                    className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${fMotivo === m ? 'border-brand bg-brand-50 text-brand' : 'border-black/10 text-ink-soft hover:border-brand'}`}
                  >
                    {m}
                  </button>
                ))}
              </div>
              <input value={fMotivo} onChange={(e) => setFMotivo(e.target.value)} placeholder={t.editor.motivoPh} className={inp} />
            </div>
          ) : (
            <div className="mb-2 grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-ink-soft">{t.editor.price}</label>
                <input type="number" min={0} value={fPreco} onChange={(e) => setFPreco(e.target.value)} placeholder={precoBase ? String(precoBase) : 'base'} className={inp} />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-ink-soft">{t.editor.minHours}</label>
                <input type="number" min={0} value={fMin} onChange={(e) => setFMin(e.target.value)} placeholder="—" className={inp} />
              </div>
            </div>
          )}

          <div className="mt-6 flex items-center gap-3">
            <button onClick={salvar} disabled={saving} className="rounded-xl bg-brand px-6 py-3 text-sm font-bold text-white transition hover:bg-brand-600 disabled:opacity-60">
              {saving ? t.editor.saving : t.editor.save}
            </button>
            {dispMap[editDay] && (
              <button onClick={() => limpar(editDay)} disabled={saving} className="text-sm font-medium text-ink-muted hover:text-red-600">{t.editor.clear}</button>
            )}
            <button onClick={() => setEditDay(null)} className="ml-auto text-sm font-medium text-ink-muted hover:text-ink">{t.editor.cancel}</button>
          </div>
        </Modal>
      )}

      {/* Modal: detalhes da reserva */}
      {bookingDay && (
        <Modal onClose={() => setBookingDay(null)}>
          <h3 className="mb-4 font-display text-xl font-bold capitalize text-ink">{longDate(bookingDay)}</h3>
          <div className="space-y-3">
            {(resvMap[bookingDay] || []).map((r) => {
              const s = STATUS[r.status] || { label: r.status, cls: 'bg-gray-100 text-gray-600' };
              return (
                <div key={r.id} className="rounded-xl border border-black/[0.06] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="font-display text-base font-bold text-ink">{r.nome || r.tipo_evento || `Reserva #${r.id.slice(0, 6)}`}</div>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${s.cls}`}>{s.label}</span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                    <div><span className="text-ink-muted">{t.booking.event}:</span> <span className="font-medium text-ink-soft">{r.tipo_evento || '—'}</span></div>
                    <div><span className="text-ink-muted">{t.booking.people}:</span> <span className="font-medium text-ink-soft">{r.pessoas || '—'}</span></div>
                    <div className="col-span-2"><span className="text-ink-muted">{t.booking.estimate}:</span> <span className="font-medium text-ink-soft">{r.valor_estimado && r.valor_estimado > 0 ? formatMoney(r.valor_estimado) : t.booking.toCombine}</span></div>
                    <div className="col-span-2"><span className="text-ink-muted">{t.booking.requester}:</span> <span className="font-medium text-ink-soft">{r.nome || '—'}</span></div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-5">
            <Link href="/painel/leads" className="text-sm font-semibold text-brand hover:underline">{t.booking.manage} →</Link>
          </div>
        </Modal>
      )}

      {/* Modal: edição em massa por período */}
      {bulk && (
        <Modal onClose={() => setBulk(null)} wide>
          <h3 className="mb-1 font-display text-xl font-bold text-ink">{t.bulk.title}</h3>
          <p className="mb-4 text-sm text-ink-muted">{formatDate(bulk.from, { style: 'long' })} — {formatDate(bulk.to, { style: 'long' })} · {t.bulk.count(bulkDays.length)}</p>

          <div className="mb-4 inline-flex rounded-xl border border-black/10 p-1">
            <button onClick={() => setBulkMode('block')} className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition ${bulkMode === 'block' ? 'bg-brand text-white' : 'text-ink-soft hover:text-brand'}`}>{t.bulk.block}</button>
            <button onClick={() => setBulkMode('price')} className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition ${bulkMode === 'price' ? 'bg-brand text-white' : 'text-ink-soft hover:text-brand'}`}>{t.bulk.price}</button>
          </div>

          {bulkMode === 'block' ? (
            <div>
              <div className="mb-2 flex flex-wrap gap-2">
                {MOTIVOS.map((m) => (
                  <button key={m} type="button" onClick={() => setBMotivo(m === 'Outro' ? '' : m)} className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${bMotivo === m ? 'border-brand bg-brand-50 text-brand' : 'border-black/10 text-ink-soft hover:border-brand'}`}>{m}</button>
                ))}
              </div>
              <input value={bMotivo} onChange={(e) => setBMotivo(e.target.value)} placeholder={t.editor.motivoPh} className={inp} />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-ink-soft">{t.editor.price}</label>
                <input type="number" min={0} value={bPreco} onChange={(e) => setBPreco(e.target.value)} placeholder={precoBase ? String(precoBase) : 'base'} className={inp} />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-ink-soft">{t.editor.minHours}</label>
                <input type="number" min={0} value={bMin} onChange={(e) => setBMin(e.target.value)} placeholder="—" className={inp} />
              </div>
            </div>
          )}

          <div className="mt-6 flex items-center gap-3">
            <button onClick={aplicarBulk} disabled={busy} className="rounded-xl bg-brand px-6 py-3 text-sm font-bold text-white transition hover:bg-brand-600 disabled:opacity-60">
              {busy ? t.bulk.applying : t.bulk.apply}
            </button>
            <button onClick={() => setBulk(null)} className="ml-auto text-sm font-medium text-ink-muted hover:text-ink">{t.editor.cancel}</button>
          </div>
        </Modal>
      )}

      {/* Modal: liberar mês (confirmação com gate) */}
      {relOpen && (
        <Modal onClose={() => setRelOpen(false)}>
          <h3 className="mb-1 font-display text-xl font-bold text-ink">{t.rel.title}</h3>
          <p className="mb-4 text-sm text-ink-muted">{t.rel.msg(numBloq, `${MESES[month]} ${year}`)}</p>
          <input value={relText} onChange={(e) => setRelText(e.target.value)} placeholder={t.rel.gate} className={inp} autoFocus />
          <div className="mt-6 flex items-center gap-3">
            <button onClick={confirmarLiberar} disabled={busy || relText.trim().toUpperCase() !== 'LIBERAR'} className="rounded-xl bg-red-600 px-6 py-3 text-sm font-bold text-white transition hover:bg-red-700 disabled:opacity-40">
              {t.rel.action}
            </button>
            <button onClick={() => setRelOpen(false)} className="ml-auto text-sm font-medium text-ink-muted hover:text-ink">{t.rel.cancel}</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

const inp = 'w-full rounded-xl border border-black/10 px-3.5 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20';

function Kpi({ label, value, tone }: { label: string; value: string; tone: 'verde' | 'vermelho' | 'gold' | 'azul' }) {
  const color = tone === 'verde' ? 'text-emerald-600' : tone === 'vermelho' ? 'text-red-600' : tone === 'gold' ? 'text-amber-600' : 'text-blue-600';
  return (
    <div className="rounded-2xl bg-white p-4 shadow-card">
      <div className="text-xs text-ink-muted">{label}</div>
      <div className={`mt-2 text-xl font-bold ${color}`}>{value}</div>
    </div>
  );
}

function Modal({ children, onClose, wide }: { children: ReactNode; onClose: () => void; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-[10000] flex items-start justify-center overflow-y-auto bg-black/50 p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className={`relative my-8 w-full ${wide ? 'max-w-lg' : 'max-w-md'} rounded-2xl bg-white p-6 shadow-pop`}>
        <button onClick={onClose} className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full border border-black/10 text-ink-muted hover:bg-black/[0.03]">✕</button>
        {children}
      </div>
    </div>
  );
}
